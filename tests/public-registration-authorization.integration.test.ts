import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { hashPassword } from "better-auth/crypto";
import { inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { account, user } from "@/db/schema";
import { POST as registerCustomer } from "@/app/api/register/route";
import { testHost, testOrigin } from "./test-origin";

const origin = testOrigin;
const db = getDatabase();
const userIds: string[] = [];

async function register(email: string) {
  return registerCustomer(new Request(`${origin}/api/register`, {
    method: "POST",
    headers: { origin, host: testHost, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Registration Attempt",
      email,
      password: "StrongRegisterPass123",
      passwordConfirmation: "StrongRegisterPass123",
    }),
  }));
}

after(async () => {
  if (userIds.length) await db.delete(user).where(inArray(user.id, userIds));
});

test("public registration rejects existing admin and customer identities without changing either account", async () => {
  const suffix = randomUUID();
  const adminId = `registration-admin-${suffix}`;
  const customerId = `registration-customer-${suffix}`;
  const storedAdminEmail = `Existing-Admin-${suffix}@example.test`;
  const storedCustomerEmail = `Existing-Customer-${suffix}@example.test`;
  const adminCredential = await hashPassword("PrivateFixturePass123");
  userIds.push(adminId, customerId);

  await db.insert(user).values([
    { id: adminId, name: "Existing Admin", email: storedAdminEmail, role: "ADMIN", emailVerified: true },
    { id: customerId, name: "Existing Customer", email: storedCustomerEmail, role: "CUSTOMER", emailVerified: true },
  ]);
  await db.insert(account).values({
    id: `registration-account-${suffix}`,
    accountId: adminId,
    providerId: "credential",
    userId: adminId,
    password: adminCredential,
  });

  const adminAttempt = await register(storedAdminEmail.toLowerCase());
  assert.equal(adminAttempt.status, 409);
  assert.deepEqual(await adminAttempt.json(), {
    error: "An account with this email already exists. Please log in.",
  });
  const differentlyCasedAdminAttempt = await register(storedAdminEmail.toUpperCase());
  assert.equal(differentlyCasedAdminAttempt.status, 409);

  const customerEmail = storedCustomerEmail.toLowerCase();
  const customerAttempt = await register(customerEmail);
  assert.equal(customerAttempt.status, 409);
  assert.deepEqual(await customerAttempt.json(), {
    error: "An account with this email already exists. Please log in.",
  });
  const differentlyCasedCustomerAttempt = await register(storedCustomerEmail.toUpperCase());
  assert.equal(differentlyCasedCustomerAttempt.status, 409);

  const [adminAfter] = await db.select().from(user).where(eqEmail(storedAdminEmail)).limit(1);
  assert.ok(adminAfter);
  assert.equal(adminAfter.id, adminId);
  assert.equal(adminAfter.role, "ADMIN");
  assert.equal(adminAfter.email, storedAdminEmail);
  assert.equal(await db.$count(user, sql`lower(${user.email}) = ${storedAdminEmail.toLowerCase()}`), 1);

  const [credentialAfter] = await db.select({ password: account.password }).from(account).where(sql`${account.userId} = ${adminId}`).limit(1);
  assert.ok(credentialAfter?.password === adminCredential, "the existing admin credential must remain unchanged");
  assert.equal(await db.$count(user, sql`lower(${user.email}) = ${customerEmail}`), 1);
  const [customerAfter] = await db.select().from(user).where(eqEmail(storedCustomerEmail)).limit(1);
  assert.ok(customerAfter);
  assert.equal(customerAfter.id, customerId);
  assert.equal(customerAfter.role, "CUSTOMER");
});

function eqEmail(email: string) {
  return sql`lower(${user.email}) = ${email.toLowerCase()}`;
}
