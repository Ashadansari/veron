import "server-only";

import type { getDatabase } from "@/db";
import { notificationEvents } from "@/db/schema";

export type NotificationEventType =
  | "NEW_ORDER"
  | "ORDER_PLACED"
  | "COD_ORDER_CONFIRMATION"
  | "ONLINE_PAYMENT_SUCCESS"
  | "PAYMENT_FAILURE"
  | "ORDER_STATUS_CHANGED"
  | "ORDER_CANCELLED";

type EventTransaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

/** Persists a delivery-neutral, idempotent customer event in the same DB transaction as its business change. */
export async function recordNotificationEvent(
  tx: EventTransaction,
  event: {
    userId: string | null;
    orderId: string;
    type: NotificationEventType;
    dedupeKey: string;
    payload: Record<string, string>;
  },
) {
  await tx.insert(notificationEvents).values({
    userId: event.userId,
    orderId: event.orderId,
    eventType: event.type,
    dedupeKey: event.dedupeKey,
    payload: event.payload,
  }).onConflictDoNothing({ target: notificationEvents.dedupeKey });
}
