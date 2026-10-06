import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import {
  addresses, cartItems, carts, colors, inventory, orderItems, orders,
  orderStatusEvents, paymentRecords, productVariants, products, sizes, storeSettings,
} from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { quoteShipping } from "@/lib/commerce/shipping";
import { recordNotificationEvent } from "@/lib/notifications/events";
import { getPaymentProvider, type PaymentProvider } from "@/lib/commerce/payment-provider";
import { KhaltiRequestError } from "@/lib/commerce/khalti-provider";
import { failKhaltiInitiation } from "@/lib/commerce/payment-processing";
import { getSafeCheckoutFailureMetadata } from "@/lib/commerce/checkout-diagnostics";

export type CheckoutActor = { userId: string; role: string };
export type CheckoutMethod = "COD" | "PROVIDER";

const checkoutSchema = z.object({
  addressId: z.string().uuid(),
  method: z.enum(["COD", "PROVIDER"]),
}).strict();

export class CheckoutError extends Error {
  constructor(message: string) { super(message); this.name = "CheckoutError"; }
}

export async function createCustomerOrder(actor: CheckoutActor, input: unknown, providerOverride?: PaymentProvider) {
  assertRole(actor.role, "CUSTOMER");
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) throw new CheckoutError("Review your delivery address and payment method.");
  const paymentProvider = parsed.data.method === "PROVIDER" ? (providerOverride ?? getPaymentProvider("khalti")) : null;
  if (paymentProvider && !paymentProvider.isConfigured()) throw new CheckoutError("Khalti online payment is not configured. Choose Cash on Delivery if available.");

  const db = getDatabase();
  const orderNumber = `NFS-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const idempotencyKey = `cod:${orderNumber}`;
  let result: { orderNumber: string; orderId: string; paymentId: string; totalPaisa: bigint };

  try {
    result = await db.transaction(async (tx) => {
      const [address] = await tx.select().from(addresses)
        .where(and(eq(addresses.id, parsed.data.addressId), eq(addresses.userId, actor.userId))).limit(1);
      if (!address) throw new CheckoutError("Select one of your saved delivery addresses.");

      const [cart] = await tx.select({ id: carts.id }).from(carts)
        .where(eq(carts.userId, actor.userId)).for("update").limit(1);
      if (!cart) throw new CheckoutError("Your cart is empty.");
      const cartRows = await tx.select({ variantId: cartItems.variantId, quantity: cartItems.quantity })
        .from(cartItems).where(eq(cartItems.cartId, cart.id));
      if (!cartRows.length) throw new CheckoutError("Your cart is empty.");

      const lines = await tx.select({
        variantId: productVariants.id, sku: productVariants.sku,
        pricePaisa: productVariants.pricePaisa, salePricePaisa: productVariants.salePricePaisa,
        variantActive: productVariants.active, productId: products.id,
        productName: products.name, productActive: products.active,
        sizeLabel: sizes.label, colorName: colors.name,
        onHand: inventory.onHand, reserved: inventory.reserved, quantity: cartItems.quantity,
      }).from(cartItems)
        .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
        .innerJoin(products, eq(products.id, productVariants.productId))
        .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
        .leftJoin(sizes, eq(sizes.id, productVariants.sizeId))
        .leftJoin(colors, eq(colors.id, productVariants.colorId))
        .where(eq(cartItems.cartId, cart.id));
      if (lines.length !== cartRows.length) throw new CheckoutError("A cart item is no longer available. Review your cart.");

      let subtotalPaisa = 0n;
      const pricedLines = lines.map((line) => {
        if (!line.productActive || !line.variantActive) throw new CheckoutError(`${line.productName} is no longer available. Review your cart.`);
        if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
          throw new CheckoutError("A cart quantity is invalid. Review your cart.");
        }
        if (line.onHand - line.reserved < line.quantity) {
          throw new CheckoutError(`There is not enough stock for ${line.productName}. Review your cart.`);
        }
        const unitPricePaisa = line.salePricePaisa ?? line.pricePaisa;
        const lineTotalPaisa = unitPricePaisa * BigInt(line.quantity);
        subtotalPaisa += lineTotalPaisa;
        return { ...line, unitPricePaisa, lineTotalPaisa,
          variantLabel: [line.sizeLabel, line.colorName].filter(Boolean).join(" / ") || "Standard" };
      });

      const [settings] = await tx.select({ currency: storeSettings.currency, storeActive: storeSettings.storeActive }).from(storeSettings).limit(1);
      if (settings && !settings.storeActive) throw new CheckoutError("Checkout is temporarily closed. Please try again later.");
      const currency = settings?.currency ?? "NPR";
      if (currency !== "NPR") throw new CheckoutError("The store currency is not supported for checkout yet.");
      let shipping;
      try { shipping = await quoteShipping({ province: address.province, district: address.district, subtotalPaisa }); }
      catch { throw new CheckoutError("Shipping is not available for this address."); }
      if (!shipping.codEnabled && parsed.data.method === "COD") throw new CheckoutError("Cash on Delivery is unavailable for this address.");
      const totalPaisa = subtotalPaisa + shipping.chargePaisa;
      if (paymentProvider && (totalPaisa < 1001n || totalPaisa > BigInt(Number.MAX_SAFE_INTEGER))) {
        throw new CheckoutError("Khalti payments require a safe whole-paisa total greater than NPR 10.");
      }

      const [order] = await tx.insert(orders).values({
        orderNumber, userId: actor.userId, customerName: address.fullName, customerPhone: address.phoneNumber,
        status: "PLACED", paymentStatus: paymentProvider ? "PENDING" : "UNPAID",
        paymentMethod: paymentProvider ? "PROVIDER" : "COD", paymentProvider: paymentProvider?.id ?? null, currency,
        subtotalPaisa, shippingPaisa: shipping.chargePaisa, totalPaisa,
        shippingRuleId: shipping.ruleId, shippingRuleName: shipping.ruleName,
        shippingAddressSnapshot: {
          fullName: address.fullName, phoneNumber: address.phoneNumber, province: address.province,
          district: address.district, municipality: address.municipality, wardNumber: address.wardNumber,
          toleArea: address.toleArea, streetAddress: address.streetAddress, postalCode: address.postalCode,
        },
      }).returning({ id: orders.id });

      for (const line of pricedLines) {
        const updated = await tx.update(inventory)
          .set({ onHand: sql`${inventory.onHand} - ${line.quantity}`, updatedAt: new Date() })
          .where(and(eq(inventory.variantId, line.variantId), sql`${inventory.onHand} - ${inventory.reserved} >= ${line.quantity}`))
          .returning({ variantId: inventory.variantId });
        if (updated.length !== 1) throw new CheckoutError("Stock changed during checkout. Review your cart and try again.");
        await tx.insert(orderItems).values({
          orderId: order.id, productId: line.productId, variantId: line.variantId,
          productName: line.productName, sku: line.sku, variantLabel: line.variantLabel,
          selectedSize: line.sizeLabel, selectedColor: line.colorName,
          unitPricePaisa: line.unitPricePaisa, quantity: line.quantity, lineTotalPaisa: line.lineTotalPaisa,
        });
      }

      const [payment] = await tx.insert(paymentRecords).values({
        orderId: order.id, provider: paymentProvider?.id ?? "COD", amountPaisa: totalPaisa,
        currency, status: paymentProvider ? "PENDING" : "UNPAID",
        idempotencyKey: paymentProvider ? `khalti:${orderNumber}` : idempotencyKey,
      }).returning({ id: paymentRecords.id });
      await tx.insert(orderStatusEvents).values({ orderId: order.id, fromStatus: null, toStatus: "PLACED", changedBy: actor.userId });
      const eventPayload = { orderNumber, totalPaisa: totalPaisa.toString(), currency, status: "PLACED" };
      await recordNotificationEvent(tx, { userId: actor.userId, orderId: order.id, type: "ORDER_PLACED", dedupeKey: `${order.id}:placed`, payload: eventPayload });
      await recordNotificationEvent(tx, { userId: null, orderId: order.id, type: "NEW_ORDER", dedupeKey: `${order.id}:admin-new-order`, payload: { orderNumber, totalPaisa: totalPaisa.toString(), currency } });
      if (!paymentProvider) {
        await recordNotificationEvent(tx, { userId: actor.userId, orderId: order.id, type: "COD_ORDER_CONFIRMATION", dedupeKey: `${order.id}:cod-confirmation`, payload: { orderNumber, paymentMethod: "COD", paymentStatus: "UNPAID" } });
      }
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      return { orderNumber, orderId: order.id, paymentId: payment.id, totalPaisa };
    });
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    console.error("checkout.transaction_failed", getSafeCheckoutFailureMetadata(error));
    throw new CheckoutError("We could not place your order. Your cart has been kept; please try again.");
  }

  if (!paymentProvider) return { orderNumber, paymentMethod: "COD" as const, redirectUrl: null as string | null };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) throw new CheckoutError("The online payment return URL is not configured.");
  try {
    const initiated = await paymentProvider.createPayment({
      orderNumber,
      amountPaisa: BigInt(result.totalPaisa),
      currency: "NPR",
      returnUrl: new URL("/api/payments/khalti/return", appUrl).toString(),
      websiteUrl: new URL(appUrl).origin,
    });
    const db = getDatabase();
    const saved = await db.update(paymentRecords).set({ providerReference: initiated.providerReference, updatedAt: new Date() })
      .where(and(eq(paymentRecords.id, result.paymentId), eq(paymentRecords.status, "PENDING"), eq(paymentRecords.provider, "khalti")))
      .returning({ id: paymentRecords.id });
    if (saved.length !== 1) throw new CheckoutError("The payment attempt could not be saved. Check your order status before retrying.");
    return { orderNumber, paymentMethod: "PROVIDER" as const, redirectUrl: initiated.redirectUrl };
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    if (error instanceof KhaltiRequestError && error.status >= 400 && error.status < 500) {
      await failKhaltiInitiation(result.paymentId);
      return { orderNumber, paymentMethod: "PROVIDER" as const, redirectUrl: null as string | null };
    }
    // A network failure can be ambiguous: keep the order pending and never claim it was paid.
    return { orderNumber, paymentMethod: "PROVIDER" as const, redirectUrl: null as string | null };
  }
}
