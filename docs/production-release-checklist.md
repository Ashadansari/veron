# Production release checklist

This checklist is a gate for a future owner-approved release. It records current repository state as of September 25, 2026. Nothing in this document provisions production services or authorizes a deployment.

## READY

- [x] Node 24 LTS is declared in `package.json` and `.nvmrc`; Next.js and Prisma runtime requirements were checked.
- [x] Prisma is the documented migration authority; Drizzle is runtime-only. `npm run db:migrate:deploy` is the release migration command.
- [x] Production environment names and server/public scopes are documented in `.env.example` and [the deployment guide](./production-deployment.md).
- [x] The production startup validator checks required settings without logging secret values; public variable names are allowlisted.
- [x] A PostgreSQL-backed Better Auth rate limiter is implemented and tested across two independent auth instances.
- [x] `GET /api/health` performs a database readiness check and does not expose infrastructure errors.
- [x] `npm audit --audit-level=low` reported zero known vulnerabilities at the last Phase 10 verification.
- [x] The release procedure explicitly prohibits production seeding and requires interactive first-admin creation.

## NOT READY

- [ ] Production is not ready to accept traffic: no hosting provider, managed database, environment, or domain has been selected/configured.
- [ ] No production build has been deployed or smoke-tested. The Phase 10 production-like build uses a deliberately unreachable placeholder database URL and does not verify external hosting behavior.
- [ ] Durable production product image storage/CDN is not implemented. Local/staging device uploads use `public/uploads/products/`, are disabled in production, and must not be treated as persistent deployment storage.
- [ ] Khalti live payments are not ready; keep online payment disabled until the gates below pass.
- [ ] No production account, merchant account, customer records, or production infrastructure were created or used in this phase.

## BLOCKED

- [ ] Owner has not selected a provider, region, database plan, spend ceiling, or operational contact. Review [the deployment options](./phase-10-deployment-options.md); Render/Singapore is the first staging candidate, not a final selection.
- [ ] Production database migration cannot be verified until the owner provisions an empty/approved managed PostgreSQL database. Never point a migration command at an unverified URL.
- [ ] Automated encrypted backup/PITR service, retention, RPO/RTO approval, offsite copy, and isolated restore drill are not configured.
- [ ] Monitoring, alert routing/on-call owner, log retention/redaction, error tracking, and independent uptime monitoring are not configured.
- [ ] Refund ownership, second-person review, accounting ledger, and customer communication process need owner approval. The app does not execute or record external provider refunds.
- [ ] Domain, DNS, certificate, trusted proxy/WAF policy, and externally reachable Khalti return URL are not configured.

## MANUAL VERIFICATION REQUIRED

- [ ] Create a private staging environment with synthetic records in the selected app/database region; measure latency from Nepal and verify app/database region alignment.
- [ ] Validate the app with the selected provider's Node 24 LTS image, `npm ci`, `npm run build`, `npm start`, HTTPS, logs, shutdown behavior, resource limits, and rollback artifact.
- [ ] Provision staging PostgreSQL with TLS, private ingress, restricted runtime/migration roles, adequate connection/pool limits, encryption, backups, PITR, and provider alerts. Exercise migrations using a direct URL; test runtime `DATABASE_URL` pooling with Prisma and Drizzle.
- [ ] Confirm `GET /api/health` fails when database connectivity is deliberately unavailable in staging; configure both platform readiness and a separate uptime monitor.
- [ ] Verify exact production environment values in the provider secret manager. Run `npm run env:validate:production`; never paste values in chat or logs.
- [ ] Rehearse the first-admin command using a disposable staging database only. Confirm no password is in shell history or CI logs; log in and verify server-side ADMIN authorization.
- [ ] Perform customer COD checkout, order history, admin order update, stock verification, cookie/HTTPS, authorization denial, and browser-console checks on the provider staging URL.
- [ ] Verify the local/staging image upload flow with synthetic JPEG, PNG, and WebP files, invalid/oversized/empty files, role denial, primary selection, storefront display, and safe removal. Before production device uploads, select and verify durable storage, ownership/license, CDN access, backup/retention, and deletion policies.
- [ ] Obtain Khalti sandbox merchant access without sharing credentials in chat. Verify the externally reachable callback/return, server-side lookup/reference/amount checks, duplicate callbacks, failure paths, monitoring, and sandbox reconciliation. Keep live payment disabled until separately authorized.
- [ ] Test the complete provider backup restore to a separate database. Record operator/reviewer, backup point, achieved RPO/RTO, migration status, row/integrity checks, and application smoke-test evidence.
- [ ] Select/refine an incident owner, escalation contacts, refund reviewer, customer notification procedure, and rollback/recovery decision authority.
- [ ] Refresh the dependency audit and repeat every command in the release validation block immediately before deployment.

## Controlled release sequence (future approval required)

1. Owner selects provider, region, plan, domain, operational owners, and budget. Provision only the private production app service and managed PostgreSQL using separate environments from staging.
2. Configure protected production runtime variables. Keep `KHALTI_SECRET_KEY` absent and `KHALTI_ENVIRONMENT=sandbox` unless a later payment release is approved. Validate variable names/scopes and run `npm run env:validate:production` from the production runtime context.
3. Build the immutable release from the lockfile and verify that the deployment artifact, health check, logs, alarms, restore plan, and previous rollback artifact are ready. Keep public traffic closed.
4. Verify managed PostgreSQL identity and backup. In a controlled release job, set `DATABASE_URL` to that database's direct migration URL, run `npx prisma migrate status`, inspect the reviewed plan, then run `npm run db:migrate:deploy`. Run status again and verify all expected migrations are applied. Never run Prisma dev migrations or Drizzle migrations.
5. Configure the app runtime `DATABASE_URL` (pooled if needed) and deploy the app with public traffic still gated. Confirm health/auth/database checks and logs.
6. From an authorized interactive, access-controlled terminal, run `npm run create-admin`. Do not create/promote production accounts during preparation. Verify `/login`, session, `/admin`, and server-side role denial for customers.
7. Run read-only smoke checks first. Only perform a real order if the owner separately approves it and has a documented cancellation/reconciliation path. Open traffic only after owner sign-off.
8. For rollback, revert application code only if compatible with the migrated schema. Do not improvise a down migration. For data loss, restore a backup to a separate database, validate it, reconcile writes/orders/payments/inventory, and use a reviewed cutover plan.

## Release validation commands

Run from the exact release commit using an isolated test database (never the production database for tests):

```sh
npm install
npm run lint
npm run typecheck
npx tsc --noEmit
npm test
npm run build
npm audit --audit-level=low
git diff --check
npm run db:validate
```

For a production-like build with no local staging database access, set `NODE_ENV=production` and a syntactically valid placeholder PostgreSQL URL pointing to an unreachable reserved/non-routable endpoint. `prisma generate` and `next build` must not connect to it. Do not use production credentials during build. For a release migration status/apply, use a separate guarded release job and the intended production URL only after owner approval and backup verification.
