# NajFancyStore

Production-oriented clothing storefront for Nepal, built with Next.js App Router, React, TypeScript, Tailwind CSS, ESLint, PostgreSQL, Prisma ORM, Drizzle ORM, and Better Auth.

## Local setup

1. Install Node.js 24 and PostgreSQL 15+.
2. Copy `.env.example` to `.env.local`, create a PostgreSQL database, and set `DATABASE_URL` to its connection string. Set `BETTER_AUTH_SECRET` to a private random value of at least 32 characters. Keep `.env.local` out of version control.
3. Install packages with `npm install`.
4. Validate and migrate the local development database with `npm run db:validate` and `npm run db:migrate`.
5. Create the first administrator from a trusted interactive terminal with `npm run create-admin`. Enter the email at the prompt; new accounts also request a name. Password entry and confirmation are hidden. If the email belongs to an active CUSTOMER and no ADMIN exists, the command requires the operator to type `PROMOTE` before recovering that same identity.
6. For development only, optionally run `npm run db:seed` to load sample catalog and shipping data. If a real admin already exists, the seed reuses it without changing the owner's profile or adding a placeholder. If run before first-admin setup, the seed creates a development-only ADMIN placeholder and setup will correctly refuse; use `admin:promote` only for an intentional elevation of an existing account.
7. Start the app with `npm run dev`, log in at `/login`, and visit `/admin`.

For production, do not run the development seed. After confirming the database migration history and validating the schema, apply committed migrations with `npm run db:migrate:deploy`, run `npm run create-admin` once from an authorized deployment terminal, then start the application. The bootstrap is never run by installation, build, or app startup.

Read [the database guide](docs/database.md) before applying migrations. Prisma owns new database migrations; the older Drizzle migration is retained for the existing auth and operations layer and must not also be applied to the same empty database.

The production server needs the same environment variables, database migrations, and a private `BETTER_AUTH_SECRET`. `npm run build` creates the production build; `npm run start` serves it.

## Main routes

- `/shop`: database-backed search, category, price, and sort filters, with sample catalog fallback when no database URL is configured.
- `/products/[slug]`: product details and selectable size/color variants.
- `/cart`, `/checkout`: cart identifiers and quantities are synchronized to the authenticated customer's database cart; checkout recalculates current prices, shipping, stock, and total in a transaction and places Cash on Delivery orders.
- `/login`, `/register`: Better Auth email/password forms with Nepal phone validation.
- `/account`: protected profile, address, order history/detail, password, and account deletion pages.
- `/order/success/[orderNumber]`: owner-scoped order confirmation with historical totals and delivery summary.
- `/admin`: admin-protected dashboard, catalog, inventory, and order management; Customers and Settings remain later-phase placeholders.
- `/api/auth/*`: Better Auth endpoints.

## Nepal and money handling

Store settings default to NPR, `ne-NP`, and `Asia/Kathmandu`. Amounts are stored as integer paisa (`bigint`) and parsed from decimal NPR strings without JavaScript floating-point arithmetic. Customer address inputs include province, district, municipality/rural municipality, ward, tole/area, street, optional postal code, and Nepal phone validation.

Shipping charges, free-shipping thresholds, COD availability, and location matching are database-managed rules. Higher-priority and more specific province/district rules take precedence. Checkout independently checks the active rule, current cart prices, active products/variants, and inventory on the server. No price, stock, shipping cost, payment state, role, or order status from the browser is trusted.

## Payments

`src/lib/commerce/payment-provider.ts` defines a provider interface using NPR integer paisa amounts, idempotency keys, and webhook verification. No provider credentials or Nepal payment-provider integration are included. COD is implemented and only available when its matching shipping rule allows it. Online checkout remains unavailable until a provider is registered and its callbacks are implemented.

COD orders are created with `UNPAID` payment status; checkout never marks COD as paid. Product prices, shipping, and stock are reloaded server-side inside the order transaction. Stock is decremented with an atomic conditional update, order item and address snapshots are stored, and the cart is cleared only after the order, payment record, and status event succeed. Cancellation is allowed for an unpaid order while it is still `PLACED`; admins can cancel before shipment. Cancellation returns stock transactionally. A paid cancellation remains marked paid with explicit refund follow-up in its status event; no refund is claimed or processed. See [the order workflow note](docs/orders-and-checkout.md).

## Account deletion and business records

Account deletion requires password confirmation and uses a transaction. The user row becomes a tombstone with a random unusable email, generic name, cleared avatar, `deletedAt`, and the CUSTOMER role; login accounts, active sessions, saved addresses, and cart are removed. Orders are not cascade-deleted: their `userId` is set to `NULL`, copied customer name and phone are cleared, and the delivery snapshot is anonymized. Order items, amounts, payment and status history, and order identifiers remain for business records. See [the detailed retention note](docs/security-and-data-retention.md).

## Operational notes

- Prisma schema and migration are under `prisma/`; the existing Drizzle schema and auth configuration remain under `src/db/` and `src/lib/auth.ts`.
- Catalog reads use `src/lib/catalog/repository.ts`, which reads active products, images, variants, and available stock through Prisma when `DATABASE_URL` is configured.
- The admin route layout checks the current Better Auth session server-side; every admin mutation independently calls `requireAdmin`, and order reads scope by both order ID and authenticated user ID.
- Product removal uses archive/deactivation. It preserves product, variant, inventory, and order-item history. Image management stores HTTPS metadata only; no upload or object-storage provider is configured. Inventory rows retain the latest admin in `updatedBy`; a full before/after audit log remains future work.
- Keep database credentials and auth secrets server-only. `NEXT_PUBLIC_APP_URL` is a public origin, not a secret.
- `npm run create-admin` is a local/operations CLI that prompts for credentials without echoing the password. It uses Better Auth's password hash format and checks normalized email under a PostgreSQL advisory lock. It never changes an existing ADMIN. An existing active CUSTOMER can only be recovered into the first ADMIN identity after the operator types `PROMOTE`; that transaction updates the same user's Better Auth credential and revokes existing sessions. `npm run admin:promote -- email@example.com` remains a separate trusted-operator command for deliberate additional administrator promotion.
- `npm test` runs authentication and account integration tests against `TEST_DATABASE_URL`, which must point to a separate migrated PostgreSQL database. It does not use `DATABASE_URL` as a fallback.
- `npm run lint`, `npm run typecheck`, and `npm run build` are available for validation.
