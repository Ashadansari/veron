import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db";
import { account, notificationEvents, orders, user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { GET as getAdminNotifications, PATCH as patchAdminNotifications } from "@/app/api/admin/notifications/route";
import { recordNotificationEvent } from "@/lib/notifications/events";
import { testOrigin } from "./test-origin";

const db = getDatabase();
const tag = randomUUID();
const adminId = `alerts-admin-${tag}`;
const customerId = `alerts-customer-${tag}`;
const testPassword = "AlertTestPass123";
let adminCookie = "";
let customerCookie = "";
const orderIds: string[] = [];
const eventIds: string[] = [];
let priorAlertReadStates: Array<{ id: string; adminReadAt: Date | null }> = [];
let alertEventId = "";
let secondEventId = "";

function request(method: "GET" | "PATCH", cookie?: string, body?: unknown) {
  return new Request(`${testOrigin}/api/admin/notifications`, {
    method,
    headers: {
      origin: testOrigin,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

before(async () => {
  priorAlertReadStates = await db.select({ id: notificationEvents.id, adminReadAt: notificationEvents.adminReadAt })
    .from(notificationEvents).where(eq(notificationEvents.eventType, "NEW_ORDER"));
  await db.insert(user).values([
    { id: adminId, name: "Alert Test Admin", email: `${adminId}@example.test`, role: "ADMIN" },
    { id: customerId, name: "Alert Test Customer", email: `${customerId}@example.test`, role: "CUSTOMER" },
  ]);
  const password = await hashPassword(testPassword);
  await db.insert(account).values([
    { id: `alerts-account-admin-${tag}`, accountId: adminId, providerId: "credential", userId: adminId, password },
    { id: `alerts-account-customer-${tag}`, accountId: customerId, providerId: "credential", userId: customerId, password },
  ]);
  const auth = getAuth();
  async function login(email: string) {
    const response = await auth.handler(new Request(`${testOrigin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin: testOrigin, "content-type": "application/json" },
      body: JSON.stringify({ email, password: testPassword }),
    }));
    assert.equal(response.status, 200, "synthetic fixture credentials should authenticate through Better Auth");
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith("better-auth.session_token="));
    assert.ok(cookie, "Better Auth should issue the signed session cookie used by the route");
    return cookie.split(";")[0]!;
  }
  adminCookie = await login(`${adminId}@example.test`);
  customerCookie = await login(`${customerId}@example.test`);

  const [firstOrder] = await db.insert(orders).values({
    orderNumber: `NFS-${tag.slice(0, 12).toUpperCase()}`,
    userId: customerId,
    customerName: "Rahul Sharma",
    customerPhone: "+9779812345678",
    paymentMethod: "COD",
    subtotalPaisa: 700000n,
    shippingPaisa: 49000n,
    totalPaisa: 749000n,
    shippingRuleName: "Alert Test Rule",
    shippingAddressSnapshot: { fullName: "Rahul Sharma" },
  }).returning();
  orderIds.push(firstOrder.id);
  const dedupeKey = `${firstOrder.id}:admin-new-order`;
  await db.transaction(async (tx) => {
    await recordNotificationEvent(tx, {
      userId: null,
      orderId: firstOrder.id,
      type: "NEW_ORDER",
      dedupeKey,
      payload: { orderNumber: firstOrder.orderNumber, totalPaisa: "749000", currency: "NPR" },
    });
    await recordNotificationEvent(tx, {
      userId: null,
      orderId: firstOrder.id,
      type: "NEW_ORDER",
      dedupeKey,
      payload: { orderNumber: firstOrder.orderNumber, totalPaisa: "749000", currency: "NPR" },
    });
  });
  const [firstEvent] = await db.select({ id: notificationEvents.id }).from(notificationEvents)
    .where(eq(notificationEvents.dedupeKey, dedupeKey)).limit(1);
  alertEventId = firstEvent.id;
  eventIds.push(alertEventId);

  const [secondOrder] = await db.insert(orders).values({
    orderNumber: `NFS-${tag.slice(12, 24).toUpperCase()}`,
    userId: customerId,
    customerName: "Rahul Sharma",
    customerPhone: "+9779812345678",
    paymentMethod: "COD",
    subtotalPaisa: 50000n,
    shippingPaisa: 0n,
    totalPaisa: 50000n,
    shippingRuleName: "Alert Test Rule",
    shippingAddressSnapshot: { fullName: "Rahul Sharma" },
  }).returning();
  orderIds.push(secondOrder.id);
  const [secondEvent] = await db.insert(notificationEvents).values({
    userId: null,
    orderId: secondOrder.id,
    eventType: "NEW_ORDER",
    payload: { orderNumber: secondOrder.orderNumber, totalPaisa: "50000", currency: "NPR" },
    dedupeKey: `${secondOrder.id}:admin-new-order`,
    createdAt: new Date(Date.now() + 1),
  }).returning({ id: notificationEvents.id });
  secondEventId = secondEvent.id;
  eventIds.push(secondEventId);
});

after(async () => {
  if (eventIds.length) await db.delete(notificationEvents).where(inArray(notificationEvents.id, eventIds));
  if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));
  for (const state of priorAlertReadStates) {
    await db.update(notificationEvents).set({ adminReadAt: state.adminReadAt }).where(eq(notificationEvents.id, state.id));
  }
  await db.delete(user).where(eq(user.id, adminId));
  await db.delete(user).where(eq(user.id, customerId));
});

test("admin order notifications are protected, idempotent, readable, and never own orders", async () => {
  const unauthenticated = await getAdminNotifications(request("GET"));
  assert.equal(unauthenticated.status, 401);
  const customerRead = await getAdminNotifications(request("GET", customerCookie));
  assert.equal(customerRead.status, 403);
  const customerMark = await patchAdminNotifications(request("PATCH", customerCookie, { notificationId: alertEventId }));
  assert.equal(customerMark.status, 403);
  const unauthenticatedMark = await patchAdminNotifications(request("PATCH", undefined, { notificationId: alertEventId }));
  assert.equal(unauthenticatedMark.status, 401);

  const adminResponse = await getAdminNotifications(request("GET", adminCookie));
  assert.equal(adminResponse.status, 200);
  const initial = await adminResponse.json() as { unreadCount: number; items: Array<Record<string, unknown>> };
  const index = new Map(initial.items.map((item) => [item.id, item]));
  const alert = index.get(alertEventId);
  const secondAlert = index.get(secondEventId);
  assert.ok(alert && secondAlert);
  assert.equal(alert.orderId, orderIds[0]);
  assert.equal(alert.orderNumber, `NFS-${tag.slice(0, 12).toUpperCase()}`);
  assert.equal(alert.customerName, "Rahul Sharma");
  assert.equal(alert.total, "NPR 7,490");
  assert.equal(alert.currency, "NPR");
  assert.equal(alert.isRead, false);
  assert.equal(alert.href, `/admin/orders/${orderIds[0]}`);
  assert.equal("customerPhone" in alert, false);
  assert.equal("email" in alert, false);
  assert.equal(initial.items[0]?.id, secondEventId, "the newest event is listed first");
  assert.ok(typeof alert.createdAt === "string");
  assert.ok(initial.unreadCount >= 2);

  const orderBefore = await db.select().from(orders).where(eq(orders.id, orderIds[0]!)).limit(1);
  const marked = await patchAdminNotifications(request("PATCH", adminCookie, { notificationId: alertEventId }));
  assert.equal(marked.status, 200);
  const afterOne = await getAdminNotifications(request("GET", adminCookie));
  const afterOneBody = await afterOne.json() as { unreadCount: number; items: Array<Record<string, unknown>> };
  assert.equal(afterOneBody.unreadCount, initial.unreadCount - 1);
  assert.equal(afterOneBody.items.find((item) => item.id === alertEventId)?.isRead, true);

  const markedAll = await patchAdminNotifications(request("PATCH", adminCookie, { markAll: true }));
  assert.equal(markedAll.status, 200);
  const afterAll = await getAdminNotifications(request("GET", adminCookie));
  const afterAllBody = await afterAll.json() as { unreadCount: number };
  assert.equal(afterAllBody.unreadCount, 0);

  await db.delete(notificationEvents).where(eq(notificationEvents.id, alertEventId));
  assert.equal(await db.$count(orders, eq(orders.id, orderIds[0]!)), 1);
  assert.equal((await db.select().from(orders).where(eq(orders.id, orderIds[0]!)).limit(1))[0]?.totalPaisa, orderBefore[0]?.totalPaisa);
});
