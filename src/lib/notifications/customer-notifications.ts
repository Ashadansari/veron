import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db";
import { notificationEvents, orders } from "@/db/schema";
import { assertRole } from "@/lib/authz";

export type CustomerNotificationActor = { userId: string; role: string };

function notificationMessage(eventType: string, payload: Record<string, string>) {
  const orderNumber = payload.orderNumber;
  if (eventType === "ORDER_PLACED") return `Order #${orderNumber} has been placed.`;
  if (eventType === "ORDER_CANCELLED") return `Order #${orderNumber} has been cancelled.`;

  switch (payload.toStatus) {
    case "CONFIRMED": return `Order #${orderNumber} has been confirmed.`;
    case "PACKED": return `Order #${orderNumber} is processing.`;
    case "SHIPPED": return `Order #${orderNumber} has been shipped.`;
    case "DELIVERED": return `Order #${orderNumber} has been delivered.`;
    default: return `Order #${orderNumber} status has been updated.`;
  }
}

export async function getCustomerOrderNotifications(actor: CustomerNotificationActor) {
  assertRole(actor.role, "CUSTOMER");
  const rows = await getDatabase().select({
    id: notificationEvents.id,
    orderId: orders.id,
    eventType: notificationEvents.eventType,
    payload: notificationEvents.payload,
    createdAt: notificationEvents.createdAt,
  }).from(notificationEvents)
    .innerJoin(orders, eq(orders.id, notificationEvents.orderId))
    .where(and(
      eq(notificationEvents.userId, actor.userId),
      inArray(notificationEvents.eventType, ["ORDER_PLACED", "ORDER_STATUS_CHANGED", "ORDER_CANCELLED"]),
    ))
    .orderBy(desc(notificationEvents.createdAt))
    .limit(50);

  return rows.filter((row) => !(row.eventType === "ORDER_STATUS_CHANGED" && row.payload.toStatus === "CANCELLED")).map((row) => ({
    id: row.id,
    orderId: row.orderId,
    message: notificationMessage(row.eventType, row.payload),
    createdAt: row.createdAt,
  }));
}
