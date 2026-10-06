-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('COD', 'PROVIDER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phone" VARCHAR(20),
    "role" "user_role" NOT NULL DEFAULT 'CUSTOMER',
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "refresh_token_expires_at" TIMESTAMPTZ(6),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sku" VARCHAR(80),
    "base_price_paisa" BIGINT NOT NULL DEFAULT 0,
    "compare_at_price_paisa" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" VARCHAR(240) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sizes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(60) NOT NULL,
    "hex" VARCHAR(7),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "size_id" UUID,
    "color_id" UUID,
    "sku" VARCHAR(80) NOT NULL,
    "price_paisa" BIGINT NOT NULL,
    "sale_price_paisa" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "variant_id" UUID NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("variant_id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "full_name" VARCHAR(140) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "province" VARCHAR(40) NOT NULL,
    "district" VARCHAR(80) NOT NULL,
    "municipality" VARCHAR(120) NOT NULL,
    "ward_number" INTEGER NOT NULL,
    "tole_area" VARCHAR(120) NOT NULL,
    "street_address" VARCHAR(240) NOT NULL,
    "postal_code" VARCHAR(15),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "province" VARCHAR(40),
    "district" VARCHAR(80),
    "charge_paisa" BIGINT NOT NULL,
    "free_shipping_threshold_paisa" BIGINT,
    "cod_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_number" VARCHAR(32) NOT NULL,
    "user_id" TEXT,
    "customer_name" VARCHAR(140) NOT NULL DEFAULT '',
    "customer_phone" VARCHAR(20) NOT NULL DEFAULT '',
    "status" "order_status" NOT NULL DEFAULT 'PLACED',
    "payment_status" "payment_status" NOT NULL DEFAULT 'UNPAID',
    "payment_method" "payment_method" NOT NULL,
    "payment_provider" VARCHAR(80),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NPR',
    "subtotal_paisa" BIGINT NOT NULL,
    "shipping_paisa" BIGINT NOT NULL,
    "total_paisa" BIGINT NOT NULL,
    "shipping_rule_id" UUID,
    "shipping_rule_name" VARCHAR(120) NOT NULL,
    "shipping_address_snapshot" JSONB NOT NULL,
    "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "variant_id" UUID,
    "product_name" VARCHAR(180) NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "variant_label" VARCHAR(160) NOT NULL,
    "selected_size" VARCHAR(40),
    "selected_color" VARCHAR(60),
    "unit_price_paisa" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_paisa" BIGINT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "provider_reference" VARCHAR(180),
    "amount_paisa" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NPR',
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "store_name" VARCHAR(120) NOT NULL DEFAULT 'Naj Fancy Store',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NPR',
    "locale" VARCHAR(12) NOT NULL DEFAULT 'ne-NP',
    "time_zone" VARCHAR(40) NOT NULL DEFAULT 'Asia/Kathmandu',
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "shipping_charge_paisa" BIGINT NOT NULL DEFAULT 0,
    "free_shipping_threshold_paisa" BIGINT,
    "contact_email" VARCHAR(254),
    "contact_phone" VARCHAR(20),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "changed_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_unique" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_unique" ON "user"("phone");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_unique" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_unique" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_unique" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_active_idx" ON "products"("category_id", "active");

-- CreateIndex
CREATE INDEX "product_images_product_order_idx" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_label_unique" ON "sizes"("label");

-- CreateIndex
CREATE UNIQUE INDEX "colors_name_unique" ON "colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_unique" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "inventory_low_stock_idx" ON "inventory"("on_hand");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_unique" ON "carts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_variant_unique" ON "cart_items"("cart_id", "variant_id");

-- CreateIndex
CREATE INDEX "addresses_user_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "shipping_rules_match_idx" ON "shipping_rules"("active", "province", "district", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_unique" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_placed_idx" ON "orders"("user_id", "placed_at");

-- CreateIndex
CREATE INDEX "orders_status_placed_idx" ON "orders"("status", "placed_at");

-- CreateIndex
CREATE INDEX "order_items_order_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_idempotency_key_unique" ON "payment_records"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_records_order_idx" ON "payment_records"("order_id");

-- CreateIndex
CREATE INDEX "order_status_events_order_idx" ON "order_status_events"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_rule_id_fkey" FOREIGN KEY ("shipping_rule_id") REFERENCES "shipping_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add domain constraints Prisma Schema Language does not currently express.
ALTER TABLE "products" ADD CONSTRAINT "products_base_price_nonnegative" CHECK ("base_price_paisa" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_compare_price_valid" CHECK ("compare_at_price_paisa" IS NULL OR "compare_at_price_paisa" > "base_price_paisa");
ALTER TABLE "product_variants" ADD CONSTRAINT "variant_price_nonnegative" CHECK ("price_paisa" >= 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "variant_sale_price_valid" CHECK ("sale_price_paisa" IS NULL OR ("sale_price_paisa" >= 0 AND "sale_price_paisa" < "price_paisa"));
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_on_hand_nonnegative" CHECK ("on_hand" >= 0);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_reserved_valid" CHECK ("reserved" >= 0 AND "reserved" <= "on_hand");
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_threshold_nonnegative" CHECK ("low_stock_threshold" >= 0);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_item_quantity_valid" CHECK ("quantity" BETWEEN 1 AND 20);
ALTER TABLE "addresses" ADD CONSTRAINT "address_ward_positive" CHECK ("ward_number" > 0);
ALTER TABLE "shipping_rules" ADD CONSTRAINT "shipping_charge_nonnegative" CHECK ("charge_paisa" >= 0);
ALTER TABLE "shipping_rules" ADD CONSTRAINT "shipping_threshold_nonnegative" CHECK ("free_shipping_threshold_paisa" IS NULL OR "free_shipping_threshold_paisa" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "order_totals_nonnegative" CHECK ("subtotal_paisa" >= 0 AND "shipping_paisa" >= 0 AND "total_paisa" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "order_total_matches_components" CHECK ("total_paisa" = "subtotal_paisa" + "shipping_paisa");
ALTER TABLE "order_items" ADD CONSTRAINT "order_item_totals_nonnegative" CHECK ("unit_price_paisa" >= 0 AND "quantity" > 0 AND "line_total_paisa" >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_item_total_matches_components" CHECK ("line_total_paisa" = "unit_price_paisa" * "quantity");
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_amount_nonnegative" CHECK ("amount_paisa" >= 0);
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_threshold_nonnegative" CHECK ("low_stock_threshold" >= 0 AND "shipping_charge_paisa" >= 0 AND ("free_shipping_threshold_paisa" IS NULL OR "free_shipping_threshold_paisa" >= 0));
CREATE UNIQUE INDEX "product_images_one_primary_idx" ON "product_images" ("product_id") WHERE "is_primary" = true;
