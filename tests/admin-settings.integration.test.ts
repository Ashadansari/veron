import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { storeSettings, user } from "@/db/schema";
import { AuthorizationError } from "@/lib/authz";
import { saveAdminStoreSettings } from "@/lib/admin/settings-service";

const db = getDatabase();
const tag = randomUUID();
const adminId = `settings-admin-${tag}`;
const customerId = `settings-customer-${tag}`;
const values = {
  storeName: "Naj Fancy Nepal", contactEmail: "hello@example.test", contactPhone: "9841234567",
  shippingChargeNpr: "200.50", freeShippingThresholdNpr: "3000", codEnabled: false, storeActive: true,
};

before(async () => {
  await db.insert(user).values([
    { id: adminId, name: "Settings Admin", email: `${adminId}@example.test`, role: "ADMIN" },
    { id: customerId, name: "Settings Customer", email: `${customerId}@example.test`, role: "CUSTOMER" },
  ]);
});

after(async () => {
  await db.delete(storeSettings).where(eq(storeSettings.id, 1));
  await db.delete(user).where(eq(user.id, adminId));
  await db.delete(user).where(eq(user.id, customerId));
});

test("store settings require ADMIN and persist validated NPR defaults", async () => {
  await assert.rejects(
    () => saveAdminStoreSettings({ userId: "", role: "" }, values),
    (error) => error instanceof AuthorizationError && error.status === 401,
  );
  await assert.rejects(
    () => saveAdminStoreSettings({ userId: customerId, role: "CUSTOMER" }, values),
    (error) => error instanceof AuthorizationError && error.status === 403,
  );
  assert.equal((await db.select().from(storeSettings).where(eq(storeSettings.id, 1))).length, 0);

  await saveAdminStoreSettings({ userId: adminId, role: "ADMIN" }, values);
  const [saved] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1));
  assert.equal(saved.storeName, "Naj Fancy Nepal");
  assert.equal(saved.currency, "NPR");
  assert.equal(saved.contactPhone, "+9779841234567");
  assert.equal(saved.shippingChargePaisa, 20050n);
  assert.equal(saved.freeShippingThresholdPaisa, 300000n);
  assert.equal(saved.codEnabled, false);
  assert.equal(saved.storeActive, true);

  await assert.rejects(() => saveAdminStoreSettings({ userId: adminId, role: "ADMIN" }, { ...values, shippingChargeNpr: "1.001" }), /valid NPR amounts/i);
});
