import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as healthGet } from "@/app/api/health/route";

test("health probe confirms database availability without exposing details", async () => {
  const response = await healthGet();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});
