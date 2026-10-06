import assert from "node:assert/strict";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { account, rateLimit, session, user, verification } from "@/db/schema";
import { getAuthRateLimitOptions } from "@/lib/auth-rate-limit";
import { testOrigin } from "./test-origin";

const origin = testOrigin;

test("production authentication rate limits use atomic shared database storage", async () => {
  const productionConfig = getAuthRateLimitOptions("production");
  assert.equal(productionConfig.enabled, true);
  assert.equal(productionConfig.storage, "database");
  assert.equal(productionConfig.window, 60);
  assert.equal(productionConfig.max, 30);
  assert.deepEqual(productionConfig.customRules, {
    "/sign-in/email": { window: 60, max: 5 },
    "/sign-up/email": { window: 60, max: 5 },
    "/change-password": { window: 60, max: 5 },
  });
  assert.equal(getAuthRateLimitOptions("test").enabled, false);

  const db = getDatabase();
  const signInKey = "no-trusted-ip|/sign-in/email";
  const testOptions = {
    ...productionConfig,
    customRules: { ...productionConfig.customRules, "/sign-in/email": { window: 60, max: 1 } },
  };
  const makeAuth = () => betterAuth({
    appName: "Naj Fancy Store Rate Limit Test",
    baseURL: `${origin}/api/auth`,
    trustedOrigins: [origin],
    secret: "phase-nine-rate-limit-test-secret-not-used-for-customers",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit },
    }),
    emailAndPassword: { enabled: true },
    rateLimit: testOptions,
  });

  // The test database is reused across runs, so remove a stale shared bucket
  // before asserting the first request's behavior.
  await db.delete(rateLimit).where(eq(rateLimit.key, signInKey));
  try {
    const instanceA = makeAuth();
    const instanceB = makeAuth();
    const postSignIn = (auth: ReturnType<typeof makeAuth>) => auth.handler(new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ email: "missing@example.test", password: "IncorrectPassword123" }),
    }));

    const firstRequest = await postSignIn(instanceA);
    assert.equal(firstRequest.status, 401, "the first request should reach credential verification");
    const secondRequest = await postSignIn(instanceB);
    assert.equal(secondRequest.status, 429, "a second auth instance must observe the same database counter");
  } finally {
    await db.delete(rateLimit).where(eq(rateLimit.key, signInKey));
  }
});
