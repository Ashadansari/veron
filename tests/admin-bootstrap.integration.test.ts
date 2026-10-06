import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { account, session, user } from "@/db/schema";
import { assertRole, AuthorizationError } from "@/lib/authz";
import { getAuth } from "@/lib/auth";
import { createFirstAdmin, inspectAdminEmail, recoverCustomerAsFirstAdmin } from "../scripts/first-admin-service";
import { testOrigin } from "./test-origin";

const db = getDatabase();
const email = `first-admin-${randomUUID()}@example.test`;
let adminId = "";

test("controlled recovery promotes the existing CUSTOMER identity with a valid Better Auth credential", async () => {
  const recoveryEmail = `Staging-Recovery-${randomUUID()}@example.test`;
  const customerId = `recovery-customer-${randomUUID()}`;
  const oldCredential = await hashPassword("OldCustomerPass123");
  await db.insert(user).values({
    id: customerId,
    name: "Existing Customer",
    email: recoveryEmail,
    role: "CUSTOMER",
    emailVerified: true,
  });
  await db.insert(account).values({
    id: `recovery-account-${randomUUID()}`,
    accountId: customerId,
    providerId: "credential",
    userId: customerId,
    password: oldCredential,
  });
  await db.insert(session).values({
    id: `recovery-session-${randomUUID()}`,
    token: `recovery-token-${randomUUID()}`,
    expiresAt: new Date(Date.now() + 60_000),
    userId: customerId,
  });

  try {
    assert.deepEqual(await inspectAdminEmail(recoveryEmail.toLowerCase()), {
      exists: true,
      role: "CUSTOMER",
      deleted: false,
    });
    await assert.rejects(
      () => createFirstAdmin({ name: "Duplicate Owner", email: recoveryEmail.toLowerCase(), password: "DuplicateOwnerPass123" }),
      /account with this email already exists/i,
    );
    const [unchangedCustomer] = await db.select().from(user).where(eq(user.id, customerId)).limit(1);
    assert.equal(unchangedCustomer.role, "CUSTOMER", "normal bootstrap must not silently promote a customer");

    const result = await recoverCustomerAsFirstAdmin({
      email: recoveryEmail.toUpperCase(),
      password: "RecoveredOwnerPass456",
    });
    assert.equal(result.id, customerId);
    assert.equal(result.email, recoveryEmail.toLowerCase());

    const [recovered] = await db.select().from(user).where(eq(user.id, customerId)).limit(1);
    assert.ok(recovered);
    assert.equal(recovered.role, "ADMIN");
    assert.equal(recovered.email, recoveryEmail.toLowerCase());
    assert.equal(await db.$count(user, sql`lower(${user.email}) = ${recoveryEmail.toLowerCase()}`), 1);
    assert.equal(await db.$count(session, eq(session.userId, customerId)), 0);

    const [newCredential] = await db.select().from(account).where(eq(account.userId, customerId)).limit(1);
    assert.ok(newCredential?.password);
    assert.notEqual(newCredential.password, oldCredential);

    const auth = getAuth();
    const oldLogin = await auth.handler(new Request(`${testOrigin}/api/auth/sign-in/email`, {
      method: "POST", headers: { origin: testOrigin, "content-type": "application/json" },
      body: JSON.stringify({ email: recoveryEmail.toLowerCase(), password: "OldCustomerPass123" }),
    }));
    assert.equal(oldLogin.status, 401);

    const login = await auth.handler(new Request(`${testOrigin}/api/auth/sign-in/email`, {
      method: "POST", headers: { origin: testOrigin, "content-type": "application/json" },
      body: JSON.stringify({ email: recoveryEmail.toLowerCase(), password: "RecoveredOwnerPass456" }),
    }));
    assert.equal(login.status, 200);
    const loginBody = await login.json() as { user?: { id?: string; role?: string } };
    assert.equal(loginBody.user?.id, customerId);
    assert.equal(loginBody.user?.role, "ADMIN");

    await assert.rejects(
      () => recoverCustomerAsFirstAdmin({ email: recoveryEmail, password: "DifferentOwnerPass789" }),
      /already an administrator/i,
    );
    const [unchangedCredential] = await db.select().from(account).where(eq(account.userId, customerId)).limit(1);
    assert.equal(unchangedCredential.password, newCredential.password, "recovery must not reset an existing ADMIN credential");
  } finally {
    await db.delete(user).where(eq(user.id, customerId));
  }
});

after(async () => {
  if (adminId) await db.delete(user).where(eq(user.id, adminId));
});

test("first-admin bootstrap creates a Better Auth credential only once", async () => {
  const created = await createFirstAdmin({ name: "Store Owner", email, password: "SecureOwnerPass123" });
  adminId = created.id;
  assert.equal(created.email, email);
  const [savedUser] = await db.select().from(user).where(eq(user.id, adminId)).limit(1);
  const [credential] = await db.select().from(account).where(eq(account.userId, adminId)).limit(1);
  assert.equal(savedUser.role, "ADMIN");
  assert.equal(savedUser.emailVerified, false);
  assert.ok(credential?.password);
  assert.notEqual(credential.password, "SecureOwnerPass123");
  assert.match(credential.password, /^[a-f\d]{32}:[a-f\d]{128}$/i);

  const auth = getAuth();
  const login = await auth.handler(new Request(`${testOrigin}/api/auth/sign-in/email`, {
    method: "POST", headers: { origin: testOrigin, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "SecureOwnerPass123" }),
  }));
  assert.equal(login.status, 200);
  const loginBody = await login.json() as { token?: string | null; response?: unknown; user?: { id?: string; role?: string } };
  assert.equal(loginBody.token ?? null, null);
  assert.equal("response" in loginBody, false, "successful admin response must not be wrapped in a response property");
  assert.equal(loginBody.user?.id, adminId);
  assert.equal(loginBody.user?.role, "ADMIN");
  const sessionCookie = login.headers.getSetCookie().find((value) => value.startsWith("better-auth.session_token="));
  assert.ok(sessionCookie, "successful login should set the Better Auth session cookie");
  const sessionResponse = await auth.handler(new Request(`${testOrigin}/api/auth/get-session`, {
    headers: { cookie: sessionCookie.split(";")[0] },
  }));
  const sessionBody = await sessionResponse.json() as { user: { id: string; role: string } };
  assert.equal(sessionBody.user.id, adminId);
  assert.equal(sessionBody.user.role, "ADMIN");
  assert.doesNotThrow(() => assertRole(sessionBody.user.role, "ADMIN"));
  assert.throws(() => assertRole("CUSTOMER", "ADMIN"), (error) => error instanceof AuthorizationError && error.status === 403);

  await assert.rejects(() => createFirstAdmin({ name: "Second Owner", email: `second-${email}`, password: "SecureOwnerPass123" }), /administrator already exists/i);
  assert.equal(await db.$count(user, eq(user.role, "ADMIN")), 1);
});
