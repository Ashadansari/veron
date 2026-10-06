import "server-only";

import { z } from "zod";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { addresses, cartItems, carts, colors, inventory, orderItems, orders, productVariants, products, sizes, storeSettings } from "@/db/schema";
import { quoteShipping } from "@/lib/commerce/shipping";
import { isKhaltiPaymentConfigured } from "@/lib/commerce/khalti-provider";

export async function getCustomerAddresses(userId: string) {
  return getDatabase().select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), asc(addresses.createdAt));
}

export async function getCustomerOrders(userId: string) {
  const db = getDatabase();
  const rows = await db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, paymentStatus: orders.paymentStatus, paymentMethod: orders.paymentMethod, totalPaisa: orders.totalPaisa, placedAt: orders.placedAt }).from(orders)
    .where(and(eq(orders.userId, userId), ne(orders.status, "CANCELLED"))).orderBy(desc(orders.placedAt));
  const counts = rows.length ? await db.select({ orderId: orderItems.orderId, count: sql<number>`sum(${orderItems.quantity})::int` })
    .from(orderItems).where(inArray(orderItems.orderId, rows.map((row) => row.id))).groupBy(orderItems.orderId) : [];
  const countMap = new Map(counts.map((row) => [row.orderId, row.count]));
  return rows.map((row) => ({ ...row, itemCount: countMap.get(row.id) ?? 0 }));
}

export async function getCustomerOrder(userId: string, orderId: string) {
  if (!z.string().uuid().safeParse(orderId).success) return null;
  const db = getDatabase();
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, items };
}

export async function getCustomerOrderByNumber(userId: string, orderNumber: string) {
  if (orderNumber.length > 32) return null;
  const db = getDatabase();
  const [order] = await db.select().from(orders).where(and(eq(orders.orderNumber, orderNumber), eq(orders.userId, userId))).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, items };
}

export async function getCustomerCart(userId: string) {
  const db = getDatabase();
  const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
  if (!cart) return { items: [], subtotalPaisa: 0n };
  const items = await db.select({
    variantId: productVariants.id,
    productId: products.id,
    productName: products.name,
    slug: products.slug,
    sku: productVariants.sku,
    pricePaisa: productVariants.pricePaisa,
    salePricePaisa: productVariants.salePricePaisa,
    quantity: cartItems.quantity,
    stock: inventory.onHand,
    size: sizes.label,
    color: colors.name,
  }).from(cartItems).innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId)).innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .leftJoin(sizes, eq(sizes.id, productVariants.sizeId)).leftJoin(colors, eq(colors.id, productVariants.colorId))
    .where(eq(cartItems.cartId, cart.id));
  return { items, subtotalPaisa: items.reduce((sum, item) => sum + (item.salePricePaisa ?? item.pricePaisa) * BigInt(item.quantity), 0n) };
}

export async function getCheckoutReview(userId: string) {
  const db = getDatabase();
  const [customerAddresses, savedSettings] = await Promise.all([
    getCustomerAddresses(userId),
    db.select({ storeActive: storeSettings.storeActive }).from(storeSettings).limit(1),
  ]);
  const storeActive = savedSettings[0]?.storeActive ?? true;
  const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
  const items = cart ? await db.select({
    variantId: productVariants.id, sku: productVariants.sku,
    regularPricePaisa: productVariants.pricePaisa, salePricePaisa: productVariants.salePricePaisa,
    variantActive: productVariants.active, productName: products.name, productSlug: products.slug,
    productActive: products.active, size: sizes.label, color: colors.name,
    quantity: cartItems.quantity, onHand: inventory.onHand, reserved: inventory.reserved,
  }).from(cartItems).innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId)).innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .leftJoin(sizes, eq(sizes.id, productVariants.sizeId)).leftJoin(colors, eq(colors.id, productVariants.colorId))
    .where(eq(cartItems.cartId, cart.id)) : [];
  const subtotalPaisa = items.reduce((sum, item) => sum + (item.salePricePaisa ?? item.regularPricePaisa) * BigInt(item.quantity), 0n);
  const addressQuotes = await Promise.all(customerAddresses.map(async (address) => {
    try {
      const quote = await quoteShipping({ province: address.province, district: address.district, subtotalPaisa });
      return { id: address.id, fullName: address.fullName, phoneNumber: address.phoneNumber,
        province: address.province, district: address.district, municipality: address.municipality,
        wardNumber: address.wardNumber, toleArea: address.toleArea, streetAddress: address.streetAddress,
        postalCode: address.postalCode, shippingLabel: quote.chargePaisa === 0n ? "Free delivery" : formatShipping(quote.chargePaisa),
        shippingPaisa: quote.chargePaisa.toString(), codEnabled: storeActive && quote.codEnabled, ruleName: quote.ruleName };
    } catch {
      return { id: address.id, fullName: address.fullName, phoneNumber: address.phoneNumber,
        province: address.province, district: address.district, municipality: address.municipality,
        wardNumber: address.wardNumber, toleArea: address.toleArea, streetAddress: address.streetAddress,
        postalCode: address.postalCode, shippingLabel: null, shippingPaisa: null, codEnabled: false, ruleName: null };
    }
  }));
  return {
    items: items.map((item) => ({
      variantId: item.variantId,
      productName: item.productName,
      quantity: item.quantity,
      unitPricePaisa: (item.salePricePaisa ?? item.regularPricePaisa).toString(),
      lineTotalPaisa: ((item.salePricePaisa ?? item.regularPricePaisa) * BigInt(item.quantity)).toString(),
      variantLabel: [item.size, item.color].filter(Boolean).join(" / ") || "Standard",
      available: item.productActive && item.variantActive && item.onHand - item.reserved >= item.quantity,
    })),
    subtotalPaisa: subtotalPaisa.toString(), addresses: addressQuotes, storeActive,
    khaltiEnabled: storeActive && isKhaltiPaymentConfigured(),
  };
}

function formatShipping(amountPaisa: bigint) {
  const rupees = amountPaisa / 100n;
  const paisa = amountPaisa % 100n;
  return `NPR ${rupees.toString()}${paisa ? `.${paisa.toString().padStart(2, "0")}` : ""}`;
}
