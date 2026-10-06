import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db";
import { addresses, cartItems, carts, categories, inventory, notificationEvents, orderItems, orders, paymentRecords, productVariants, products, storeSettings, user } from "@/db/schema";
import { AuthorizationError } from "@/lib/authz";
import { createCustomerOrder } from "@/lib/commerce/checkout";
import { KhaltiPaymentProvider, KhaltiRequestError, isKhaltiPaymentConfigured } from "@/lib/commerce/khalti-provider";
import type { CreatePaymentRequest, PaymentProvider, ProviderVerification } from "@/lib/commerce/payment-provider";
import { verifyKhaltiReturn } from "@/lib/commerce/payment-processing";
import { updateAdminOrderStatus } from "@/lib/commerce/order-management";

const db = getDatabase();
const tag = randomUUID();
const customerId = `khalti-customer-${tag}`;
const otherCustomerId = `khalti-other-${tag}`;
const adminId = `khalti-admin-${tag}`;
const categorySlug = `khalti-${tag}`;
const customer = { userId: customerId, role: "CUSTOMER" };
const otherCustomer = { userId: otherCustomerId, role: "CUSTOMER" };
const requests = new Map<string, CreatePaymentRequest>();
const results = new Map<string, ProviderVerification>();
let addressId = "";
let productId = "";
let variantId = "";
let categoryId = "";
let cartId = "";
let onlineOrderId = "";
const orderIds: string[] = [];

const fakeProvider: PaymentProvider = {
  id: "khalti",
  isConfigured: () => true,
  async createPayment(request) {
    const pidx = `pidx-${tag}-${requests.size}`;
    requests.set(pidx, request);
    return { providerReference: pidx, redirectUrl: "https://test-pay.khalti.com/?pidx=" + pidx };
  },
  async verifyPayment(pidx) {
    const result = results.get(pidx);
    if (!result) throw new Error("Unexpected pidx");
    return result;
  },
};

async function addCart(quantity = 1) {
  const [cart] = await db.insert(carts).values({ userId: customerId }).onConflictDoUpdate({ target: carts.userId, set: { updatedAt: new Date() } }).returning({ id: carts.id });
  cartId = cart.id;
  await db.insert(cartItems).values({ cartId, variantId, quantity }).onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity, updatedAt: new Date() } });
}

before(async () => {
  await db.insert(storeSettings).values({ id: 1, storeName: "Khalti test store", currency: "NPR", locale: "ne-NP", timeZone: "Asia/Kathmandu", lowStockThreshold: 5, shippingChargePaisa: 4567n, freeShippingThresholdPaisa: null, codEnabled: true, storeActive: true }).onConflictDoUpdate({ target: storeSettings.id, set: { shippingChargePaisa: 4567n, freeShippingThresholdPaisa: null, codEnabled: true, storeActive: true } });
  await db.insert(user).values([
    { id: customerId, name: "Khalti Customer", email: `${customerId}@example.test`, role: "CUSTOMER" },
    { id: otherCustomerId, name: "Other Customer", email: `${otherCustomerId}@example.test`, role: "CUSTOMER" },
    { id: adminId, name: "Khalti Admin", email: `${adminId}@example.test`, role: "ADMIN" },
  ]);
  const [category] = await db.insert(categories).values({ name: "Khalti test", slug: categorySlug, active: true }).returning();
  categoryId = category.id;
  const [product] = await db.insert(products).values({ categoryId, name: "Payment Test Shirt", slug: `${categorySlug}-product`, active: true, basePricePaisa: 45000n }).returning();
  productId = product.id;
  const [variant] = await db.insert(productVariants).values({ productId, sku: `KHALTI-${tag}`, pricePaisa: 45000n, active: true }).returning();
  variantId = variant.id;
  await db.insert(inventory).values({ variantId, onHand: 10, reserved: 0 });
  const [address] = await db.insert(addresses).values({ userId: customerId, fullName: "Khalti Customer", phoneNumber: "+9779841234567", province: "Koshi", district: "Morang", municipality: "Biratnagar Metropolitan City", wardNumber: 3, toleArea: "Test Tole", streetAddress: "12 Test Street", postalCode: null, isDefault: true }).returning();
  addressId = address.id;
});

