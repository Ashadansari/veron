import "server-only";

import { and, count, desc, eq, gte, isNull, or } from "drizzle-orm";
import { getDatabase } from "@/db";
import { notificationEvents, orders } from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { formatPaisa } from "@/lib/commerce/money";

const ALERT_RETENTION_DAYS = 90;
const ALERT_LIST_LIMIT = 25;

export type AdminAlertActor = { userId: string; role: string };

function retentionCutoff() {
  return new Date(Date.now() - ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function adminAlertFilter(cutoff: Date) {
  return and(
    or(
      eq(notificationEvents.eventType, "NEW_ORDER"),
      and(eq(notificationEvents.eventType, "ORDER_CANCELLED"), isNull(notificationEvents.userId)),
    ),
    gte(notificationEvents.createdAt, cutoff),
  );
}

export async function listAdminOrderAlerts(actor: AdminAlertActor) {
  assertRole(actor.role, "ADMIN");
  const db = getDatabase();
  const cutoff = retentionCutoff();
  const baseFilter = adminAlertFilter(cutoff);

  const [rows, [unread]] = await Promise.all([
    db.select({
      id: notificationEvents.id,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      totalPaisa: orders.totalPaisa,
      currency: orders.currency,
      placedAt: orders.placedAt,
      eventCreatedAt: notificationEvents.createdAt,
      eventType: notificationEvents.eventType,
      payload: notificationEvents.payload,
      readAt: notificationEvents.adminReadAt,
    })
      .from(notificationEvents)
      .innerJoin(orders, eq(orders.id, notificationEvents.orderId))
      .where(baseFilter)
      .orderBy(desc(notificationEvents.createdAt))
      .limit(ALERT_LIST_LIMIT),
    db.select({ value: count() }).from(notificationEvents)
      .where(and(baseFilter, isNull(notificationEvents.adminReadAt))),
  ]);

  return {
    unreadCount: unread.value,
    items: rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      total: formatPaisa(row.totalPaisa),
      currency: row.currency,
      createdAt: row.eventCreatedAt.toISOString(),
      isRead: row.readAt !== null,
      eventType: row.eventType,
      title: row.eventType === "NEW_ORDER" ? "New order received" : "Order cancelled",
      description: row.eventType === "NEW_ORDER"
        ? `${row.customerName} placed ${row.orderNumber}`
        : `Order #${row.orderNumber} was cancelled by ${(row.payload as Record<string, string>).cancelledBy ?? row.customerName}.`,
      href: `/admin/orders/${row.orderId}`,
    })),
  };
}

export async function markAdminOrderAlertRead(actor: AdminAlertActor, notificationId: string) {
  assertRole(actor.role, "ADMIN");
  const db = getDatabase();
  const cutoff = retentionCutoff();
  const [updated] = await db.update(notificationEvents)
    .set({ adminReadAt: new Date() })
    .where(and(
      eq(notificationEvents.id, notificationId),
      adminAlertFilter(cutoff)!,
      isNull(notificationEvents.adminReadAt),
    ))
    .returning({ id: notificationEvents.id });
  if (updated) return true;

  const [existing] = await db.select({ id: notificationEvents.id }).from(notificationEvents)
    .where(and(
      eq(notificationEvents.id, notificationId),
      adminAlertFilter(cutoff)!,
    )).limit(1);
  return Boolean(existing);
}

export async function markAllAdminOrderAlertsRead(actor: AdminAlertActor) {
  assertRole(actor.role, "ADMIN");
  const updated = await getDatabase().update(notificationEvents)
    .set({ adminReadAt: new Date() })
    .where(and(
      adminAlertFilter(retentionCutoff())!,
      isNull(notificationEvents.adminReadAt),
    ))
    .returning({ id: notificationEvents.id });
  return updated.length;
}
