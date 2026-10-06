# Production deployment preparation

This guide prepares a deployment; it does not authorize or perform one. Do not use production customer data or real payment credentials in staging. The hosting platform, region, domain, production database, secrets, and payment merchant account are not selected or configured by this repository.

## 1. Hosting and runtime

- Use Node.js 24 LTS (`package.json` engines and `.nvmrc`) on a supported Node.js server platform. Next.js 16 requires Node >=20.9; Prisma 7 supports Node ^20.19, ^22.12, or >=24.0. Run the built app with `npm start` so the production prestart checks run. Do not serve the development server or run database-backed routes on an Edge runtime.
- Prefer one application region close to the managed PostgreSQL region. If using multiple application instances, share the Next.js cache where required by the selected caching features; auth rate-limit state is already stored in PostgreSQL.
- Build from the lockfile (`npm ci`), run validation, then use `npm run build`. The build must not connect to a runtime database; production-like CI can set a valid but unreachable placeholder `DATABASE_URL` and fake, non-secret auth configuration. Validate that build separately from the release migration job.
- Keep the database private to the application and operations network. Use separate deployment, runtime, and backup roles where supported. Runtime credentials should not have schema-owner privileges.

See [the Phase 10 provider evaluation](./phase-10-deployment-options.md) for a dated comparison of Vercel, Render, Railway, and Fly.io. Render/Singapore is a staging candidate for owner review, not a selected provider.

## 2. PostgreSQL and migration strategy

- Use managed PostgreSQL with TLS, automated failover where appropriate, connection limits sized for the number of app instances, and a dedicated least-privilege runtime role.
- Prisma is the only schema and migration authority. Drizzle is used for runtime queries and shares the same physical tables. Never apply the retained legacy Drizzle SQL or run Drizzle migrations against a production database.
- Before adopting an existing database, confirm its provenance and inspect both migration ledgers. Back up first. Stop for a reviewed schema/baseline plan if it has legacy Drizzle, manually created, or mixed-history tables. Never replay the initial create-table migration against existing tables.
- In staging, apply the exact reviewed commit to a disposable clone, verify migration status and application workflows, and record the schema comparison.
- Before a release, take/verify the pre-migration backup, confirm `DATABASE_URL` identifies the intended production database without printing its credentials, then run `npm run db:migrate:deploy` once from the controlled release job. Do not run `npm run db:migrate`, `prisma migrate dev`, or `npm run db:seed` in production.
- Prefer additive, backward-compatible schema changes. Keep the old app version compatible during a rolling deployment. Prisma migrations are not automatically reversed by a code rollback; correct a bad migration with a reviewed forward migration. For a data-loss incident, restore to a separate database and validate it before any controlled cutover.

## 3. Environment variables and secrets

Provide variables through the platform's protected runtime/build environment or secret manager. Never commit `.env.local`, inject secrets into build logs, or use `NEXT_PUBLIC_` for a credential. The application permits only `NEXT_PUBLIC_APP_URL` in that public namespace; npm lifecycle validation fails on any other `NEXT_PUBLIC_*` name.

| Variable | Scope | Production requirement |
|---|---|---|
| `DATABASE_URL` | Server-only secret | Managed PostgreSQL URL with TLS and a restricted runtime role. |
| `BETTER_AUTH_SECRET` | Server-only secret | Unique random value of at least 32 characters; rotate using a planned session invalidation procedure. |
| `BETTER_AUTH_URL` | Server-only URL | Canonical HTTPS auth/application origin. |
| `NEXT_PUBLIC_APP_URL` | Public URL | Canonical HTTPS storefront origin; contains no credentials. |
| `GOOGLE_CLIENT_ID` | Optional server-only configuration | Google OAuth client ID. Configure with `GOOGLE_CLIENT_SECRET` to enable Google sign-in. |
| `GOOGLE_CLIENT_SECRET` | Optional server-only secret | Google OAuth client secret. Manual email/password authentication works when Google OAuth is not configured. |
| `TRUSTED_PROXY_CIDRS` | Server-only configuration | Actual proxy IPs/CIDRs if a multi-hop forwarded-IP chain is used. Keep origin unreachable directly. |
| `KHALTI_SECRET_KEY` | Server-only secret, optional | Sandbox-only secret for sandbox E2E; production secret only after a separate release approval and verification. Leave unset to keep online payment unavailable. |
| `KHALTI_ENVIRONMENT` | Server-only configuration | Required. `sandbox` until sandbox verification; use `production` only in the live environment after a separately approved release. |
| `TEST_DATABASE_URL` | Test-only secret | Optional isolated disposable test database; never set to production. |
| `SEED_ADMIN_EMAIL` | Local seed only | Development seed setting. Do not use it to bootstrap production admin access. |