after(async () => {
  if (orderIds.length) {
    await db.delete(notificationEvents).where(inArray(notificationEvents.orderId, orderIds));
    await db.delete(paymentRecords).where(inArray(paymentRecords.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.id, orderIds));
  }
  if (cartId) await db.delete(carts).where(eq(carts.id, cartId));
  if (addressId) await db.delete(addresses).where(eq(addresses.id, addressId));
  if (productId) await db.delete(products).where(eq(products.id, productId));
  if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId));
  await db.delete(storeSettings).where(eq(storeSettings.id, 1));
  await db.delete(user).where(inArray(user.id, [customerId, otherCustomerId, adminId]));
});

test("Khalti adapter uses its documented server initiation and lookup contract", async () => {
  const saved = {
    secret: process.env.KHALTI_SECRET_KEY,
    environment: process.env.KHALTI_ENVIRONMENT,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  };
  process.env.KHALTI_SECRET_KEY = "test-only-secret";
  process.env.KHALTI_ENVIRONMENT = "sandbox";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith("/initiate/")) return Response.json({ pidx: "test-pidx", payment_url: "https://test-pay.khalti.com/?pidx=test-pidx" });
    return Response.json({ pidx: "test-pidx", total_amount: 45567, status: "Completed", transaction_id: "provider-txn-1", fee: 0, refunded: false });
  };
  try {
    const provider = new KhaltiPaymentProvider(fetcher);
    assert.equal(provider.isConfigured(), true);
    const payment = await provider.createPayment({ orderNumber: "NFS-TEST123456", amountPaisa: 45567n, currency: "NPR", returnUrl: "http://localhost:3000/api/payments/khalti/return", websiteUrl: "http://localhost:3000" });
    assert.equal(payment.providerReference, "test-pidx");
    assert.match(payment.redirectUrl, /^https:\/\/test-pay\.khalti\.com\//);
    assert.equal(calls[0]?.url, "https://dev.khalti.com/api/v2/epayment/initiate/");
    assert.equal(new Headers(calls[0]?.init?.headers).get("authorization"), "Key test-only-secret");
    const initiationBody = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    assert.equal(initiationBody.amount, 45567);
    assert.equal(initiationBody.purchase_order_id, "NFS-TEST123456");
    const verification = await provider.verifyPayment("test-pidx");
    assert.equal(calls[1]?.url, "https://dev.khalti.com/api/v2/epayment/lookup/");
    assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { pidx: "test-pidx" });
    assert.equal(verification.amountPaisa, 45567n);
    assert.equal(verification.transactionReference, "provider-txn-1");
    assert.equal(verification.outcome, "PAID");
  } finally {
    if (saved.secret === undefined) delete process.env.KHALTI_SECRET_KEY; else process.env.KHALTI_SECRET_KEY = saved.secret;
    if (saved.environment === undefined) delete process.env.KHALTI_ENVIRONMENT; else process.env.KHALTI_ENVIRONMENT = saved.environment;
    if (saved.appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = saved.appUrl;
  }
});

