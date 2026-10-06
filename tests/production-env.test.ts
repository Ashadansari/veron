import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { getTrustedProxyCidrs } from "@/lib/auth-rate-limit";
import { findUnsafePublicEnvironmentNames } from "@/lib/public-env";
import { getProductionEnvironmentIssues } from "@/lib/production-env";

test("only the storefront origin is allowed as a public environment variable", async () => {
  const example = await readFile(".env.example", "utf8");
  const exampleNames = example.split(/\r?\n/)
    .filter((line) => /^\s*[A-Z_][A-Z_0-9]*\s*=/.test(line))
    .map((line) => line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=/)?.[1])
    .filter((name): name is string => Boolean(name));
  assert.deepEqual(exampleNames.filter((name) => name.startsWith("NEXT_PUBLIC_")), ["NEXT_PUBLIC_APP_URL"]);
  assert.deepEqual(findUnsafePublicEnvironmentNames({
    NEXT_PUBLIC_APP_URL: "https://store.example",
    DATABASE_URL: "private",
    NEXT_PUBLIC_DATABASE_URL: "must be rejected",
    NEXT_PUBLIC_KHALTI_SECRET_KEY: "must be rejected",
  }), ["NEXT_PUBLIC_DATABASE_URL", "NEXT_PUBLIC_KHALTI_SECRET_KEY"]);
});

test("trusted proxy configuration accepts valid IP and CIDR entries only", () => {
  assert.deepEqual(getTrustedProxyCidrs("192.0.2.4, 2001:db8::/32"), ["192.0.2.4", "2001:db8::/32"]);
  assert.deepEqual(getTrustedProxyCidrs("  "), []);
  assert.throws(() => getTrustedProxyCidrs("not-an-ip"), /TRUSTED_PROXY_CIDRS/);
  assert.throws(() => getTrustedProxyCidrs("192.0.2.1/33"), /TRUSTED_PROXY_CIDRS/);
});

test("production environment validation checks required server configuration without revealing values", () => {
  const missingIssues = getProductionEnvironmentIssues({});
  for (const name of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL", "KHALTI_ENVIRONMENT"]) {
    assert(missingIssues.some((issue) => issue.startsWith(`${name} `)));
  }

  const valid = {
    DATABASE_URL: "postgresql://runtime:opaque-password@postgres.internal:5432/store?sslmode=require",
    BETTER_AUTH_SECRET: "a-32-character-or-longer-placeholder-secret",
    BETTER_AUTH_URL: "https://store.example.com",
    NEXT_PUBLIC_APP_URL: "https://store.example.com",
    KHALTI_ENVIRONMENT: "sandbox",
    KHALTI_SECRET_KEY: "",
    TRUSTED_PROXY_CIDRS: "192.0.2.0/24",
  };
  assert.deepEqual(getProductionEnvironmentIssues(valid), []);
  assert.deepEqual(getProductionEnvironmentIssues({
    ...valid,
    EMAIL_PROVIDER_URL: "unused",
    EMAIL_PROVIDER_API_KEY: "unused",
    EMAIL_FROM: "unused",
  }), [], "deferred email verification config is not required or validated by the active auth flow");

  const issues = getProductionEnvironmentIssues({
    ...valid,
    DATABASE_URL: "postgresql://private-value@localhost/store",
    BETTER_AUTH_SECRET: "short-secret",
    BETTER_AUTH_URL: "http://store.example.com",
    NEXT_PUBLIC_APP_URL: "https://store.example.com",
    NEXT_PUBLIC_KHALTI_SECRET_KEY: "must-not-be-public",
    KHALTI_ENVIRONMENT: "production",
    TEST_DATABASE_URL: "postgresql://private-value/test",
  });
  assert(issues.some((issue) => issue.includes("loopback host")));
  assert(issues.some((issue) => issue.includes("BETTER_AUTH_SECRET")));
  assert(issues.some((issue) => issue.includes("KHALTI_SECRET_KEY")));
  assert(issues.some((issue) => issue.includes("TEST_DATABASE_URL")));
  assert(issues.some((issue) => issue.includes("NEXT_PUBLIC_KHALTI_SECRET_KEY")));
  assert(!issues.join(" ").includes("private-value"));
  assert(getProductionEnvironmentIssues({
    ...valid,
    BETTER_AUTH_SECRET: "replace-with-a-random-secret-at-least-32-characters",
  }).some((issue) => issue.includes("example placeholder")));
  assert(getProductionEnvironmentIssues({ ...valid, GOOGLE_CLIENT_ID: "configured" }).some((issue) => issue.includes("must be configured together")));
});
