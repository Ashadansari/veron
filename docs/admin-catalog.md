# Admin catalog operations

The `/admin` route group is protected in its server layout with the current Better Auth session. Unauthenticated requests redirect to login, and signed-in customers receive a not-found response. The server actions still call `requireAdmin` for every mutation; hiding a control in the UI is never treated as authorization.

## Catalog management

Admins can search, filter, sort, create, edit, archive, and reactivate products; manage categories, sizes, colors, variant prices and SKUs; add/edit/reorder/remove image metadata; and update inventory. Product and variant prices are parsed from decimal NPR strings into integer paisa on the server. Stock is a bounded nonnegative integer and cannot be set below reserved stock. Mutations validate the referenced product, category, size, color, image, or variant. A product must have an active variant before it can be activated. Variant combinations are checked under a product row lock, and image primary selection is serialized under the same lock.

The product base price is retained for catalog display and comparison, while each purchasable variant has its own regular and optional sale price. Sale and compare-at prices must be less than their corresponding regular/current prices.

## Archiving and historical records

The dashboard does not hard-delete products or categories. Product removal means setting `active` to false; this keeps product and variant references, inventory, and historical order-item snapshots intact. Categories can be deactivated, while existing product references remain valid. Removing an externally hosted image deletes only its metadata row. Removing a locally uploaded image also deletes its single generated file, but only when its URL matches the application's generated upload path. Database `ON DELETE` behavior remains a backstop for future operations, but ordinary admin workflows do not delete referenced catalog data.

## Images, inventory attribution, and audit history

Image management stores a URL, alt text, display order, and primary-image flag. Admins can continue to add HTTPS image URLs, or upload one JPEG, PNG, or WebP image up to 5 MiB from the product edit page. Uploaded bytes are signature-checked, written with a random UUID filename under `public/uploads/products/`, then recorded in the existing `product_images` table. The upload action requires ADMIN server-side and is disabled in production. Local/staging uploads are ignored by Git and are not durable deployment storage. The storefront continues to render the saved URL through its existing image path.

This local filesystem upload path exists only for staging/local verification. Production deployments with ephemeral or multi-instance filesystems must keep using durable HTTPS-hosted assets until a separate production storage design is approved; do not rely on `public/uploads/products/` for production assets.

Inventory stores the most recent admin in `updatedBy` and the update timestamp. The system does not yet retain before/after snapshots for catalog, pricing, category, variant, or image changes. A full append-only admin audit log should be added before broader operational workflows depend on historical change attribution.

## Admin routes

- `/admin`: database-backed product, category, inventory, low-stock, customer, and recent-product statistics.
- `/admin/products`, `/admin/products/new`, `/admin/products/[id]`, `/admin/products/[id]/edit`
- `/admin/categories`, `/admin/inventory`
- `/admin/customers`: searchable, read-only customer records with customer-scoped order history. Account deletion/anonymization remains a customer account workflow; the admin view does not delete or alter historical customer/order records.
- `/admin/orders`, `/admin/settings`: store operations routes.

Categories, sizes, and colors are database-backed and searchable in their management page and in product/variant forms. Variant combinations are selected as separate size and color options on the storefront; unavailable combinations are disabled or marked unavailable, and add-to-cart still validates the exact variant and available inventory on the server.

Admin integration tests use `TEST_DATABASE_URL`, which must be a separate PostgreSQL database. The test runner refuses to substitute the configured development `DATABASE_URL` unless the test variable is explicitly set.