test("Khalti payment lifecycle is owner-scoped, server-priced, transactional, and idempotent", async (t) => {
  await t.test("missing Khalti credentials disable online payment while COD stays usable", async () => {
    const previousSecret = process.env.KHALTI_SECRET_KEY;
    delete process.env.KHALTI_SECRET_KEY;
    try {
      assert.equal(isKhaltiPaymentConfigured(), false);
      await assert.rejects(() => createCustomerOrder(customer, { addressId, method: "PROVIDER" }), /not configured/i);
      await addCart();
      const cod = await createCustomerOrder(customer, { addressId, method: "COD" });
      const [order] = await db.select().from(orders).where(eq(orders.orderNumber, cod.orderNumber)).limit(1);
      orderIds.push(order.id);
      assert.equal(order.paymentMethod, "COD");
      assert.equal(order.paymentStatus, "UNPAID");
    } finally {
      if (previousSecret === undefined) delete process.env.KHALTI_SECRET_KEY; else process.env.KHALTI_SECRET_KEY = previousSecret;
    }
  });

  await t.test("initiation derives amount from saved server totals and rejects cross-account or manipulated requests", async () => {
    await addCart(2);
    await assert.rejects(() => createCustomerOrder({ userId: customerId, role: "ADMIN" }, { addressId, method: "PROVIDER" }, fakeProvider), (error) => error instanceof AuthorizationError && error.status === 403);
    await assert.rejects(() => createCustomerOrder(customer, { addressId, method: "PROVIDER", amountPaisa: "1" }, fakeProvider), /review your delivery address/i);
    await assert.rejects(() => createCustomerOrder(customer, { addressId: randomUUID(), method: "PROVIDER" }, fakeProvider), /saved delivery addresses/i);
    const result = await createCustomerOrder(customer, { addressId, method: "PROVIDER" }, fakeProvider);
    assert.equal(result.paymentMethod, "PROVIDER");
    assert.match(result.redirectUrl ?? "", /^https:\/\/test-pay\.khalti\.com\//);
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, result.orderNumber)).limit(1);
    orderIds.push(order.id);
    onlineOrderId = order.id;
    assert.equal(order.paymentMethod, "PROVIDER");
    assert.equal(order.paymentStatus, "PENDING");
    assert.equal(order.totalPaisa, 94567n);
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    assert.equal(payment.amountPaisa, order.totalPaisa);
    assert.equal(payment.providerReference, `pidx-${tag}-0`);
    assert.equal(requests.get(payment.providerReference)?.amountPaisa, 94567n);
    const eventTypes = await db.select({ eventType: notificationEvents.eventType }).from(notificationEvents).where(eq(notificationEvents.orderId, order.id));
    assert.deepEqual(new Set(eventTypes.map((event) => event.eventType)), new Set(["ORDER_PLACED", "NEW_ORDER"]));

    await assert.rejects(() => verifyKhaltiReturn(otherCustomer, { pidx: payment.providerReference, purchaseOrderId: order.orderNumber }, fakeProvider), /payment could not be found/i);
    await assert.rejects(() => verifyKhaltiReturn(customer, { pidx: payment.providerReference, purchaseOrderId: "NFS-WRONG" }, fakeProvider), /payment could not be found/i);
  });

  await t.test("lookup amount mismatch stays pending; valid lookup pays once and duplicate callback is harmless", async () => {
    const [order] = await db.select().from(orders).where(eq(orders.id, onlineOrderId)).limit(1);
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    results.set(payment.providerReference!, { providerReference: payment.providerReference!, transactionReference: null, amountPaisa: payment.amountPaisa, outcome: "PENDING" });
    const pending = await verifyKhaltiReturn(customer, { pidx: payment.providerReference, purchaseOrderId: order.orderNumber }, fakeProvider);
    assert.equal(pending.result, "PENDING");
    assert.equal((await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id)))[0]?.status, "PENDING");
    for (const status of ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] as const) {
      await updateAdminOrderStatus({ userId: adminId, role: "ADMIN" }, { orderId: order.id, status, note: "Delivery does not verify Khalti payment" });
    }
    const [deliveredPendingOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    const [deliveredPendingPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id)).limit(1);
    assert.equal(deliveredPendingOrder.status, "DELIVERED");
    assert.equal(deliveredPendingOrder.paymentStatus, "PENDING", "delivery does not mark Khalti as paid");
    assert.equal(deliveredPendingPayment.status, "PENDING");
    results.set(payment.providerReference!, { providerReference: payment.providerReference!, transactionReference: "provider-txn-2", amountPaisa: payment.amountPaisa + 1n, outcome: "PAID" });
    const mismatch = await verifyKhaltiReturn(customer, { pidx: payment.providerReference, purchaseOrderId: order.orderNumber, transactionReference: "provider-txn-2" }, fakeProvider);
    assert.equal(mismatch.result, "VERIFICATION_FAILED");
    assert.equal((await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id)))[0]?.status, "PENDING");

    results.set(payment.providerReference!, { providerReference: payment.providerReference!, transactionReference: "provider-txn-2", amountPaisa: payment.amountPaisa, outcome: "PAID" });
    const success = await verifyKhaltiReturn(customer, { pidx: payment.providerReference, purchaseOrderId: order.orderNumber, transactionReference: "provider-txn-2" }, fakeProvider);
    assert.equal(success.result, "PAID");
    const [paidOrder] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    const [paidPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id)).limit(1);
    assert.equal(paidOrder.paymentStatus, "PAID");
    assert.equal(paidOrder.totalPaisa, 94567n);
    assert.equal(paidPayment.status, "PAID");
    assert.equal(paidPayment.providerTransactionId, "provider-txn-2");
    const paidEvents = await db.select().from(notificationEvents).where(and(eq(notificationEvents.orderId, order.id), eq(notificationEvents.eventType, "ONLINE_PAYMENT_SUCCESS")));
    assert.equal(paidEvents.length, 1);
    const duplicate = await verifyKhaltiReturn(customer, { pidx: payment.providerReference, purchaseOrderId: order.orderNumber, transactionReference: "provider-txn-2" }, fakeProvider);
    assert.equal(duplicate.result, "PAID");
    assert.equal((await db.select().from(notificationEvents).where(and(eq(notificationEvents.orderId, order.id), eq(notificationEvents.eventType, "ONLINE_PAYMENT_SUCCESS")))).length, 1);
    assert.equal(await db.$count(orderItems, eq(orderItems.orderId, order.id)), 1);
  });

  await t.test("provider-reported failure cancels and restores stock once", async () => {
    await addCart(1);
    const result = await createCustomerOrder(customer, { addressId, method: "PROVIDER" }, fakeProvider);
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, result.orderNumber)).limit(1);
    orderIds.push(order.id);
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    const [before] = await db.select().from(inventory).where(eq(inventory.variantId, variantId)).limit(1);
    results.set(payment.providerReference!, { providerReference: payment.providerReference!, transactionReference: null, amountPaisa: payment.amountPaisa, outcome: "FAILED" });
    const failed = await verifyKhaltiReturn(customer, { pidx: payment.providerReference, purchaseOrderId: order.orderNumber }, fakeProvider);
    assert.equal(failed.result, "FAILED");
    const [afterFailure] = await db.select().from(inventory).where(eq(inventory.variantId, variantId)).limit(1);
    const [cancelled] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    assert.equal(afterFailure.onHand, before.onHand + 1);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.paymentStatus, "FAILED");
    await verifyKhaltiReturn(customer, { pidx: payment.providerReference, purchaseOrderId: order.orderNumber }, fakeProvider);
    const [afterDuplicate] = await db.select().from(inventory).where(eq(inventory.variantId, variantId)).limit(1);
    assert.equal(afterDuplicate.onHand, afterFailure.onHand);
    const failureEvents = await db.select().from(notificationEvents).where(and(eq(notificationEvents.orderId, order.id), eq(notificationEvents.eventType, "PAYMENT_FAILURE")));
    assert.equal(failureEvents.length, 1);
  });

  await t.test("documented provider rejection records failure without leaving inventory stuck", async () => {
    const rejectingProvider: PaymentProvider = {
      ...fakeProvider,
      async createPayment() { throw new KhaltiRequestError(400); },
    };
    await addCart();
    const [before] = await db.select().from(inventory).where(eq(inventory.variantId, variantId)).limit(1);
    const result = await createCustomerOrder(customer, { addressId, method: "PROVIDER" }, rejectingProvider);
    assert.equal(result.redirectUrl, null);
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, result.orderNumber)).limit(1);
    orderIds.push(order.id);
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.id)).limit(1);
    const [after] = await db.select().from(inventory).where(eq(inventory.variantId, variantId)).limit(1);
    assert.equal(payment.status, "FAILED");
    assert.equal(order.paymentStatus, "FAILED");
    assert.equal(order.status, "CANCELLED");
    assert.equal(after.onHand, before.onHand);
  });
});
