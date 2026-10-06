# Production readiness checklist

This checklist describes required operator work. It does not provision infrastructure or authorize production deployment.

## BLOCKER — complete before enabling production checkout

- [ ] Select a deployment platform and production region; provision managed PostgreSQL with a restricted runtime role and TLS.
- [ ] Decide and document database adoption. Back up first; inspect `_prisma_migrations` and any legacy Drizzle ledger. Prisma is canonical. Never replay the initial migration on an existing/mixed database or apply Drizzle migrations.
- [ ] Configure the private runtime values `DATABASE_URL`, `BETTER_AUTH_SECRET` (unique, at least 32 characters), and `BETTER_AUTH_URL`; configure public `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin. Keep secrets in the platform secret manager, never in `NEXT_PUBLIC_*` variables.
- [ ] Configure the production domain, DNS, HTTPS certificate, redirects, and canonical origin. Configure the platform's trusted proxy/client-IP forwarding and verify spoofed headers do not bypass IP-based protection.
- [ ] Apply the reviewed shared-auth `rate_limit` migration before serving this version. Better Auth uses PostgreSQL-backed atomic counters across instances; additionally configure the selected edge/WAF and restrict/sanitize forwarded client-IP headers.
- [ ] Apply reviewed migrations with `npm run db:migrate:deploy` after a backup and staging rehearsal. Do not run `prisma migrate dev` or the development seed in production.
- [ ] Create the first production admin once using `npm run create-admin` from an authorized interactive operations terminal. Do not use public registration or the development seed placeholder to grant ADMIN.
- [ ] Provision encrypted automated database backups and point-in-time recovery where available. Approve frequency/retention and recovery objectives, restrict key access, and pass an isolated restore drill before launch.
- [ ] Configure application/server availability and error tracking; database connectivity/saturation; auth failures; failed order creation; payment initiation, lookup and callback failures; stuck pending orders; and backup/restore alerts. Define an on-call owner and escalation path.
- [ ] If online payments are offered, complete a separate sandbox end-to-end test with sandbox-only credentials and a public staging return URL first. Khalti E2E has not run because these are unavailable. Keep the live secret out of staging and enable production payment only in a separately approved release; otherwise leave online payment unavailable and verify COD settings.
- [ ] Approve a refund owner, independent reviewer, restricted business ledger, and the documented provider-confirmed manual refund procedure. The app does not submit or record external refunds; a paid cancellation remains PAID. Do not claim or record a completed refund until the provider confirms it.
- [ ] Pass release validation: `npm ci`, lint, typecheck, Prisma validation, integration tests against a separate test database, production build, dependency audit with advisory data, browser checkout/admin regression, and `git diff --check`.

## POST-DEPLOYMENT / OPERATIONAL

- [ ] Maintain domain/DNS ownership, certificate renewal, platform/runtime upgrades, dependency advisory review, and secret rotation procedures.
- [ ] Review 5xx, database, auth, order, payment, backup, and restore alerts after each release; never log passwords, session tokens, Khalti keys, full address, or phone numbers.
- [ ] Perform and record periodic restore drills against an isolated database; revise recovery objectives when business needs change.
- [ ] Reconcile COD collections and provider settlements/refunds against orders and the accounting ledger. Keep provider refund references, amount, time, operator, reason, and second-person review evidence.
- [ ] Inspect production migration state before each release and keep an independently verified pre-migration backup and restore/rollback plan.

## Environment variables

| Variable | Scope | Production requirement |
|---|---|---|
| `DATABASE_URL` | Server-only | Managed PostgreSQL connection, TLS, least-privilege role |
| `BETTER_AUTH_SECRET` | Server-only | Unique random secret, at least 32 characters |
| `BETTER_AUTH_URL` | Server-only | Canonical HTTPS application origin |
| `NEXT_PUBLIC_APP_URL` | Public origin | Canonical HTTPS application origin; never a credential |
| `TRUSTED_PROXY_CIDRS` | Server-only configuration | Actual proxy hops for a multi-value forwarded-IP chain; protect the origin and sanitize headers |
| `KHALTI_SECRET_KEY` | Server-only | Optional; sandbox-only in staging. Production merchant secret only after separately approved E2E/release gates |
| `KHALTI_ENVIRONMENT` | Server-only | Keep `sandbox` until live release approval; unset key keeps online payment unavailable |
| `TEST_DATABASE_URL` | Test-only | Separate disposable PostgreSQL database; never production |
| `SEED_ADMIN_EMAIL` | Local seed only | Not used to provision production administrator access |

No production domain, DNS, platform, merchant account, backup service, WAF, monitoring service, or error-tracking account is configured by this repository. See [the production deployment guide](production-deployment.md) for release, rollback, and recovery procedures.