Set `NODE_ENV=production` through the platform runtime. Keep all server-only variables out of client components and browser responses. The predev/prebuild/prestart check allowlists the sole public variable name and does not print variable values.

`npm start` also runs the strict production environment validator before Next.js starts. `npm run env:validate:production` runs the same check manually. It requires a PostgreSQL URL, a 32-character Better Auth secret, HTTPS auth/store origins sharing one canonical origin, an explicit Khalti environment, and valid optional trusted-proxy entries; it rejects loopback database hosts and development-only test/seed settings. It validates configuration syntax only and never connects to PostgreSQL or verifies external provider accounts. Leave `KHALTI_SECRET_KEY` unset while payments are disabled. If setting `KHALTI_ENVIRONMENT=production`, the validator requires a key to be present, but it cannot verify merchant ownership or provider functionality.

Order lifecycle events are recorded in PostgreSQL for internal audit/context only; this project does not configure order delivery emails.

## 4. Domain, HTTPS, proxy, and rate limits

- Configure the production domain, DNS, canonical redirect, certificate renewal, and HTTPS before opening checkout. Set both origin URL variables to that canonical HTTPS origin.
- Use the exact canonical public origin for `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`. Configure the Khalti return URL as `https://<canonical-domain>/api/payments/khalti/return` and register/verify it with the merchant in sandbox before any live activation. Keep the origin private until domain, HTTPS, and callback testing are complete.
- Put a trusted reverse proxy/WAF in front of the app. Restrict direct origin access. Strip incoming client-supplied forwarding headers and write a canonical `X-Forwarded-For` chain. If the chain contains known proxy hops, configure only the actual proxy IPs/CIDRs in `TRUSTED_PROXY_CIDRS`; do not trust broad client-reachable private ranges.
- Better Auth uses shared database-backed counters with the existing general and auth-specific limits. Apply the `rate_limit` table migration before enabling this version. Keep a WAF/edge abuse limit as a second layer, and alert on sustained 429s. Do not rely on per-process counters or a client-provided IP header.
- The app sets `HttpOnly`, `SameSite=Lax`, and production `Secure` auth cookies. Keep Better Auth origin/CSRF checks enabled and configure exact trusted origins; never disable CSRF or origin validation to address deployment issues.

## 5. Backups and recovery

- Require automated encrypted backups plus point-in-time recovery (PITR) where the managed service supports it. The initial operational proposal is nightly encrypted snapshots retained at least 30 days plus continuous WAL/PITR; the business must approve retention, recovery-point objective (RPO), and recovery-time objective (RTO) before launch.
- Restrict backup and encryption-key access separately from app runtime access. Alert on missed backups, backup verification failures, and restore failures. Retain an independently accessible pre-migration backup.
- For a restore drill, restore to an isolated database with no production app traffic. Verify the backup timestamp/point, PostgreSQL integrity, core user/order/payment/catalog tables, `_prisma_migrations`, Prisma status, and application smoke tests. Record achieved RPO/RTO and operator/reviewer. Never overwrite the live database during a drill.
- Recovery: declare the incident and stop writes if integrity is uncertain; preserve evidence; restore to a separate database at the approved point; validate migrations and orders/payments/inventory with business owners; reconcile writes after the recovery point; then cut traffic only after a reviewed cutover. Keep the original database read-only until recovery is accepted.

## 6. Monitoring, logging, and incident response

- Probe `GET /api/health` from the platform monitor. It checks PostgreSQL reachability and returns only `ok` or `unavailable`; use 503 to alert, and do not expose database error details.
- Configure alerts for app availability/5xx and latency, database connection failures/saturation/storage, auth failures and 429s, failed order creation, pending/stuck payment verification, payment callback/lookup failures, and backup/restore failures. Assign an on-call owner and escalation path.
- Connect a platform-supported error tracker/trace exporter only after review of data filtering and retention. The repository does not configure a monitoring or error-tracking vendor. Add correlation IDs and event types, not credentials or personal details.
- Never log passwords, password hashes, session tokens, cookies, auth secrets, database URLs, Khalti keys, complete addresses, or phone numbers. Redact request bodies, authorization headers, and payment callback query strings in proxies and error tools. Restrict log access and set retention.
- Incident response: contain the affected service or disable online payment/checkout if safe; preserve redacted logs and provider references; rotate compromised secrets from the secret manager; assess orders, payments, stock, and customer impact; notify the responsible business/security owner; document remediation and verify recovery. Never mark payment paid from a browser return alone.

## 7. Admin bootstrap and access

