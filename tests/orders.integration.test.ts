import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import { addresses, cartItems, carts, categories, inventory, notificationEvents, orderItems, orderStatusEvents, orders, paymentRecords, productVariants, products, shippingRules, storeSettings, user } from "@/db/schema";
import { AuthorizationError } from "@/lib/authz";
import { createCustomerOrder } from "@/lib/commerce/checkout";
import { quoteShipping } from "@/lib/commerce/shipping";
import { getCustomerCart, getCustomerOrder, getCustomerOrders } from "@/lib/commerce/customer-queries";
import { cancelCustomerOrder, getAdminOrders, updateAdminOrderStatus } from "@/lib/commerce/order-management";
import { listAdminOrderAlerts } from "@/lib/admin/order-alerts";
import { recordNotificationEvent } from "@/lib/notifications/events";
import { getCustomerOrderNotifications } from "@/lib/notifications/customer-notifications";

const db = getDatabase();
const tag = randomUUID();
const customerId = `phase6-customer-${tag}`;
const secondCustomerId = `phase6-second-${tag}`;
const adminId = `phase6-admin-${tag}`;
const customer = { userId: customerId, role: "CUSTOMER" };
const secondCustomer = { userId: secondCustomerId, role: "CUSTOMER" };
const admin = { userId: adminId, role: "ADMIN" };
let addressId = "";
let secondAddressId = "";
let categoryId = "";
let productId = "";
let variantId = "";
let shippingRuleId = "";
const orderIds: string[] = [];

async function putCart(userId: string, quantity: number) {
  const [cart] = await db.insert(carts).values({ userId }).onConflictDoUpdate({ target: carts.userId, set: { updatedAt: new Date() } }).returning({ id: carts.id });
  await db.insert(cartItems).values({ cartId: cart.id, variantId, quantity }).onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity, updatedAt: new Date() } });
  return cart.id;
}

async function inventoryOnHand() {
  const [row] = await db.select().from(inventory).where(eq(inventory.variantId, variantId)).limit(1);
  return row.onHand;
}

before(async () => {
  await db.insert(storeSettings).values({ id: 1, storeName: "Test store", currency: "NPR", locale: "ne-NP", timeZone: "Asia/Kathmandu", lowStockThreshold: 5, shippingChargePaisa: 4567n, freeShippingThresholdPaisa: 300000n, codEnabled: true, storeActive: true }).onConflictDoUpdate({ target: storeSettings.id, set: { shippingChargePaisa: 4567n, freeShippingThresholdPaisa: 300000n, codEnabled: true, storeActive: true } });
  await db.insert(user).values([
    { id: customerId, name: "Checkout Customer", email: `${customerId}@example.test`, role: "CUSTOMER" },
    { id: secondCustomerId, name: "Other Customer", email: `${secondCustomerId}@example.test`, role: "CUSTOMER" },
    { id: adminId, name: "Checkout Admin", email: `${adminId}@example.test`, role: "ADMIN" },
  ]);
  const [category] = await db.insert(categories).values({ name: `Phase Six ${tag.slice(0, 6)}`, slug: `phase-six-${tag}`, active: true }).returning();
  categoryId = category.id;
  const [product] = await db.insert(products).values({ categoryId, name: "Checkout Snapshot Shirt", slug: `phase-six-product-${tag}`, active: true, basePricePaisa: 77777n }).returning();
  productId = product.id;
  const [variant] = await db.insert(productVariants).values({ productId, sku: `P6-${tag}`, pricePaisa: 105050n, salePricePaisa: 99999n, active: true }).returning();
  variantId = variant.id;
  await db.insert(inventory).values({ variantId, onHand: 20, reserved: 0 });
  const [rule] = await db.insert(shippingRules).values({ name: `Phase Six ${tag.slice(0, 6)}`, province: "Bagmati", district: "Kathmandu", chargePaisa: 12345n, freeShippingThresholdPaisa: null, codEnabled: true, priority: 9999, active: true }).returning();
  shippingRuleId = rule.id;
  const [addressA] = await db.insert(addresses).values({ userId: customerId, fullName: "Checkout Customer", phoneNumber: "+9779841234567", province: "Bagmati", district: "Kathmandu", municipality: "Kathmandu Metropolitan City", wardNumber: 3, toleArea: "Test Tole", streetAddress: "12 Test Street", postalCode: null, isDefault: true }).returning();
  addressId = addressA.id;
  const [addressB] = await db.insert(addresses).values({ userId: secondCustomerId, fullName: "Other Customer", phoneNumber: "+9779861234567", province: "Bagmati", district: "Kathmandu", municipality: "Kathmandu Metropolitan City", wardNumber: 4, toleArea: "Other Tole", streetAddress: "22 Test Street", postalCode: null }).returning();
  secondAddressId = addressB.id;
});

