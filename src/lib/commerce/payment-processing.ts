import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { inventory, orderItems, orderStatusEvents, orders, paymentRecords } from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { getPaymentProvider, type PaymentProvider } from "@/lib/commerce/payment-provider";
import { recordNotificationEvent } from "@/lib/notifications/events";

export type PaymentProcessingResult = "PAID" | "PENDING" | "FAILED" | "VERIFICATION_FAILED";

export async function failKhaltiInitiation(paymentId: string) {
  const outcome = await getDatabase().transaction(async (tx) => {
    const [payment] = await tx.select().from(paymentRecords).where(eq(paymentRecords.id, paymentId)).for("update").limit(1);
    if (!payment || payment.provider !== "khalti" || payment.status !== "PENDING") return null;
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId)).for("update").limit(1);
    if (!order || order.paymentStatus !== "PENDING") return null;
    await markPaymentFailed(tx, order, payment, "Khalti rejected the payment initiation request.");
    return order.id;
  });
  return Boolean(outcome);
}

export async function verifyKhaltiReturn(
  actor: { userId: string; role: string },
  input: { pidx: unknown; purchaseOrderId: unknown; transactionReference?: unknown },
  providerOverride?: PaymentProvider,
): Promise<{ orderNumber: string; result: PaymentProcessingResult }> {
  assertRole(actor.role, "CUSTOMER");
  const pidx = typeof input.pidx === "string" ? input.pidx.trim() : "";
  const purchaseOrderId = typeof input.purchaseOrderId === "string" ? input.purchaseOrderId.trim() : "";
  const callbackTransaction = typeof input.transactionReference === "string" ? input.transactionReference.trim() : "";
  if (!pidx || pidx.length > 180 || !purchaseOrderId || purchaseOrderId.length > 32) throw new Error("Payment could not be found.");

  const db = getDatabase();
  const [context] = await db.select({ payment: paymentRecords, order: orders }).from(paymentRecords)
    .innerJoin(orders, eq(orders.id, paymentRecords.orderId))
    .where(and(eq(paymentRecords.provider, "khalti"), eq(paymentRecords.providerReference, pidx))).limit(1);
  if (!context || context.order.userId !== actor.userId || context.order.orderNumber !== purchaseOrderId ||
      context.order.paymentMethod !== "PROVIDER" || context.order.currency !== "NPR" ||
      context.payment.currency !== "NPR" || context.payment.amountPaisa !== context.order.totalPaisa) {
    throw new Error("Payment could not be found.");
  }

  if (context.payment.status === "PAID" && context.order.paymentStatus === "PAID") {
    if (callbackTransaction && callbackTransaction !== context.payment.providerTransactionId) return { orderNumber: context.order.orderNumber, result: "VERIFICATION_FAILED" };
    return { orderNumber: context.order.orderNumber, result: "PAID" };
  }
  if (context.payment.status === "FAILED" || context.order.paymentStatus === "FAILED") {
    return { orderNumber: context.order.orderNumber, result: "FAILED" };
  }

  const provider = providerOverride ?? getPaymentProvider("khalti");
  let verification;
  try { verification = await provider.verifyPayment(pidx); }
  catch { return { orderNumber: context.order.orderNumber, result: "VERIFICATION_FAILED" }; }
  if (verification.providerReference !== context.payment.providerReference ||
      verification.amountPaisa !== context.payment.amountPaisa ||
      (callbackTransaction && verification.transactionReference !== callbackTransaction)) {
    return { orderNumber: context.order.orderNumber, result: "VERIFICATION_FAILED" };
  }
  if (verification.outcome === "PAID" && !verification.transactionReference) {
    return { orderNumber: context.order.orderNumber, result: "VERIFICATION_FAILED" };
  }
  if (verification.outcome === "UNKNOWN") return { orderNumber: context.order.orderNumber, result: "VERIFICATION_FAILED" };

  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, context.order.id)).for("update").limit(1);
    const [payment] = await tx.select().from(paymentRecords).where(eq(paymentRecords.id, context.payment.id)).for("update").limit(1);
    if (!order || !payment || order.userId !== actor.userId || payment.providerReference !== pidx || order.orderNumber !== purchaseOrderId) {
      return { orderNumber: context.order.orderNumber, result: "VERIFICATION_FAILED" as const };
    }
    if (payment.status === "PAID" && order.paymentStatus === "PAID") {
      return { orderNumber: order.orderNumber, result: "PAID" as const };
    }
    if (payment.status === "FAILED" || order.paymentStatus === "FAILED") {
      return { orderNumber: order.orderNumber, result: "FAILED" as const };
    }
    if (payment.status !== "PENDING" || order.paymentStatus !== "PENDING") {
      return { orderNumber: order.orderNumber, result: "VERIFICATION_FAILED" as const };
    }

    if (verification.outcome === "PENDING") return { orderNumber: order.orderNumber, result: "PENDING" as const };

    if (verification.outcome === "PAID") {
      await tx.update(paymentRecords).set({ status: "PAID", providerTransactionId: verification.transactionReference, updatedAt: new Date() })
        .where(eq(paymentRecords.id, payment.id));
      await tx.update(orders).set({ paymentStatus: "PAID", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await recordNotificationEvent(tx, {
        userId: order.userId, orderId: order.id, type: "ONLINE_PAYMENT_SUCCESS",
        dedupeKey: `${payment.id}:online-payment-success`,
        payload: { orderNumber: order.orderNumber, paymentStatus: "PAID", amountPaisa: order.totalPaisa.toString(), currency: "NPR" },
      });
      return { orderNumber: order.orderNumber, result: "PAID" as const };
    }

    await markPaymentFailed(tx, order, payment, "Khalti payment was not completed.", verification.transactionReference);
    return { orderNumber: order.orderNumber, result: "FAILED" as const };
  });
  return result;
}

type PaymentTransaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

async function markPaymentFailed(
  tx: PaymentTransaction,
  order: typeof orders.$inferSelect,
  payment: typeof paymentRecords.$inferSelect,
  note: string,
  transactionReference: string | null = null,
) {
  await tx.update(paymentRecords).set({ status: "FAILED", providerTransactionId: transactionReference, updatedAt: new Date() })
    .where(eq(paymentRecords.id, payment.id));
  await tx.update(orders).set({ paymentStatus: "FAILED", updatedAt: new Date() }).where(eq(orders.id, order.id));
  await recordNotificationEvent(tx, {
    userId: order.userId, orderId: order.id, type: "PAYMENT_FAILURE",
    dedupeKey: `${payment.id}:payment-failed`,
    payload: { orderNumber: order.orderNumber, paymentStatus: "FAILED" },
  });
  if (order.status !== "PLACED") return;
  const lines = await tx.select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const line of lines) {
    if (line.variantId) await tx.update(inventory).set({ onHand: sql`${inventory.onHand} + ${line.quantity}`, updatedAt: new Date() })
      .where(eq(inventory.variantId, line.variantId));
  }
  await tx.update(orders).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(orders.id, order.id));
  await tx.insert(orderStatusEvents).values({ orderId: order.id, fromStatus: "PLACED", toStatus: "CANCELLED", note });
  const payload = { orderNumber: order.orderNumber, fromStatus: "PLACED", toStatus: "CANCELLED" };
  await recordNotificationEvent(tx, { userId: order.userId, orderId: order.id, type: "ORDER_STATUS_CHANGED", dedupeKey: `${payment.id}:status-cancelled`, payload });
  await recordNotificationEvent(tx, { userId: order.userId, orderId: order.id, type: "ORDER_CANCELLED", dedupeKey: `${payment.id}:order-cancelled`, payload });
}
