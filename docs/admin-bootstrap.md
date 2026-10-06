# First administrator setup

The project has one role system: Better Auth accounts use the existing `CUSTOMER` and `ADMIN` role field. Public registration continues to force `CUSTOMER`; no role is accepted from registration input.

## New installation

1. Configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `KHALTI_ENVIRONMENT` in the server/provider environment. Run `npm run env:validate:production` before starting the production server.
2. On a new approved database, run `npm run db:validate`, `npx prisma migrate status`, and `npm run db:migrate:deploy` from the controlled release environment. Do not use `npm run db:migrate` or `npm run db:seed` in production.
3. From a trusted interactive terminal, run `npm run create-admin`.
4. Enter the owner's name and email. Enter and confirm a strong password at the hidden prompts. The password is hashed using Better Auth's existing `hashPassword` implementation before it is written to the credential account.
5. In development only, optionally run `npm run db:seed` to load sample catalog data. Production must not run the development seed; it already refuses when `NODE_ENV=production`.
6. Start the app using `npm start`, log in at `/login`, and open `/admin`.

The bootstrap is an explicit command. It does not run during package installation, builds, or application startup. It takes no credentials on the command line or in `NEXT_PUBLIC_*` variables and refuses to run without an interactive terminal.

## Existing-admin and concurrency behavior

`create-admin` acquires a PostgreSQL transaction advisory lock, checks whether any ADMIN exists, checks whether the requested normalized email already belongs to an account, and creates the user and Better Auth credential in one transaction. If the email already belongs to an ADMIN, setup stops without changing its password or account. If it belongs to an active CUSTOMER and there is no other ADMIN, the CLI offers a separate recovery path: the operator must type `PROMOTE`, then enter and confirm a new password at hidden prompts. Recovery promotes the same user row, normalizes that row's email, updates or creates its Better Auth credential, and revokes its existing sessions atomically. It never creates a second identity. A CUSTOMER is never promoted unless this explicit trusted CLI confirmation is given; public registration remains CUSTOMER-only.

If multiple rows already match the normalized email, the account is deactivated, another administrator already exists, or the credential records are ambiguous, recovery refuses without changing data. Resolve such staging data deliberately before retrying. Existing ADMIN passwords are never reset by this flow.

The transaction lock prevents concurrent first-admin commands from both succeeding. Public registration and Better Auth user creation normalize email to lowercase and check case-insensitively before inserting, so case variants resolve to the same identity.

The role system supports multiple administrators. `npm run admin:promote -- email@example.com` is retained as a separate, explicit trusted-operator command to promote an existing account or add another administrator. It must be used deliberately and is not part of first-admin setup.

## Development seed

When no administrator exists, the development seed retains its `dev-admin@najfancystore.test` placeholder for local catalog attribution. The placeholder has no credential and cannot log in. If a real administrator already exists, the seed reuses that user for `updatedBy` attribution without changing their name, role, or account. Run first-admin setup before seeding when setting up a new environment.

## Tests

The bootstrap integration test verifies first-admin creation, `ADMIN` role assignment, Better Auth login with the created password hash, refusal when an administrator already exists, and the shared role authorization rule. The existing auth integration test also submits `role=ADMIN` during public registration and verifies that the created account remains `CUSTOMER`.