after(async () => {
  if (orderIds.length) {
    await db.delete(notificationEvents).where(inArray(notificationEvents.orderId, orderIds));
    await db.delete(paymentRecords).where(inArray(paymentRecords.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.id, orderIds));
  }
  await db.delete(shippingRules).where(eq(shippingRules.id, shippingRuleId));
  if (productId) await db.delete(products).where(eq(products.id, productId));
  if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId));
  await db.delete(user).where(inArray(user.id, [customerId, secondCustomerId, adminId]));
  await db.delete(storeSettings).where(eq(storeSettings.id, 1));
});

test("checkout, orders, payment, inventory, and cancellation stay server-authoritative", async (t) => {
  await t.test("saved carts are scoped to the authenticated customer", async () => {
    const customerCartId = await putCart(customerId, 2);
    const secondCartId = await putCart(secondCustomerId, 1);
    try {
      const [customerCart, secondCustomerCart, unrecognizedCustomerCart] = await Promise.all([
        getCustomerCart(customerId),
        getCustomerCart(secondCustomerId),
        getCustomerCart(`not-a-customer-${tag}`),
      ]);
      assert.deepEqual(customerCart.items.map((item) => [item.variantId, item.quantity]), [[variantId, 2]]);
      assert.deepEqual(secondCustomerCart.items.map((item) => [item.variantId, item.quantity]), [[variantId, 1]]);
      assert.deepEqual(unrecognizedCustomerCart.items, []);
      assert.equal(customerCart.subtotalPaisa, 199998n);
      assert.equal(secondCustomerCart.subtotalPaisa, 99999n);
    } finally {
      await db.delete(cartItems).where(inArray(cartItems.cartId, [customerCartId, secondCartId]));
      await db.delete(carts).where(inArray(carts.id, [customerCartId, secondCartId]));
    }
  });

  await t.test("empty cart, invalid address, and browser-supplied totals are rejected without clearing cart", async () => {
    await assert.rejects(() => createCustomerOrder(customer, { addressId, method: "COD" }), /cart is empty/i);
    const cartId = await putCart(customerId, 1);
    await assert.rejects(() => db.update(cartItems).set({ quantity: 21 }).where(eq(cartItems.cartId, cartId)));
    await assert.rejects(() => db.update(cartItems).set({ quantity: 0 }).where(eq(cartItems.cartId, cartId)));
    await assert.rejects(() => createCustomerOrder(customer, { addressId: randomUUID(), method: "COD" }), /saved delivery addresses/i);
    await assert.rejects(() => createCustomerOrder(customer, {
      addressId, method: "COD", price: "1", subtotalPaisa: "1", shippingPaisa: "0", totalPaisa: "1", paymentStatus: "PAID",
    }), /review your delivery address/i);
    assert.equal(await db.$count(cartItems, eq(cartItems.cartId, cartId)), 1);
    await assert.rejects(() => createCustomerOrder({ ...customer, role: "ADMIN" }, { addressId, method: "COD" }), (error) => error instanceof AuthorizationError && error.status === 403);
    await assert.rejects(() => createCustomerOrder(customer, { addressId, method: "PROVIDER" }), /not configured/i);
  });

  await t.test("shipping uses matching zones first and exact-paisa store defaults with a free threshold", async () => {
    const zoneQuote = await quoteShipping({ province: "Bagmati", district: "Kathmandu", subtotalPaisa: 199998n });
    assert.equal(zoneQuote.chargePaisa, 12345n);
    await db.update(shippingRules).set({ freeShippingThresholdPaisa: 199998n }).where(eq(shippingRules.id, shippingRuleId));
    const zoneFree = await quoteShipping({ province: "Bagmati", district: "Kathmandu", subtotalPaisa: 199998n });
    assert.equal(zoneFree.chargePaisa, 0n);
    await db.update(shippingRules).set({ freeShippingThresholdPaisa: null }).where(eq(shippingRules.id, shippingRuleId));
    const defaultQuote = await quoteShipping({ province: "Koshi", district: "Morang", subtotalPaisa: 299999n });
    assert.equal(defaultQuote.chargePaisa, 4567n);
    const defaultFree = await quoteShipping({ province: "Koshi", district: "Morang", subtotalPaisa: 300000n });
    assert.equal(defaultFree.chargePaisa, 0n);
  });

  await t.test("successful COD checkout recalculates prices, snapshots data, reserves stock by decrement, and clears cart", async () => {
    await putCart(customerId, 2);
    const initialStock = await inventoryOnHand();
    const result = await createCustomerOrder(customer, { addressId, method: "COD" });
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, result.orderNumber)).limit(1);
    assert.ok(order);
    orderIds.push(order.id);
    assert.equal(order.subtotalPaisa, 199998n);
    assert.equal(order.shippingPaisa, 12345n);
    assert.equal(order.totalPaisa, 212343n);
    assert.equal(order.paymentMethod, "COD");
    assert.equal(order.paymentStatus, "UNPAID");
    assert.equal((order.shippingAddressSnapshot as { streetAddress: string }).streetAddress, "12 Test Street");
    const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).limit(1);
    assert.equal(item.unitPricePaisa, 99999n);
    assert.equal(item.lineTotalPaisa, 199998n);
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    assert.equal(payment.status, "UNPAID");
    assert.equal(payment.amountPaisa, order.totalPaisa);
    const events = await db.select().from(notificationEvents).where(eq(notificationEvents.orderId, order.id));
    assert.deepEqual(new Set(events.map((event) => event.eventType)), new Set(["ORDER_PLACED", "COD_ORDER_CONFIRMATION", "NEW_ORDER"]));
    const [newOrderEvent] = events.filter((event) => event.eventType === "NEW_ORDER");
    assert.ok(newOrderEvent);
    assert.equal(newOrderEvent.orderId, order.id);
    assert.equal(newOrderEvent.adminReadAt, null);
    assert.deepEqual(newOrderEvent.payload, { orderNumber: order.orderNumber, totalPaisa: order.totalPaisa.toString(), currency: "NPR" });
    const alerts = await listAdminOrderAlerts(admin);
    const alert = alerts.items.find((item) => item.orderId === order.id);
    assert.ok(alert);
    assert.equal(alert.customerName, "Checkout Customer");
    assert.equal(alert.orderNumber, order.orderNumber);
    assert.equal(alert.total, "NPR 2,123.43");
    assert.equal(alert.currency, "NPR");
    assert.equal(alert.href, `/admin/orders/${order.id}`);
    assert.equal(alert.isRead, false);

    await db.transaction(async (tx) => {
      const duplicate = { userId: null, orderId: order.id, type: "NEW_ORDER" as const, dedupeKey: `${order.id}:admin-new-order`, payload: { orderNumber: order.orderNumber, totalPaisa: order.totalPaisa.toString(), currency: "NPR" } };
      await recordNotificationEvent(tx, duplicate);
      await recordNotificationEvent(tx, duplicate);
    });
    assert.equal(await db.$count(notificationEvents, eq(notificationEvents.dedupeKey, `${order.id}:admin-new-order`)), 1);
    assert.equal(await inventoryOnHand(), initialStock - 2);
    const [unchangedOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    assert.equal(unchangedOrder.totalPaisa, 212343n);
    assert.equal(unchangedOrder.paymentStatus, "UNPAID");
    const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, customerId)).limit(1);
    assert.equal(await db.$count(cartItems, eq(cartItems.cartId, cart.id)), 0);
    assert.ok(await getCustomerOrder(customerId, order.id));
    assert.equal(await getCustomerOrder(secondCustomerId, order.id), null);
    await db.update(products).set({ name: "Changed after sale", active: false, basePricePaisa: 1n }).where(eq(products.id, productId));
    const [snapshot] = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).limit(1);
    assert.equal(snapshot.productName, "Checkout Snapshot Shirt");
    assert.equal(snapshot.unitPricePaisa, 99999n);
    await db.update(products).set({ name: "Checkout Snapshot Shirt", active: true, basePricePaisa: 77777n }).where(eq(products.id, productId));
  });

  await t.test("inactive catalog and insufficient inventory fail while preserving cart and stock", async () => {
    const cartId = await putCart(customerId, 1);
    await db.update(products).set({ active: false }).where(eq(products.id, productId));
    await assert.rejects(() => createCustomerOrder(customer, { addressId, method: "COD" }), /no longer available/i);
    await db.update(products).set({ active: true }).where(eq(products.id, productId));
    await db.update(productVariants).set({ active: false }).where(eq(productVariants.id, variantId));
    await assert.rejects(() => createCustomerOrder(customer, { addressId, method: "COD" }), /no longer available/i);
    await db.update(productVariants).set({ active: true }).where(eq(productVariants.id, variantId));
    await db.update(inventory).set({ onHand: 0 }).where(eq(inventory.variantId, variantId));
    await assert.rejects(() => createCustomerOrder(customer, { addressId, method: "COD" }), /not enough stock/i);
    assert.equal(await db.$count(cartItems, eq(cartItems.cartId, cartId)), 1);
    await db.update(inventory).set({ onHand: 18 }).where(eq(inventory.variantId, variantId));
  });

  await t.test("only one concurrent checkout can buy the last unit", async () => {
    await putCart(customerId, 1); await putCart(secondCustomerId, 1);
    await db.update(inventory).set({ onHand: 1, reserved: 0 }).where(eq(inventory.variantId, variantId));
    const outcomes = await Promise.allSettled([
      createCustomerOrder(customer, { addressId, method: "COD" }),
      createCustomerOrder(secondCustomer, { addressId: secondAddressId, method: "COD" }),
    ]);
    assert.equal(outcomes.filter((value) => value.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((value) => value.status === "rejected").length, 1);
    for (const outcome of outcomes) if (outcome.status === "fulfilled") {
      const [order] = await db.select().from(orders).where(eq(orders.orderNumber, outcome.value.orderNumber)).limit(1);
      orderIds.push(order.id);
    }
    assert.equal(await inventoryOnHand(), 0);
  });

  await t.test("customer cancellation is owner-scoped, admin status is role-guarded, and stock restores once", async () => {
    await db.update(inventory).set({ onHand: 5, reserved: 0 }).where(eq(inventory.variantId, variantId));
    await putCart(customerId, 1);
    const { orderNumber } = await createCustomerOrder(customer, { addressId, method: "COD" });
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    orderIds.push(order.id);
    const afterPurchase = await inventoryOnHand();
    await assert.rejects(() => cancelCustomerOrder(secondCustomer, order.id), /Order not found/i);
    await assert.rejects(() => updateAdminOrderStatus({ userId: "", role: "" }, { orderId: order.id, status: "CONFIRMED", note: "" }), (error) => error instanceof AuthorizationError && error.status === 401);
    await assert.rejects(() => updateAdminOrderStatus(customer, { orderId: order.id, status: "CONFIRMED", note: "" }), (error) => error instanceof AuthorizationError && error.status === 403);
    await updateAdminOrderStatus(admin, { orderId: order.id, status: "CONFIRMED", note: "Accepted" });
    await assert.rejects(() => cancelCustomerOrder(customer, order.id), /can no longer be cancelled/i);
    assert.equal(await db.$count(notificationEvents, eq(notificationEvents.dedupeKey, `${order.id}:cancelled`)), 0);
    assert.equal(await db.$count(notificationEvents, eq(notificationEvents.dedupeKey, `${order.id}:admin-cancelled`)), 0);
    await updateAdminOrderStatus(admin, { orderId: order.id, status: "CANCELLED", note: "Unable to fulfill" });
    assert.equal(await inventoryOnHand(), afterPurchase + 1);
    const [cancelled] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    assert.equal(cancelled.status, "CANCELLED");
    const cancelEvents = await db.select().from(notificationEvents).where(eq(notificationEvents.orderId, order.id));
    assert.ok(cancelEvents.some((event) => event.eventType === "ORDER_CANCELLED"));
    assert.equal(cancelEvents.filter((event) => event.eventType === "ORDER_CANCELLED" && event.userId === customerId).length, 1);
    await assert.rejects(() => updateAdminOrderStatus(admin, { orderId: order.id, status: "CANCELLED", note: "Again" }), /not allowed/i);

    await putCart(customerId, 1);
    const paidResult = await createCustomerOrder(customer, { addressId, method: "COD" });
    const [paidOrder] = await db.select().from(orders).where(eq(orders.orderNumber, paidResult.orderNumber)).limit(1);
    orderIds.push(paidOrder.id);
    await db.update(orders).set({ paymentStatus: "PAID" }).where(eq(orders.id, paidOrder.id));
    await db.update(paymentRecords).set({ status: "PAID" }).where(eq(paymentRecords.orderId, paidOrder.id));
    await updateAdminOrderStatus(admin, { orderId: paidOrder.id, status: "CANCELLED", note: "Manual review" });
    const [stillPaid] = await db.select().from(orders).where(eq(orders.id, paidOrder.id)).limit(1);
    const refundEvents = await db.select().from(orderStatusEvents).where(eq(orderStatusEvents.orderId, paidOrder.id));
    assert.equal(stillPaid.paymentStatus, "PAID");
    assert.match(refundEvents.find((event) => event.toStatus === "CANCELLED")?.note ?? "", /refund follow-up is required/i);
  });

  await t.test("customer lifecycle notifications cover order status changes", async () => {
    await db.update(inventory).set({ onHand: 10, reserved: 0 }).where(eq(inventory.variantId, variantId));
    await putCart(customerId, 1);
    const { orderNumber } = await createCustomerOrder(customer, { addressId, method: "COD" });
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    orderIds.push(order.id);

    const placed = await getCustomerOrderNotifications(customer);
    assert.ok(placed.some((notice) => notice.orderId === order.id && notice.message === `Order #${orderNumber} has been placed.`));
    assert.equal((await getCustomerOrderNotifications(secondCustomer)).some((notice) => notice.orderId === order.id), false);

    for (const [status, expectedMessage] of [
      ["CONFIRMED", `Order #${orderNumber} has been confirmed.`],
      ["PACKED", `Order #${orderNumber} is processing.`],
      ["SHIPPED", `Order #${orderNumber} has been shipped.`],
      ["DELIVERED", `Order #${orderNumber} has been delivered.`],
    ] as const) {
      await updateAdminOrderStatus(admin, { orderId: order.id, status, note: "Test lifecycle update" });
      const notifications = await getCustomerOrderNotifications(customer);
      assert.ok(notifications.some((notice) => notice.orderId === order.id && notice.message === expectedMessage));
    }
  });

  await t.test("COD becomes paid only on delivery, is idempotent, and customer order details reflect it", async () => {
    await db.update(inventory).set({ onHand: 10, reserved: 0 }).where(eq(inventory.variantId, variantId));
    await putCart(customerId, 1);
    const { orderNumber } = await createCustomerOrder(customer, { addressId, method: "COD" });
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    orderIds.push(order.id);

    const [createdPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    assert.equal(order.paymentStatus, "UNPAID");
    assert.equal(createdPayment.status, "UNPAID");

    for (const status of ["CONFIRMED", "PACKED", "SHIPPED"] as const) {
      await updateAdminOrderStatus(admin, { orderId: order.id, status, note: "COD collection lifecycle" });
      const [currentOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
      const [currentPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
      assert.equal(currentOrder.paymentStatus, "UNPAID", `${status} keeps COD unpaid`);
      assert.equal(currentPayment.status, "UNPAID", `${status} keeps the COD payment record unpaid`);
    }

    await updateAdminOrderStatus(admin, { orderId: order.id, status: "DELIVERED", note: "Cash collected" });
    const [deliveredOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    const [paidPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    const customerOrder = await getCustomerOrder(customerId, order.id);
    assert.equal(deliveredOrder.status, "DELIVERED");
    assert.equal(deliveredOrder.paymentStatus, "PAID");
    assert.equal(paidPayment.status, "PAID");
    assert.equal(customerOrder?.order.paymentStatus, "PAID", "customer order details display the resulting payment status");

    await updateAdminOrderStatus(admin, { orderId: order.id, status: "DELIVERED", note: "Repeated delivery submission" });
    assert.equal(await db.$count(orderStatusEvents, and(eq(orderStatusEvents.orderId, order.id), eq(orderStatusEvents.toStatus, "DELIVERED"))), 1);
    assert.equal(await db.$count(notificationEvents, eq(notificationEvents.dedupeKey, `${order.id}:status:DELIVERED`)), 1);
    const [stillPaidPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    assert.equal(stillPaidPayment.status, "PAID");

    await putCart(customerId, 1);
    const alreadyPaidResult = await createCustomerOrder(customer, { addressId, method: "COD" });
    const [alreadyPaidOrder] = await db.select().from(orders).where(eq(orders.orderNumber, alreadyPaidResult.orderNumber)).limit(1);
    orderIds.push(alreadyPaidOrder.id);
    await db.update(orders).set({ paymentStatus: "PAID" }).where(eq(orders.id, alreadyPaidOrder.id));
    await db.update(paymentRecords).set({ status: "PAID" }).where(eq(paymentRecords.orderId, alreadyPaidOrder.id));
    for (const status of ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] as const) {
      await updateAdminOrderStatus(admin, { orderId: alreadyPaidOrder.id, status, note: "Already collected" });
    }
    const [preservedPaidOrder] = await db.select().from(orders).where(eq(orders.id, alreadyPaidOrder.id)).limit(1);
    const [preservedPaidRecord] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, alreadyPaidOrder.id)).limit(1);
    assert.equal(preservedPaidOrder.paymentStatus, "PAID");
    assert.equal(preservedPaidRecord.status, "PAID");
  });

  await t.test("customer cancellation is retained, hidden from active orders, and notifies both audiences once", async () => {
    await db.update(inventory).set({ onHand: 10, reserved: 0 }).where(eq(inventory.variantId, variantId));
    await putCart(customerId, 1);
    const { orderNumber } = await createCustomerOrder(customer, { addressId, method: "COD" });
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
    orderIds.push(order.id);
    const stockAfterOrder = await inventoryOnHand();

    await assert.rejects(() => cancelCustomerOrder(secondCustomer, order.id), /Order not found/i);
    assert.equal(await db.$count(notificationEvents, eq(notificationEvents.orderId, order.id)), 3, "only order-placed/customer and admin checkout events exist after failed cancellation");

    await cancelCustomerOrder(customer, order.id);
    assert.equal(await inventoryOnHand(), stockAfterOrder + 1);
    const [cancelled] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.paymentStatus, "UNPAID", "cancelling an unpaid COD order does not mark it paid");
    const [cancelledPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    assert.equal(cancelledPayment.status, "UNPAID");
    assert.ok(await getCustomerOrder(customerId, order.id), "cancelled order remains available to its owner for history");
    assert.equal(await getCustomerOrder(secondCustomerId, order.id), null, "another customer cannot access the cancelled order");
    assert.equal((await getCustomerOrders(customerId)).some((entry) => entry.id === order.id), false, "cancelled order is excluded from active My Orders");

    const customerCancellationEvents = await db.select().from(notificationEvents).where(and(
      eq(notificationEvents.orderId, order.id), eq(notificationEvents.eventType, "ORDER_CANCELLED"), eq(notificationEvents.userId, customerId),
    ));
    const adminCancellationEvents = await db.select().from(notificationEvents).where(and(
      eq(notificationEvents.orderId, order.id), eq(notificationEvents.eventType, "ORDER_CANCELLED"), isNull(notificationEvents.userId),
    ));
    assert.equal(customerCancellationEvents.length, 1);
    assert.equal(adminCancellationEvents.length, 1);
    assert.deepEqual(adminCancellationEvents[0].payload, {
      orderNumber, fromStatus: "PLACED", toStatus: "CANCELLED", customerName: "Checkout Customer", cancelledBy: "Checkout Customer",
    });

    const customerNotices = await getCustomerOrderNotifications(customer);
    assert.equal(customerNotices.filter((notice) => notice.orderId === order.id && notice.message === `Order #${orderNumber} has been cancelled.`).length, 1);
    assert.equal((await getCustomerOrderNotifications(secondCustomer)).some((notice) => notice.orderId === order.id), false);
    const adminAlerts = await listAdminOrderAlerts(admin);
    const cancellationAlert = adminAlerts.items.find((alert) => alert.id === adminCancellationEvents[0].id);
    assert.ok(cancellationAlert);
    assert.equal(cancellationAlert.description, `Order #${orderNumber} was cancelled by Checkout Customer.`);
    assert.equal((await getAdminOrders({ query: orderNumber })).some((entry) => entry.order.id === order.id && entry.order.status === "CANCELLED"), true);

    await assert.rejects(() => cancelCustomerOrder(customer, order.id), /can no longer be cancelled/i);
    assert.equal(await inventoryOnHand(), stockAfterOrder + 1, "repeated cancellation does not restore stock twice");
    assert.equal(await db.$count(notificationEvents, eq(notificationEvents.dedupeKey, `${order.id}:cancelled`)), 1);
    assert.equal(await db.$count(notificationEvents, eq(notificationEvents.dedupeKey, `${order.id}:admin-cancelled`)), 1);
  });
});
