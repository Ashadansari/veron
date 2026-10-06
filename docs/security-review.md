# Phase 9 security review

Reviewed the current authentication, server actions, data services, payment callbacks, Next.js configuration, and integration tests. This is a source/configuration review, not an external penetration test or production infrastructure audit.

## Controls reviewed

- **Authentication and role assignment:** Better Auth owns credential/session handling. Registration server hooks force `CUSTOMER`; role input is disabled. The first-admin process is interactive/server-side. Admin page/action services check `ADMIN` on the server.
- **Authorization and ownership:** Admin services enforce roles; customer order queries filter by the authenticated user. Tests cover customer denial of admin operations and cross-customer order denial. Anonymous admin/account access redirects to login.
- **Sessions and cookies:** Session tokens are returned only through Better Auth's HttpOnly cookie; Better Auth's response hook nulls the JSON token. Cookie attributes are HttpOnly, SameSite=Lax, and Secure in production. Session cookie caching is disabled.
- **CSRF/origin:** Better Auth's CSRF checks remain enabled, with `trustedOrigins` derived from the configured auth and app origins. Next Server Actions keep their framework origin checks. Do not disable these checks as a deployment workaround.
- **Validation and financial data:** Server-side Zod/domain validation covers profile, Nepal phone/address, catalog, settings, order state, and payment input. Prices and shipping are recomputed from PostgreSQL using integer paisa/bigint. Client totals, inventory, role, payment state, and ownership are not authoritative.
- **Inventory and orders:** Checkout locks/validates available stock in a transaction and derives totals on the server. Order cancellation/status transitions lock the row and reject invalid repeat transitions; inventory restoration is coupled to the one allowed cancellation transition. Tests include competing checkouts and repeat-safe cancellation.
- **Account deletion:** Password-confirmed anonymization clears auth/session/address/cart identifiers, detaches customer references, and preserves order/payment history; user-to-order cascade deletion is not used.
- **Payments:** Khalti callback query values are treated as untrusted. The server calls provider lookup and compares provider reference, order association, and exact paisa amount before marking paid. Unknown/mismatched provider outcomes do not mark the order paid. No real credential or live transaction was used in this review.
- **Secrets:** Runtime secrets are server-only. `NEXT_PUBLIC_APP_URL` is the sole allowed `NEXT_PUBLIC_*` name; predev, prebuild, and prestart checks reject other public variable names without printing values. Keep actual values in a platform secret manager.
- **Next.js baseline:** Powered-by header is disabled; response headers include nosniff, frame denial, referrer policy, and restricted browser permissions. Production deployment must use HTTPS, trusted origins/proxies, production env checks, and an external security review appropriate to launch risk.

## Remaining security and operational work

- Apply the shared rate-limit migration to the target database before deploying the new build. The limiter is backed by shared PostgreSQL and retains 30/minute general, 5/minute sign-in/sign-up/password-change rules. Deployment still needs origin isolation, a verified forwarding chain, and edge/WAF controls.
- Configure production secrets, TLS, managed database permissions, backups/PITR, log redaction, error tracking, and monitoring; none are provisioned here.
- No browser console-log API or production-like external penetration test was available in this repository validation.
- Khalti sandbox E2E remains pending. External provider refunds are manual; the app does not record an externally confirmed refund. The restricted business ledger remains authoritative until a reviewed refund-recording feature exists.
- npm registry audit currently reports no vulnerabilities after the targeted esbuild override, but the advisory database must be refreshed again during release validation.

## Tests and evidence

See `tests/auth.integration.test.ts`, `tests/admin-catalog.integration.test.ts`, `tests/orders.integration.test.ts`, `tests/khalti.integration.test.ts`, `tests/auth-rate-limit.integration.test.ts`, and `tests/production-hardening.test.ts`. These cover role forcing/guards, credential sessions, customer data ownership, transactional checkout/inventory, callback verification, shared limiter behavior across two auth instances, public env-name checks, trusted-proxy parsing, and the health probe. Tests are integration evidence, not a substitute for production staging, infrastructure verification, or external security testing.
