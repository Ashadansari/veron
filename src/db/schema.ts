import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["CUSTOMER", "ADMIN"]);
export const orderStatus = pgEnum("order_status", [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
]);
export const paymentStatus = pgEnum("payment_status", [
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
]);
export const paymentMethod = pgEnum("payment_method", ["COD", "PROVIDER"]);

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    phone: varchar("phone", { length: 20 }),
    role: userRole("role").notNull().default("CUSTOMER"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_role_idx").on(table.role), uniqueIndex("user_phone_unique").on(table.phone)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/** Shared Better Auth rate-limit counters for multi-instance deployments. */
export const rateLimit = pgTable(
  "rate_limit",
  {
    // Better Auth generates string IDs; the Drizzle adapter uses this ID for
    // its atomic conditional counter updates.
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("rate_limit_key_unique").on(table.key),
    index("rate_limit_last_request_idx").on(table.lastRequest),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("categories_slug_unique").on(table.slug)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    sku: varchar("sku", { length: 80 }),
    basePricePaisa: bigint("base_price_paisa", { mode: "bigint" }).notNull().default(0n),
    compareAtPricePaisa: bigint("compare_at_price_paisa", { mode: "bigint" }),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("products_slug_unique").on(table.slug),
    uniqueIndex("products_sku_unique").on(table.sku),
    index("products_category_active_idx").on(table.categoryId, table.active),
    check("products_base_price_nonnegative", sql.raw("base_price_paisa >= 0")),
    check("products_compare_price_valid", sql.raw("compare_at_price_paisa is null or compare_at_price_paisa > base_price_paisa")),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: varchar("alt_text", { length: 240 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("product_images_product_order_idx").on(table.productId, table.sortOrder)],
);

export const sizes = pgTable(
  "sizes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    label: varchar("label", { length: 40 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("sizes_label_unique").on(table.label)],
);

export const colors = pgTable(
  "colors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 60 }).notNull(),
    hex: varchar("hex", { length: 7 }),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("colors_name_unique").on(table.name)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sizeId: uuid("size_id").references(() => sizes.id, { onDelete: "set null" }),
    colorId: uuid("color_id").references(() => colors.id, { onDelete: "set null" }),
    sku: varchar("sku", { length: 80 }).notNull(),
    pricePaisa: bigint("price_paisa", { mode: "bigint" }).notNull(),
    salePricePaisa: bigint("sale_price_paisa", { mode: "bigint" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_variants_sku_unique").on(table.sku),
    index("product_variants_product_idx").on(table.productId),
    check("variant_price_nonnegative", sql.raw("price_paisa >= 0")),
    check(
      "variant_sale_price_valid",
      sql.raw("sale_price_paisa is null or (sale_price_paisa >= 0 and sale_price_paisa < price_paisa)"),
    ),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    variantId: uuid("variant_id").primaryKey().references(() => productVariants.id, { onDelete: "cascade" }),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    check("inventory_on_hand_nonnegative", sql.raw("on_hand >= 0")),
    check("inventory_reserved_valid", sql.raw("reserved >= 0 and reserved <= on_hand")),
    index("inventory_low_stock_idx").on(table.onHand),
  ],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 140 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    province: varchar("province", { length: 40 }).notNull(),
    district: varchar("district", { length: 80 }).notNull(),
    municipality: varchar("municipality", { length: 120 }).notNull(),
    wardNumber: integer("ward_number").notNull(),
    toleArea: varchar("tole_area", { length: 120 }).notNull(),
    streetAddress: varchar("street_address", { length: 240 }).notNull(),
    postalCode: varchar("postal_code", { length: 15 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("addresses_user_idx").on(table.userId),
    check("address_ward_positive", sql.raw("ward_number > 0")),
  ],
);

export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cart_items_cart_variant_unique").on(table.cartId, table.variantId),
    check("cart_item_quantity_valid", sql.raw("quantity between 1 and 20")),
  ],
);

export const shippingRules = pgTable(
  "shipping_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    province: varchar("province", { length: 40 }),
    district: varchar("district", { length: 80 }),
    chargePaisa: bigint("charge_paisa", { mode: "bigint" }).notNull(),
    freeShippingThresholdPaisa: bigint("free_shipping_threshold_paisa", { mode: "bigint" }),
    codEnabled: boolean("cod_enabled").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("shipping_rules_match_idx").on(table.active, table.province, table.district, table.priority),
    check("shipping_charge_nonnegative", sql.raw("charge_paisa >= 0")),
    check(
      "shipping_threshold_nonnegative",
      sql.raw("free_shipping_threshold_paisa is null or free_shipping_threshold_paisa >= 0"),
    ),
  ],
);

export const storeSettings = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: varchar("store_name", { length: 120 }).notNull().default("Naj Fancy Store"),
  currency: varchar("currency", { length: 3 }).notNull().default("NPR"),
  locale: varchar("locale", { length: 12 }).notNull().default("ne-NP"),
  timeZone: varchar("time_zone", { length: 40 }).notNull().default("Asia/Kathmandu"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  shippingChargePaisa: bigint("shipping_charge_paisa", { mode: "bigint" }).notNull().default(0n),
  freeShippingThresholdPaisa: bigint("free_shipping_threshold_paisa", { mode: "bigint" }),
  contactEmail: varchar("contact_email", { length: 254 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  codEnabled: boolean("cod_enabled").notNull().default(true),
  storeActive: boolean("store_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: varchar("order_number", { length: 32 }).notNull().unique(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 140 }).notNull().default(""),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull().default(""),
    status: orderStatus("status").notNull().default("PLACED"),
    paymentStatus: paymentStatus("payment_status").notNull().default("UNPAID"),
    paymentMethod: paymentMethod("payment_method").notNull(),
    paymentProvider: varchar("payment_provider", { length: 80 }),
    currency: varchar("currency", { length: 3 }).notNull().default("NPR"),
    subtotalPaisa: bigint("subtotal_paisa", { mode: "bigint" }).notNull(),
    shippingPaisa: bigint("shipping_paisa", { mode: "bigint" }).notNull(),
    totalPaisa: bigint("total_paisa", { mode: "bigint" }).notNull(),
    shippingRuleId: uuid("shipping_rule_id").references(() => shippingRules.id, { onDelete: "set null" }),
    shippingRuleName: varchar("shipping_rule_name", { length: 120 }).notNull(),
    shippingAddressSnapshot: jsonb("shipping_address_snapshot").notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("orders_user_placed_idx").on(table.userId, table.placedAt),
    index("orders_status_placed_idx").on(table.status, table.placedAt),
    check(
      "order_totals_nonnegative",
      sql.raw("subtotal_paisa >= 0 and shipping_paisa >= 0 and total_paisa >= 0"),
    ),
    check(
      "order_total_matches_components",
      sql.raw("total_paisa = subtotal_paisa + shipping_paisa"),
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 180 }).notNull(),
    sku: varchar("sku", { length: 80 }).notNull(),
    variantLabel: varchar("variant_label", { length: 160 }).notNull(),
    selectedSize: varchar("selected_size", { length: 40 }),
    selectedColor: varchar("selected_color", { length: 60 }),
    unitPricePaisa: bigint("unit_price_paisa", { mode: "bigint" }).notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalPaisa: bigint("line_total_paisa", { mode: "bigint" }).notNull(),
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    check(
      "order_item_totals_nonnegative",
      sql.raw("unit_price_paisa >= 0 and quantity > 0 and line_total_paisa >= 0"),
    ),
  ],
);

export const paymentRecords = pgTable(
  "payment_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerReference: varchar("provider_reference", { length: 180 }),
    providerTransactionId: varchar("provider_transaction_id", { length: 180 }),
    amountPaisa: bigint("amount_paisa", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("NPR"),
    status: paymentStatus("status").notNull().default("PENDING"),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("payment_records_order_idx").on(table.orderId),
    index("payment_records_provider_transaction_idx").on(table.providerTransactionId),
    uniqueIndex("payment_records_provider_reference_unique").on(table.provider, table.providerReference),
    check("payment_amount_nonnegative", sql.raw("amount_paisa >= 0")),
  ],
);

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_status_events_order_idx").on(table.orderId, table.createdAt)],
);

export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 48 }).notNull(),
    payload: jsonb("payload").$type<Record<string, string>>().notNull().default({}),
    dedupeKey: varchar("dedupe_key", { length: 180 }).notNull().unique(),
    adminReadAt: timestamp("admin_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_events_user_created_idx").on(table.userId, table.createdAt),
    index("notification_events_order_created_idx").on(table.orderId, table.createdAt),
    index("notification_events_admin_feed_idx").on(table.eventType, table.createdAt),
    check("notification_event_type_valid", sql.raw("event_type in ('ORDER_PLACED', 'COD_ORDER_CONFIRMATION', 'ONLINE_PAYMENT_SUCCESS', 'PAYMENT_FAILURE', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED', 'NEW_ORDER')")),
  ],
);
