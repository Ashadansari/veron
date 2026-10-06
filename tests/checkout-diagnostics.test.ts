import assert from "node:assert/strict";
import test from "node:test";
import { getSafeCheckoutFailureMetadata } from "../src/lib/commerce/checkout-diagnostics";

test("checkout diagnostics retain safe database metadata only", () => {
  const error = Object.assign(new Error("sensitive query and value"), {
    code: "23514",
    constraint: "notification_event_type_valid",
    table: "notification_events",
    column: "event_type",
    password: "do-not-log",
    token: "do-not-log",
  });

  assert.deepEqual(getSafeCheckoutFailureMetadata(error), {
    errorType: "Error",
    databaseCode: "23514",
    constraint: "notification_event_type_valid",
    table: "notification_events",
    column: "event_type",
  });
  assert.deepEqual(getSafeCheckoutFailureMetadata(new Error("no metadata")), { errorType: "Error" });
  assert.deepEqual(getSafeCheckoutFailureMetadata("secret"), { errorType: "UnknownError" });
});
