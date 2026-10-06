# Customer account deletion and order retention

Account deletion is an explicit, password-confirmed transaction. It does not delete the customer row because order, inventory, and audit history may refer to it, and it never cascades from a user into historical orders.

The deletion transaction:

1. Sets every historical order's `userId` to `NULL`, replaces the copied customer name with a generic label, clears the copied phone number, and replaces the delivery snapshot with a generic label and null personal delivery fields. Coarse address information is also removed from the copied snapshot.
2. Deletes active sessions, linked login accounts, temporary Better Auth verification records for the account, saved addresses, and the cart. Cart items disappear only through the cart's cascade because cart records are ephemeral.
3. Replaces the user email with a random `@invalid.local` tombstone address, replaces the name, clears the avatar, resets the role to CUSTOMER, and sets `deletedAt`.
4. Signs out the current browser after commit.

Orders, order items and their price/SKU snapshots, payment records, order status events, and stock movements remain available to authorized business operations. A deleted account cannot authenticate, and customer routes reject tombstoned users. Admin views show “Deleted customer” for historical orders whose account link has been removed.

The retention period for accounting, payment references, and order records must be set by the business with its Nepal accounting/privacy obligations. This implementation preserves those records without retaining direct customer contact or street address in the order snapshot. If the business requires stricter erasure, define the retention period and purge eligible records through a reviewed retention job; do not add a cascading user-to-order delete.

## Dependency security note

Prisma 7.10.0 declares `deepmerge-ts` 7.1.5, which is affected by GHSA-ggr8-5vv4-36mx. `package.json` overrides it to the patched 8.x line, and the lockfile resolves 8.0.2. Keep the override while Prisma pins a vulnerable release, and re-check/remove it after Prisma updates its dependency. Verify Prisma generation, validation, tests, and production build whenever changing this override.
