import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db";
import { account, addresses, orders, session, user } from "@/db/schema";
import { anonymizeCustomerAccount, deleteCustomerAddress, saveCustomerAddress, saveCustomerProfile } from "@/lib/account-service";
import { assertRole, AuthorizationError } from "@/lib/authz";
import { getAuth } from "@/lib/auth";
import { getCustomerOrder } from "@/lib/commerce/customer-queries";
import { deactivateAdminCustomer } from "@/lib/admin/customer-service";
import { POST as registerCustomer } from "@/app/api/register/route";
import { testHost, testOrigin } from "./test-origin";

const origin = testOrigin;
const auth = getAuth();
const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];

function request(path: string, body?: unknown, cookie?: string) {
  return auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

function getCookie(response: Response) {
  return getSetCookie(response).split(";")[0];
}

function getSetCookie(response: Response) {
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith("better-auth.session_token="));
  assert.ok(cookie, "expected Better Auth to set its session cookie");
  return cookie;
}

async function signup(email: string, role?: string, password = "StrongTestPass123", passwordConfirmation = password) {
  const details = {
    name: "Test Customer",
    email,
    password,
    passwordConfirmation,
    emailVerified: true,
    ...(role ? { role } : {}),
  };
  const response = await registerCustomer(new Request(`${origin}/api/register`, {
    method: "POST", headers: { origin, host: testHost, "content-type": "application/json" }, body: JSON.stringify(details),
  }));
  return { response, body: await response.json() as Record<string, unknown> };
}

async function login(email: string, password = "StrongTestPass123") {
  const response = await request("/sign-in/email", { email, password });
  return { response, body: await response.json() as Record<string, unknown> };
}

function assertHttpOnly(response: Response) {
  const cookie = getSetCookie(response);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  return getCookie(response);
}

after(async () => {
  if (createdOrderIds.length) {
    await getDatabase().delete(orders).where(inArray(orders.id, createdOrderIds));
  }
  if (createdUserIds.length) {
    await getDatabase().delete(user).where(inArray(user.id, createdUserIds));
  }
});

