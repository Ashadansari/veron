import assert from "node:assert/strict";
import { test } from "node:test";
import { isSameConfiguredOrigin } from "../src/lib/http/same-origin";

const canonicalOrigin = "http://127.0.0.1:3000";

test("configured same-origin accepts canonical Host when framework URL was rewritten", () => {
  const request = new Request("http://localhost:3000/api/register", {
    headers: { origin: canonicalOrigin, host: "127.0.0.1:3000" },
  });

  assert.equal(isSameConfiguredOrigin(request, [canonicalOrigin]), true);
});

test("configured same-origin rejects untrusted Origin or mismatched Host", () => {
  const badOrigin = new Request("http://localhost:3000/api/register", {
    headers: { origin: "http://evil.example", host: "127.0.0.1:3000" },
  });
  const badHost = new Request("http://localhost:3000/api/register", {
    headers: { origin: canonicalOrigin, host: "localhost:3000" },
  });
  const untrustedForwardedHost = new Request("http://localhost:3000/api/register", {
    headers: { origin: canonicalOrigin, host: "localhost:3000", "x-forwarded-host": "127.0.0.1:3000" },
  });

  assert.equal(isSameConfiguredOrigin(badOrigin, [canonicalOrigin]), false);
  assert.equal(isSameConfiguredOrigin(badHost, [canonicalOrigin]), false);
  assert.equal(isSameConfiguredOrigin(untrustedForwardedHost, [canonicalOrigin]), false);
});

test("configured same-origin rejects a missing Origin or invalid configured URL", () => {
  const missingOrigin = new Request("http://127.0.0.1:3000/api/register");
  const invalidConfiguration = new Request("http://127.0.0.1:3000/api/register", {
    headers: { origin: canonicalOrigin, host: "127.0.0.1:3000" },
  });

  assert.equal(isSameConfiguredOrigin(missingOrigin, [canonicalOrigin]), false);
  assert.equal(isSameConfiguredOrigin(invalidConfiguration, ["not a URL"]), false);
});
