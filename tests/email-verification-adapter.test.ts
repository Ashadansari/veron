import assert from "node:assert/strict";
import { test } from "node:test";
import { clearTestVerificationEmails, getTestVerificationEmails, isVerificationEmailDeliveryConfigured, sendVerificationEmail } from "@/lib/email/verification-email";

test("future email verification delivery adapter does not configure or block registration", () => {
  assert.equal(isVerificationEmailDeliveryConfigured({}), false);
  assert.equal(isVerificationEmailDeliveryConfigured({ NODE_ENV: "test" }), true);
  assert.equal(isVerificationEmailDeliveryConfigured({
    EMAIL_PROVIDER_URL: "https://mail.example.test/send",
    EMAIL_PROVIDER_API_KEY: "opaque-placeholder",
    EMAIL_FROM: "verify@example.test",
  }), true);
});

test("test email sink keeps the signed link in memory and does not log it", async () => {
  clearTestVerificationEmails();
  const logged: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => logged.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(" "));
  const link = "https://store.example.test/api/auth/verify-email?token=private-test-link";
  try {
    await sendVerificationEmail({ to: "customer@example.test", name: "Test Customer", url: link });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.deepEqual(logged, []);
  assert.equal(getTestVerificationEmails("customer@example.test")[0]?.url, link);
});
