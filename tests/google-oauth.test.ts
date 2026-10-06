import assert from "node:assert/strict";
import { test } from "node:test";
import { getGoogleOAuthConfig, isGoogleOAuthConfigured } from "@/lib/auth/google-oauth";

test("manual authentication remains available when Google OAuth is not configured", () => {
  assert.equal(getGoogleOAuthConfig({}), null);
  assert.equal(isGoogleOAuthConfigured({}), false);
  assert.equal(isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: "client-id" }), false);
  assert.equal(isGoogleOAuthConfigured({ GOOGLE_CLIENT_SECRET: "client-secret" }), false);
});

test("Google OAuth is enabled only when both credentials are configured", () => {
  assert.deepEqual(getGoogleOAuthConfig({ GOOGLE_CLIENT_ID: " client-id ", GOOGLE_CLIENT_SECRET: " client-secret " }), {
    clientId: "client-id",
    clientSecret: "client-secret",
    requireEmailVerification: true,
  });
  assert.equal(isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret" }), true);
});
