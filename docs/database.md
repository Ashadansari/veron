# Database and catalog

VÉRON uses PostgreSQL with Prisma ORM 7.10.0 as the **only schema and migration authority**. Prisma's PostgreSQL driver adapter is configured in `src/lib/prisma.ts`. Drizzle remains a runtime query ORM for Better Auth, customer, and operations code; its table definitions map to the same physical tables but do not define a second migration history.

## Configuration

Copy `.env.example` to `.env.local` and set `DATABASE_URL` to a PostgreSQL connection string supplied for the target environment. The example intentionally contains no host or credentials. Prisma config loads `.env.local` and `.env`; `DATABASE_URL` is never exposed through a `NEXT_PUBLIC_` variable. Keep `.env.local` private and out of version control.

For a new, empty database, run:

```sh
npm run db:validate
npm run db:migrate
npm run db:seed
```

`npm run db:migrate` uses Prisma's development migration command and is for local schema authoring. Deployments should apply only reviewed, committed migrations with `npm run db:migrate:deploy` (`prisma migrate deploy`) after confirming the target database's migration history and backup. Do not run the development seed in staging or production.

The initial SQL migration is generated from the Prisma schema and includes PostgreSQL check constraints for money, quantities, and inventory. Prisma's schema language does not model those checks directly, so preserve the custom SQL when editing that initial migration.

`prisma/migrations/` is the canonical history. The old `drizzle/0000_bumpy_reavers.sql` is retained only as historical project material and must not be applied to a fresh or existing application database. `npm run db:drizzle:generate` and `npm run db:drizzle:migrate` are not supported deployment commands; do not generate or apply Drizzle migrations. Schema changes must be made to `prisma/schema.prisma` and reviewed Prisma SQL migrations, then mirrored in `src/db/schema.ts` for Drizzle runtime access.

Before adopting an existing environment, take a verified backup and inspect its schema and both migration ledgers (`_prisma_migrations` and `drizzle.__drizzle_migrations` or the legacy Drizzle ledger name). Do not run either migration tool until the database's provenance is known. A database created by the old Drizzle migration requires a reviewed schema comparison and explicit baseline/adoption plan; never replay Prisma's initial create-table migration against it. A database already managed by Prisma continues from `_prisma_migrations`. For an environment with manually created or mixed-history tables, stop and reconcile a schema diff against the canonical Prisma baseline before deployment. The temporary Phase 8.5 database does not represent or adopt any user's environment.

## Money and stock

Prices, subtotals, shipping, totals, and payments are PostgreSQL `BIGINT` amounts in paisa (100 paisa = NPR 1). Application code uses `bigint`; serialize amounts as decimal strings at JSON boundaries and format for display without floating-point arithmetic.

Inventory records `onHand`, `reserved`, and `lowStockThreshold`; available stock is `max(0, onHand - reserved)`. The browser cart stores product slug, variant SKU, and quantity only; authenticated cart operations also maintain the corresponding server cart rows. Cart restoration resolves identifiers through a server endpoint and reloads current names, prices, and availability from PostgreSQL. Checkout reads the server cart and performs price, shipping, authorization, and inventory checks again inside a transaction before creating an order.

## Seed data

`prisma/seed.ts` is idempotent for the sample catalog and creates the categories, products, image URLs, sizes, colors, variants, inventory rows, and store settings. It also creates an admin placeholder at `dev-admin@najfancystore.test` unless `SEED_ADMIN_EMAIL` is supplied. The placeholder has no password or login account, and the seed refuses to run with `NODE_ENV=production`. Provisioning real admin access remains a server-controlled operation.

## Historical records and account deletion

Orders use a nullable user relation with `ON DELETE SET NULL`. Order items store product name, SKU, selected size/color, unit price, quantity, and line total snapshots; shipping address, customer name, and phone are copied onto the order. Product and variant references are nullable/set-null where needed so catalog edits or removal do not erase the historical description. Payment records restrict order deletion.

Future account deletion must be an explicit server-side anonymization transaction: anonymize the user row, clear sessions, login accounts, addresses, and cart, set historical orders' `userId` to null, and remove direct identifying fields from shipping snapshots while retaining the order number, items, totals, payment records, and status history. Never cascade-delete orders when deleting a user.

## Catalog behavior

Home, shop, product detail, category options, and cart rehydration use the server catalog repository. With `DATABASE_URL` unset, it returns sample data so the storefront remains previewable without a database. With `DATABASE_URL` configured, it queries Prisma and does not silently fall back if PostgreSQL is unavailable.
