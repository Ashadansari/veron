import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import { inventory, orderItems, orderStatusEvents, orders, paymentRecords, user } from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { recordNotificationEvent } from "@/lib/notifications/events";

const statusSchema = z.enum(["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]);
const adminTransitions: Record<z.infer<typeof statusSchema>, readonly string[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"], CANCELLED: [], RETURNED: [],
};

async function cancelLockedOrder(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  order: typeof orders.$inferSelect,
  actorId: string,
  note: string | null,
  cancelledByCustomerName?: string,
) {
  const lines = await tx.select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const line of lines) {
    if (line.variantId) await tx.update(inventory)
      .set({ onHand: sql`${inventory.onHand} + ${line.quantity}`, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(inventory.variantId, line.variantId));
  }
  const paymentNote = order.paymentStatus === "PAID"
    ? " Payment is still recorded as paid; refund follow-up is required and no refund was processed."
    : "";
  await tx.update(orders).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(orders.id, order.id));
  await tx.insert(orderStatusEvents).values({ orderId: order.id, fromStatus: order.status, toStatus: "CANCELLED",
    changedBy: actorId, note: `${note ?? "Order cancelled."}${paymentNote}` });
  const payload = { orderNumber: order.orderNumber, fromStatus: order.status, toStatus: "CANCELLED" };
  await recordNotificationEvent(tx, {
    userId: order.userId, orderId: order.id, type: "ORDER_CANCELLED",
    dedupeKey: `${order.id}:cancelled`, payload,
  });
  if (cancelledByCustomerName !== undefined) {
    const customerName = order.customerName.trim() || "Customer";
    await recordNotificationEvent(tx, {
      userId: null,
      orderId: order.id,
      type: "ORDER_CANCELLED",
      dedupeKey: `${order.id}:admin-cancelled`,
      payload: { ...payload, customerName, cancelledBy: cancelledByCustomerName },
    });
  }
}

export async function cancelCustomerOrder(actor: { userId: string; role: string }, orderId: unknown) {
  assertRole(actor.role, "CUSTOMER");
  const parsedId = z.string().uuid().safeParse(orderId);
  if (!parsedId.success) throw new Error("Order not found.");
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(and(eq(orders.id, parsedId.data), eq(orders.userId, actor.userId))).for("update").limit(1);
    if (!order) throw new Error("Order not found.");
    if (order.status !== "PLACED" || order.paymentStatus !== "UNPAID") {
      throw new Error("This order can no longer be cancelled online. Contact customer support for help.");
    }
    const [customer] = await tx.select({ name: user.name }).from(user).where(eq(user.id, actor.userId)).limit(1);
    await cancelLockedOrder(tx, order, actor.userId, "Cancelled by customer.", customer?.name.trim() || order.customerName.trim() || "Customer");
  });
}

export async function updateAdminOrderStatus(actor: { userId: string; role: string }, input: unknown) {
  assertRole(actor.role, "ADMIN");
  const parsed = z.object({ orderId: z.string().uuid(), status: statusSchema, note: z.string().trim().max(1000) }).safeParse(input);
  if (!parsed.success) throw new Error("Order status details are invalid.");
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, parsed.data.orderId)).for("update").limit(1);
    if (!order) throw new Error("Order not found.");
    if (order.status === "DELIVERED" && parsed.data.status === "DELIVERED") return;
    if (!adminTransitions[order.status].includes(parsed.data.status)) throw new Error("That order status change is not allowed.");
    if (parsed.data.status === "CANCELLED") {
      await cancelLockedOrder(tx, order, actor.userId, parsed.data.note || "Cancelled by admin.");
      return;
    }
    const isCodDelivery = parsed.data.status === "DELIVERED" && order.paymentMethod === "COD";
    await tx.update(orders).set({
      status: parsed.data.status,
      ...(isCodDelivery && order.paymentStatus === "UNPAID" ? { paymentStatus: "PAID" as const } : {}),
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));
    if (isCodDelivery) {
      await tx.update(paymentRecords).set({ status: "PAID", updatedAt: new Date() }).where(and(
        eq(paymentRecords.orderId, order.id),
        eq(paymentRecords.provider, "COD"),
        eq(paymentRecords.status, "UNPAID"),
      ));
    }
    await tx.insert(orderStatusEvents).values({ orderId: order.id, fromStatus: order.status,
      toStatus: parsed.data.status, changedBy: actor.userId, note: parsed.data.note || null });
    await recordNotificationEvent(tx, {
      userId: order.userId, orderId: order.id, type: "ORDER_STATUS_CHANGED",
      dedupeKey: `${order.id}:status:${parsed.data.status}`,
      payload: { orderNumber: order.orderNumber, fromStatus: order.status, toStatus: parsed.data.status },
    });
  });
}

export async function getAdminOrders(filters: { query?: string; status?: string; paymentStatus?: string }) {
  const where = and(
    filters.query ? or(ilike(orders.orderNumber, `%${filters.query.slice(0, 80)}%`),
      ilike(orders.customerName, `%${filters.query.slice(0, 80)}%`),
      ilike(orders.customerPhone, `%${filters.query.slice(0, 80)}%`)) : undefined,
    statusSchema.safeParse(filters.status).success ? eq(orders.status, filters.status as z.infer<typeof statusSchema>) : undefined,
    z.enum(["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"]).safeParse(filters.paymentStatus).success
      ? eq(orders.paymentStatus, filters.paymentStatus as "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED") : undefined,
  );
  const rows = await getDatabase().select({
    order: orders, customerName: orders.customerName, customerPhone: orders.customerPhone,
    itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
  }).from(orders).leftJoin(orderItems, eq(orderItems.orderId, orders.id)).where(where)
    .groupBy(orders.id).orderBy(desc(orders.placedAt)).limit(100);
  return rows;
}
