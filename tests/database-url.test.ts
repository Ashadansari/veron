import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePostgresJsConnectionString } from "@/db";
import { normalizeBootstrapConnectionString } from "../scripts/first-admin-service";

test("postgres-js connection URL strips Prisma's schema option", () => {
  const normalized = new URL(normalizePostgresJsConnectionString(
    "postgresql://store@localhost:5432/najfancystore?schema=public&sslmode=require",
  ));

  assert.equal(normalized.searchParams.has("schema"), false);
  assert.equal(normalized.searchParams.get("sslmode"), "require");
  assert.equal(normalized.username, "store");
  assert.equal(normalized.password, "");
});

test("first-admin bootstrap strips Prisma's schema option and preserves other options", () => {
  const normalized = new URL(normalizeBootstrapConnectionString(
    "postgresql://store@localhost:5432/najfancystore?schema=public&sslmode=require",
  ));

  assert.equal(normalized.searchParams.has("schema"), false);
  assert.equal(normalized.searchParams.get("sslmode"), "require");
});
