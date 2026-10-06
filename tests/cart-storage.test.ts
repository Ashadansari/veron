import assert from "node:assert/strict";
import test from "node:test";
import { getCartStorageKey } from "../src/components/storefront/cart-storage";

test("guest cart starts in a separate empty scope", () => {
  const storage = new Map<string, string>();
  const guestKey = getCartStorageKey(null);

  storage.set(getCartStorageKey("customer-a"), JSON.stringify([{ variantSku: "A-1", quantity: 1 }]));

  assert.equal(storage.get(guestKey), undefined);
  assert.notEqual(guestKey, getCartStorageKey("customer-a"));
});

test("customer cart snapshots are isolated by authenticated user", () => {
  const storage = new Map<string, string>();
  const customerAKey = getCartStorageKey("customer-a");
  const customerBKey = getCartStorageKey("customer-b");
  storage.set(customerAKey, "customer-a-items");

  assert.notEqual(customerAKey, customerBKey);
  assert.equal(storage.get(customerBKey), undefined);
  assert.equal(storage.get(getCartStorageKey(null)), undefined);
  assert.equal(storage.get(customerAKey), "customer-a-items");
});

test("customer identity is safely encoded in the scoped storage key", () => {
  assert.notEqual(getCartStorageKey("customer/a"), getCartStorageKey("customer%2Fa"));
});