test("Better Auth registration, sessions, customer ownership, and account lifecycle", async (t) => {
  const suffix = randomUUID();
  const emailA = `phase4-a-${suffix}@example.test`;
  const emailB = `phase4-b-${suffix}@example.test`;

  await t.test("valid registration creates a usable CUSTOMER and an immediate secure session", async () => {
    const { response, body } = await signup(emailA, "ADMIN");
    const [saved] = await getDatabase().select().from(user).where(eq(user.email, emailA)).limit(1);
    if (saved) createdUserIds.push(saved.id);
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal("token" in body, false, "session tokens must not be returned by registration");
    const cookie = assertHttpOnly(response);
    assert.ok(saved);
    assert.equal(saved.role, "CUSTOMER");
    assert.equal(saved.emailVerified, false, "email is not claimed as verified without verification");
    assert.equal(await getDatabase().$count(session, eq(session.userId, saved.id)), 1);
    const sessionResponse = await request("/get-session", undefined, cookie);
    const sessionBody = await sessionResponse.json();
    assert.equal(sessionBody.user.id, saved.id);
    assert.equal(sessionBody.user.role, "CUSTOMER");
    const [credentials] = await getDatabase().select().from(account).where(eq(account.userId, saved.id)).limit(1);
    assert.ok(credentials?.password);
    assert.notEqual(credentials.password, "StrongTestPass123");
    assert.match(credentials.password, /^[a-f\d]{32}:[a-f\d]{128}$/i); // Better Auth's scrypt salt:key format
  });

  await t.test("invalid email, weak password, and duplicate email are handled safely", async () => {
    for (const malformedEmail of [`invalid-${suffix}`, "customer", "customer@"]) {
      const invalidEmail = await signup(malformedEmail, undefined);
      assert.ok(invalidEmail.response.status >= 400, `${malformedEmail} should be rejected`);
    }
    const missingFields = await registerCustomer(new Request(`${origin}/api/register`, {
      method: "POST", headers: { origin, host: testHost, "content-type": "application/json" },
      body: JSON.stringify({ name: "Test Customer", password: "StrongTestPass123", passwordConfirmation: "StrongTestPass123" }),
    }));
    assert.ok(missingFields.status >= 400);
    const weakPassword = await signup(`weak-${suffix}@example.test`, undefined, "short", "short");
    assert.ok(weakPassword.response.status >= 400);
    const mismatch = await signup(`mismatch-${suffix}@example.test`, undefined, "StrongTestPass123", "OtherStrongPass456");
    assert.ok(mismatch.response.status >= 400);
    const duplicate = await signup(emailA);
    assert.ok(duplicate.response.status >= 400, "duplicate email should be rejected");
    assert.match(String(duplicate.body.error), /already exists/i);
    assert.equal(await getDatabase().$count(user, eq(user.email, emailA)), 1);
  });

  await t.test("login, session persistence, incorrect credentials, password change, and logout", async () => {
    const [registered] = await getDatabase().select({ id: user.id }).from(user).where(eq(user.email, emailA)).limit(1);
    assert.ok(registered);
    const rejected = await login(emailA, "IncorrectPassword123");
    assert.ok(rejected.response.status >= 400);
    const signedIn = await login(emailA);
    assert.equal(signedIn.response.status, 200);
    assert.equal(signedIn.body.token ?? null, null);
    assert.equal("response" in signedIn.body, false, "login response should keep the Better Auth user at the top level");
    assert.equal((signedIn.body.user as { role?: string } | undefined)?.role, "CUSTOMER");
    const cookie = assertHttpOnly(signedIn.response);

    const sessionResponse = await request("/get-session", undefined, cookie);
    const sessionBody = await sessionResponse.json();
    assert.equal(sessionBody.user.email, emailA);
    assert.equal(sessionBody.user.role, "CUSTOMER");
    assert.equal("password" in sessionBody.user, false);

    const changed = await request("/change-password", {
      currentPassword: "StrongTestPass123", newPassword: "EvenStrongerPass456", revokeOtherSessions: true,
    }, cookie);
    assert.equal(changed.status, 200);
    assert.equal((await request("/get-session", undefined, cookie)).status, 200);
    assert.ok((await login(emailA, "StrongTestPass123")).response.status >= 400);
    const newLogin = await login(emailA, "EvenStrongerPass456");
    assert.equal(newLogin.response.status, 200);
    const newCookie = assertHttpOnly(newLogin.response);
    const logout = await request("/sign-out", {}, newCookie);
    assert.equal(logout.status, 200);
    const expiredSession = await request("/get-session", undefined, newCookie);
    assert.equal(await expiredSession.json(), null);
  });

  await t.test("profile and Nepal address mutations validate and scope data", async () => {
    const [customerA] = await getDatabase().select().from(user).where(eq(user.email, emailA)).limit(1);
    const otherSignup = await signup(emailB);
    assert.equal(otherSignup.response.status, 200);
    const [customerB] = await getDatabase().select().from(user).where(eq(user.email, emailB)).limit(1);
    assert.ok(customerA && customerB);
    createdUserIds.push(customerB.id);
    assert.equal(customerB.emailVerified, false, "registration does not claim email verification");
    await saveCustomerProfile(customerA.id, { name: "Updated Customer", phone: "9812345678" });
    const [updated] = await getDatabase().select().from(user).where(eq(user.id, customerA.id)).limit(1);
    assert.equal(updated.name, "Updated Customer");
    assert.equal(updated.phone, "+9779812345678");
    await assert.rejects(() => saveCustomerProfile(customerB.id, { name: "Other Customer", phone: "9812345678" }), /already in use/i);
    await assert.rejects(() => saveCustomerProfile(customerA.id, { name: "A", phone: "123" }));

    const address = {
      fullName: "Updated Customer", phoneNumber: "9812345678", province: "Bagmati", district: "Kathmandu",
      municipality: "Kathmandu Metropolitan City", wardNumber: 5, toleArea: "Thamel", streetAddress: "Street 1",
      postalCode: "44600", isDefault: true,
    };
    await saveCustomerAddress(customerA.id, address);
    const [firstAddress] = await getDatabase().select().from(addresses).where(eq(addresses.userId, customerA.id)).limit(1);
    assert.ok(firstAddress);
    await saveCustomerAddress(customerA.id, { ...address, addressId: firstAddress.id, toleArea: "Lazimpat" });
    const [updatedAddress] = await getDatabase().select().from(addresses).where(eq(addresses.id, firstAddress.id)).limit(1);
    assert.equal(updatedAddress.toleArea, "Lazimpat");
    await saveCustomerAddress(customerA.id, { ...address, toleArea: "Baneshwor", isDefault: true });
    const customerAddresses = await getDatabase().select().from(addresses).where(eq(addresses.userId, customerA.id));
    assert.equal(customerAddresses.filter((entry) => entry.isDefault).length, 1);
    assert.equal(customerAddresses.find((entry) => entry.id === firstAddress.id)?.isDefault, false);
    await assert.rejects(() => saveCustomerAddress(customerB.id, { ...address, addressId: firstAddress.id }));
    const secondAddress = customerAddresses.find((entry) => entry.id !== firstAddress.id);
    assert.ok(secondAddress);
    await deleteCustomerAddress(customerA.id, secondAddress.id);
    const [promoted] = await getDatabase().select().from(addresses).where(eq(addresses.id, firstAddress.id)).limit(1);
    assert.equal(promoted.isDefault, true);
    await deleteCustomerAddress(customerA.id, firstAddress.id);
    assert.equal(await getDatabase().$count(addresses, eq(addresses.id, firstAddress.id)), 0);
  });

  await t.test("customer order lookup is owner-scoped and deletion preserves anonymized history", async () => {
    const [customerA] = await getDatabase().select().from(user).where(eq(user.email, emailA)).limit(1);
    const [customerB] = await getDatabase().select().from(user).where(eq(user.email, emailB)).limit(1);
    assert.ok(customerA && customerB);
    const [order] = await getDatabase().insert(orders).values({
      orderNumber: `T-${suffix.slice(0, 20)}`,
      userId: customerB.id,
      customerName: "Historical Customer",
      customerPhone: "+9779812345678",
      paymentMethod: "COD",
      subtotalPaisa: 10000n,
      shippingPaisa: 1000n,
      totalPaisa: 11000n,
      shippingRuleName: "Test rule",
      shippingAddressSnapshot: {
        fullName: "Historical Customer", phoneNumber: "+9779812345678", province: "Bagmati",
        district: "Kathmandu", municipality: "Kathmandu", wardNumber: 5, toleArea: "Thamel", streetAddress: "Road 1",
      },
    }).returning();
    createdOrderIds.push(order.id);

    assert.equal(await getCustomerOrder(customerA.id, order.id), null);
    assert.equal((await getCustomerOrder(customerB.id, order.id))?.order.id, order.id);
    await assert.rejects(async () => assertRole("CUSTOMER", "ADMIN"), (error: unknown) => error instanceof AuthorizationError && error.status === 403);
    assert.throws(() => assertRole(undefined, "CUSTOMER"), (error: unknown) => error instanceof AuthorizationError && error.status === 401);

    const signIn = await login(emailB);
    const cookie = assertHttpOnly(signIn.response);
    const adminId = `phase9-admin-${suffix}`;
    createdUserIds.push(adminId);
    await getDatabase().insert(user).values({ id: adminId, name: "Customer Support Admin", email: `${adminId}@example.test`, role: "ADMIN" });
    await assert.rejects(() => deactivateAdminCustomer({ userId: customerA.id, role: "CUSTOMER" }, customerB.id), (error: unknown) => error instanceof AuthorizationError && error.status === 403);
    await assert.rejects(() => deactivateAdminCustomer({ userId: "", role: "" }, customerB.id), (error: unknown) => error instanceof AuthorizationError && error.status === 401);
    await assert.rejects(() => deactivateAdminCustomer({ userId: adminId, role: "ADMIN" }, adminId), /only customer accounts/i);
    await deactivateAdminCustomer({ userId: adminId, role: "ADMIN" }, customerB.id);
    assert.equal(await getDatabase().$count(session, eq(session.userId, customerB.id)), 0);
    assert.equal(await getDatabase().$count(account, eq(account.userId, customerB.id)), 0);
    const [preserved] = await getDatabase().select().from(orders).where(eq(orders.id, order.id)).limit(1);
    assert.ok(preserved);
    assert.equal(preserved.userId, null);
    assert.equal(preserved.customerName, "Deleted Customer");
    assert.equal(preserved.customerPhone, "");
    assert.equal((preserved.shippingAddressSnapshot as { fullName: string }).fullName, "Deleted Customer");
    const [tombstone] = await getDatabase().select().from(user).where(eq(user.id, customerB.id)).limit(1);
    assert.ok(tombstone.deletedAt);
    assert.equal(tombstone.role, "CUSTOMER");
    assert.match(tombstone.email, /^deleted\+.+@deleted\.invalid$/);
    assert.equal(await request("/get-session", undefined, cookie).then((response) => response.json()), null);
    assert.ok((await login(emailB)).response.status >= 400);
    await assert.rejects(() => anonymizeCustomerAccount(customerB.id), /already deactivated/i);
  });
});
