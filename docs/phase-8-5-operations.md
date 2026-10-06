# Phase 8.5 operational readiness

This runbook is for a non-production staging environment. It does not authorize using production customer data, credentials, or merchant keys.

## Staging setup

1. Provision a disposable PostgreSQL database and private server-side environment variables. Use the same PostgreSQL major version planned for production. Do not copy production records into staging.
2. Set `DATABASE_URL`, a unique random `BETTER_AUTH_SECRET` (at least 32 characters), `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL` for the staging origin. Keep secrets in the hosting platform's secret manager. Use TLS for the public origin and a restricted database role.
3. Run `npm ci`, `npm run db:validate`, `npm run db:migrate`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Apply only `prisma/migrations`; see `database.md` for the migration authority and legacy Drizzle adoption rules.
4. Provision a staging-only admin through the server-side admin bootstrap procedure. Do not use the seed placeholder or a production admin identity. Use synthetic customer data and a separate sandbox merchant credential if testing online payments.
5. Verify storefront browse/search, customer registration/login/address, COD checkout, customer order ownership, admin product/inventory/order/settings workflows, cancellation and stock restoration, and Khalti sandbox initiate/lookup. Verify that bad provider results cannot mark an order paid.
6. Confirm the deployment has health/error monitoring, database connection and storage alerts, and a tested restore before promoting a release.

The application does not provision a staging host, managed database, monitoring account, or backup schedule. Those infrastructure actions remain with the operator. `DATABASE_URL` and Khalti credentials must never be exposed through client-side variables.

## Refund procedure

The application does not execute refunds through Khalti or another provider. For a paid order that is cancelled or otherwise approved for refund:

1. An ADMIN confirms the order, amount in NPR, provider transaction reference, cancellation/return reason, and customer contact using the order detail and the provider's merchant portal.
2. Confirm the order is eligible and stop fulfillment. A second authorized operator should review the amount and destination before submitting the refund in the provider portal, where available.
3. Record the provider's refund reference, amount, timestamp, operator, and reason in the approved business ledger/ticket. Reconcile the provider settlement statement against the order and bank statement.
4. Only after the provider confirms completion should the payment be recorded as refunded in the store's accounting record. Keep the order and payment history; never delete the order or mark it refunded based on a browser return URL or customer claim.
5. If the provider does not support a portal refund, or the result is ambiguous, contact the provider and keep the case open. Do not retry blindly; avoid duplicate refunds.

**Product limitation:** There is currently no admin action for recording an externally completed refund, no refund API, and no refund-specific audit event. Admin cancellation explicitly leaves payment as `PAID` and calls for follow-up. Keep a refund case in the external business ledger and reconcile it before relying on in-app payment status for accounting. Implement and review a dedicated refund-recording workflow before production operators depend on in-app refund status.

## Rate limiting and trusted client IP

Better Auth enables a 30-request/minute general limit and 5/minute limits on email sign-in, sign-up, and password changes outside test mode. Phase 9 configures its built-in PostgreSQL database storage and a shared `rate_limit` model with conditional atomic updates. It works across app instances that use the same database. Apply the reviewed Prisma migration before serving that build. Configure trusted proxy IPs only for actual forwarding hops, prevent direct origin access, and have the proxy strip/overwrite client-supplied forwarding headers. Keep an edge/WAF limit as a second layer and monitor 429s without logging passwords, session tokens, or secrets.

## Backups and monitoring

The repository contains no configured production backup or monitoring service. A proposed baseline is PITR plus nightly encrypted snapshots retained for at least 30 days; approve retention and RPO/RTO before launch. Restrict backup access and manage keys separately. Restore into an isolated PostgreSQL database, verify core tables and migration history, run health/schema/smoke checks, and record achieved recovery time and point. The app exposes `/api/health` for availability and PostgreSQL reachability; connect it to an external monitor. Alert on backup/restore failures, database availability/saturation/storage, app availability/5xx, failed order creation, repeated auth failures, payment initiation/lookup/callback failures, and stuck pending orders. Error tracking is not configured. Avoid address, phone, session, and payment secrets in logs and alerts.

## Phase 8.6 disposable restore drill

On 2026-09-24, a PostgreSQL custom-format logical backup was created from a separate local database containing only the seeded synthetic catalog, restored into a new disposable database, and validated. The restored database contained 5 categories, 6 products, and 22 variants; all 4 committed Prisma migrations were marked complete, and `prisma migrate status` reported the schema up to date. A disposable local backup archive was created and restored successfully during staging verification.

This drill validates the logical backup/restore and migration-history checks only. It does not configure or verify production encryption, automated frequency/retention, point-in-time recovery, managed backup availability, or production recovery objectives. The local archive contains synthetic seed data and is not a production backup.

## Current gates

- Apply the shared `rate_limit` migration to the selected environment and configure/verify trusted-proxy and edge/WAF behavior for the actual hosting topology.
- Managed staging, production-grade backups/restore drills, and monitoring are infrastructure tasks, not provisioned by this repository.
- Khalti sandbox end-to-end testing requires a sandbox merchant secret and an externally reachable staging return URL; no merchant secret is configured in this workspace.
- External refunds are manual; the application has no refund execution or recording workflow.
- Database migration adoption must be resolved per target database before applying schema changes. Prisma is canonical; legacy Drizzle migration files are not to be applied.
- Khalti and production hosting have not been deployed or verified; see [production deployment preparation](production-deployment.md).