- Deploy the app with public registration assigning CUSTOMER only. Verify server-side ADMIN guards before provisioning access.
- After production database migration and a protected production URL are verified, an authorized operator may run `npm run create-admin` from an interactive, access-controlled operations terminal with production environment variables. Do not use public registration, the seed placeholder, or a committed credential. Do not place the initial password in shell history, CI logs, chat, or a shared ticket.
- Use an individually assigned admin account, require a unique password, verify login and audit access, and document a separate account recovery/rotation process. Review ADMIN membership regularly and revoke access when no longer needed.

## 8. Payments and refunds

- Keep `KHALTI_ENVIRONMENT=sandbox` and use sandbox-only credentials in staging. E2E remains pending until a sandbox merchant secret and externally reachable staging return URL are provisioned. The return URL is untrusted; the server must verify Khalti lookup status, payment reference, order association, and exact amount in paisa.
- Leave `KHALTI_SECRET_KEY` unset and online payment unavailable until the merchant contract, sandbox E2E, callback monitoring, and separate live-release review are complete. Never use production credentials in this repository's staging environment.
- COD availability is controlled by Store Settings. Reconcile COD collections against order numbers and accounting records.
- Refunds are manual and are not executed or recorded by the app. For a paid order, stop fulfillment and have one authorized operator verify eligibility, NPR amount, order/provider reference, and reason. A second operator reviews amount and destination before the provider portal submission. Wait for explicit provider confirmation; store the provider refund reference, confirmed amount/time, operator, reason, and reviewer in the approved restricted business ledger. Reconcile provider settlement and bank/accounting records. Do not mark a payment REFUNDED or claim completion based on a request, callback return, cancellation, or customer statement. Keep the order/payment history and do not restore stock twice; stock/order transitions are separate from cash refund recording. If provider completion is ambiguous, hold and contact the provider instead of retrying blindly.
- See [the refund procedure](./refunds.md) for the operator checklist and evidence fields.

## 8a. Product images and storage

- The current demo/catalog uses Unsplash image URLs. Admins can add HTTPS image URLs or use the local/staging-only device upload under `public/uploads/products/`; that upload is disabled in production and is not durable deployment storage.
- Treat demo Unsplash images as placeholders. Before production catalog entry, use owner-controlled or properly licensed product photography on a durable object-storage/CDN service. Do not rely on an app instance's writable filesystem.
- The current Next.js `images.remotePatterns` permits only `images.unsplash.com`. Before choosing another image host, review its ownership/access policy, configure the narrow host/path allowlist, and test optimized rendering. Do not allow arbitrary hosts broadly.
- Before production product uploads, select a durable storage service and add its reviewed access, authorization, content/size validation, CDN, retention/deletion, and recovery policies. The current local upload path is not a substitute for that production storage design.

## 9. Release, rollback, and go/no-go

Before each release: run `npm ci`, `npm run lint`, `npm run typecheck`, `npx tsc --noEmit`, `npm test` against a separate test database, `npm run db:validate`, `npm run build`, `npm ls --depth=0`, `npm audit --audit-level=low`, and `git diff --check`. Complete staging browser checks for customer checkout, admin operations, authorization, payment behavior, and logs.

Deploy the immutable build to a private preview/staging target first. Confirm health, login, read/write paths, migration state, dashboards, alerts, and rollback artifact. For production, use a reviewed maintenance window or compatible rolling release, apply reviewed Prisma migrations only after verifying a restorable backup, deploy the build, smoke-test health/auth/catalog/checkout without placing an unintended live order, and watch alerts.

Rollback the app build only when the old build is compatible with the current schema. Do not run an improvised down migration or restore over live writes. For an incompatible schema/data incident, stop writes, restore to a separate database, reconcile orders/payments/inventory and point-in-time writes, then use a reviewed cutover. Record decisions and involve the database and business owners.

## Current deployment blockers

- No production hosting platform, region, managed PostgreSQL, runtime secrets, domain/DNS, certificate, proxy, WAF, monitoring/error-tracking account, or automated backup policy is configured.
- The new shared auth limiter requires its reviewed Prisma migration to be applied to the target database before that build is served.
- npm audit must be rerun against current advisory data during release validation.
- Khalti sandbox E2E, refund-owner approval, backup RPO/RTO approval, restore evidence for production infrastructure, and a browser release regression remain operational gates.
- The project has not been deployed to production and this guide does not authorize it.
- Durable production product image storage is not implemented; choose the production image host and validate a durable upload workflow before store-owned product imagery is entered through device uploads.

See [the production release checklist](./production-release-checklist.md) for READY, NOT READY, BLOCKED, and owner-verification gates.
