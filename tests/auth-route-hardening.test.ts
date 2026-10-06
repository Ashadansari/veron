import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { PATCH as notificationsPatch } from "@/app/api/admin/notifications/route";
import { getCanonicalAppUrl } from "@/lib/http/canonical-app-url";

test("direct Better Auth email signup is blocked in favor of validated public registration", async () => {
  const response = await authPost(new Request("http://127.0.0.1:3000/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Attempted Direct Signup",
      email: "existing-admin@example.test",
      password: "StrongPassword123",
      role: "ADMIN",
    }),
  }));

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Registration request is invalid." });
});

test("direct Better Auth email signup with a trailing slash is also blocked", async () => {
  const response = await authPost(new Request("http://127.0.0.1:3000/api/auth/sign-up/email/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }));

  assert.equal(response.status, 404);
});

test("admin notification mutations reject an untrusted Origin before session or database access", async () => {
  const response = await notificationsPatch(new Request("http://127.0.0.1:3000/api/admin/notifications", {
    method: "PATCH",
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    body: JSON.stringify({ markAll: true }),
  }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Request could not be completed." });
});

test("payment return redirect targets stay on the configured canonical origin", () => {
  const redirect = getCanonicalAppUrl("/account/orders", "https://store.example.test");
  assert.equal(redirect?.origin, "https://store.example.test");
  assert.equal(getCanonicalAppUrl("//evil.example/path", "https://store.example.test"), null);
  assert.equal(getCanonicalAppUrl("/\\evil.example/path", "https://store.example.test"), null);
  assert.equal(getCanonicalAppUrl("/account/orders", "https://user:pass@store.example.test"), null);
});
