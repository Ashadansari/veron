import "server-only";

import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import { categories, colors, inventory, productImages, productVariants, products, sizes } from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { parseNprToPaisa } from "@/lib/commerce/money";

export type AdminActor = { userId: string; role: string };

function authorize(actor: AdminActor) {
  assertRole(actor.role, "ADMIN");
}

function raiseDatabaseConflict(error: unknown, fallback: string): never {
  let cause: unknown = error;
  for (let depth = 0; depth < 4 && typeof cause === "object" && cause !== null; depth += 1) {
    if ("code" in cause && cause.code === "23505") {
      throw new Error("A record with that slug, SKU, or variant combination already exists.");
    }
    cause = "cause" in cause ? cause.cause : null;
  }
  throw error instanceof Error ? error : new Error(fallback);
}

const slugSchema = z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens for the slug.");
const idSchema = z.string().uuid();
const priceSchema = z.string().trim().min(1).max(16);

export async function saveAdminCategory(actor: AdminActor, input: unknown) {
  authorize(actor);
  const parsed = z.object({
    id: idSchema.optional(),
    name: z.string().trim().min(2).max(100).transform((value) => value.replace(/\s+/g, " ")),
    slug: z.string().trim().toLowerCase().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens for the slug."),
    description: z.string().trim().max(1000),
    active: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Category details are invalid.");
  const db = getDatabase();
  const values = { name: parsed.data.name, slug: parsed.data.slug, description: parsed.data.description || null, active: parsed.data.active, updatedAt: new Date() };
  try {
    return await db.transaction(async (tx) => {
      const normalizedName = parsed.data.name.toLowerCase();
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`category:${normalizedName}`}, 0))`);
      if (parsed.data.id) {
        const [existing] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, parsed.data.id)).limit(1);
        if (!existing) throw new Error("Category not found.");
      }
      const [nameOwner] = await tx.select({ id: categories.id }).from(categories)
        .where(sql`lower(${categories.name}) = ${normalizedName}`).limit(1);
      if (nameOwner && nameOwner.id !== parsed.data.id) throw new Error("That category name is already in use.");
      const [slugOwner] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, parsed.data.slug)).limit(1);
      if (slugOwner && slugOwner.id !== parsed.data.id) throw new Error("That category slug is already in use.");
      if (parsed.data.id) {
        await tx.update(categories).set(values).where(eq(categories.id, parsed.data.id));
        return parsed.data.id;
      }
      const [created] = await tx.insert(categories).values(values).returning({ id: categories.id });
      return created.id;
    });
  } catch (error) { raiseDatabaseConflict(error, "Could not save the category."); }
}

const normalizedOptionName = (value: string) => value.trim().replace(/\s+/g, " ");

export async function saveAdminSize(actor: AdminActor, input: unknown) {
  authorize(actor);
  const parsed = z.object({
    id: idSchema.optional(),
    label: z.string().trim().min(1).max(40).transform(normalizedOptionName),
    sortOrder: z.number().int().min(0).max(10000),
    active: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Size details are invalid.");
  const db = getDatabase();
  const normalized = parsed.data.label.toLowerCase();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`size:${normalized}`}, 0))`);
      if (parsed.data.id) {
        const [existing] = await tx.select({ id: sizes.id }).from(sizes).where(eq(sizes.id, parsed.data.id)).limit(1);
        if (!existing) throw new Error("Size option not found.");
      }
      const [duplicate] = await tx.select({ id: sizes.id }).from(sizes).where(sql`lower(${sizes.label}) = ${normalized}`).limit(1);
      if (duplicate && duplicate.id !== parsed.data.id) throw new Error("That size already exists.");
      const values = { label: parsed.data.label, sortOrder: parsed.data.sortOrder, active: parsed.data.active };
      if (parsed.data.id) {
        await tx.update(sizes).set(values).where(eq(sizes.id, parsed.data.id));
        return parsed.data.id;
      }
      const [created] = await tx.insert(sizes).values(values).returning({ id: sizes.id });
      return created.id;
    });
  } catch (error) { raiseDatabaseConflict(error, "Could not save the size option."); }
}

export async function saveAdminColor(actor: AdminActor, input: unknown) {
  authorize(actor);
  const parsed = z.object({
    id: idSchema.optional(),
    name: z.string().trim().min(1).max(60).transform(normalizedOptionName),
    hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal("")),
    active: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Color details are invalid.");
  const db = getDatabase();
  const normalized = parsed.data.name.toLowerCase();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`color:${normalized}`}, 0))`);
      if (parsed.data.id) {
        const [existing] = await tx.select({ id: colors.id }).from(colors).where(eq(colors.id, parsed.data.id)).limit(1);
        if (!existing) throw new Error("Color option not found.");
      }
      const [duplicate] = await tx.select({ id: colors.id }).from(colors).where(sql`lower(${colors.name}) = ${normalized}`).limit(1);
      if (duplicate && duplicate.id !== parsed.data.id) throw new Error("That color already exists.");
      const values = { name: parsed.data.name, hex: parsed.data.hex ? parsed.data.hex.toUpperCase() : null, active: parsed.data.active };
      if (parsed.data.id) {
        await tx.update(colors).set(values).where(eq(colors.id, parsed.data.id));
        return parsed.data.id;
      }
      const [created] = await tx.insert(colors).values(values).returning({ id: colors.id });
      return created.id;
    });
  } catch (error) { raiseDatabaseConflict(error, "Could not save the color option."); }
}

export async function setAdminCategoryActive(actor: AdminActor, input: unknown, active: boolean) {
  authorize(actor);
  const id = idSchema.safeParse(input);
  if (!id.success) throw new Error("Invalid category ID.");
  const [updated] = await getDatabase().update(categories).set({ active, updatedAt: new Date() })
    .where(eq(categories.id, id.data)).returning({ id: categories.id });
  if (!updated) throw new Error("Category not found.");
}

const productInputSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(2).max(180),
  slug: slugSchema,
  description: z.string().trim().max(12000),
  categoryId: z.union([idSchema, z.literal("")]),
  sku: z.string().trim().max(80),
  priceNpr: priceSchema,
  compareAtPriceNpr: z.string().trim().max(16),
  active: z.boolean(),
});

export async function saveAdminProduct(actor: AdminActor, input: unknown) {
  authorize(actor);
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Product details are invalid.");
  const pricePaisa = parseNprToPaisa(parsed.data.priceNpr);
  const compareAtPricePaisa = parsed.data.compareAtPriceNpr ? parseNprToPaisa(parsed.data.compareAtPriceNpr) : null;
  if (compareAtPricePaisa !== null && compareAtPricePaisa <= pricePaisa) {
    throw new Error("Original price must be greater than the current price.");
  }
  if (parsed.data.active && !parsed.data.id) {
    throw new Error("Create the product as inactive, add an active purchasable variant, then activate it.");
  }
  const db = getDatabase();
  if (parsed.data.id) {
    const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.id, parsed.data.id)).limit(1);
    if (!existing) throw new Error("Product not found.");
  }
  if (parsed.data.active && parsed.data.id) {
    const [purchasableVariant] = await db.select({ id: productVariants.id }).from(productVariants)
      .where(and(eq(productVariants.productId, parsed.data.id), eq(productVariants.active, true))).limit(1);
    if (!purchasableVariant) throw new Error("Add an active purchasable variant before activating this product.");
  }
  if (parsed.data.categoryId) {
    const [category] = await db.select({ id: categories.id, active: categories.active }).from(categories)
      .where(eq(categories.id, parsed.data.categoryId)).limit(1);
    if (!category || (parsed.data.active && !category.active)) throw new Error("Choose an existing active category for an active product.");
  }
  const [slugOwner] = await db.select({ id: products.id }).from(products).where(eq(products.slug, parsed.data.slug)).limit(1);
  if (slugOwner && slugOwner.id !== parsed.data.id) throw new Error("That product slug is already in use.");
  const sku = parsed.data.sku || null;
  if (sku) {
    const [skuOwner] = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku)).limit(1);
    if (skuOwner && skuOwner.id !== parsed.data.id) throw new Error("That product SKU is already in use.");
  }
  const values = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    categoryId: parsed.data.categoryId || null,
    sku,
    basePricePaisa: pricePaisa,
    compareAtPricePaisa,
    active: parsed.data.active,
    updatedAt: new Date(),
  };
  try {
    if (parsed.data.id) {
      const [updated] = await db.update(products).set(values).where(eq(products.id, parsed.data.id)).returning({ id: products.id });
      if (!updated) throw new Error("Product not found.");
      return updated.id;
    }
    const [created] = await db.insert(products).values(values).returning({ id: products.id });
    return created.id;
  } catch (error) { raiseDatabaseConflict(error, "Could not save the product."); }
}

export async function setAdminProductActive(actor: AdminActor, input: unknown, active: boolean) {
  authorize(actor);
  const id = idSchema.safeParse(input);
  if (!id.success) throw new Error("Invalid product ID.");
  const [existing] = await getDatabase().select({ id: products.id }).from(products).where(eq(products.id, id.data)).limit(1);
  if (!existing) throw new Error("Product not found.");
  if (active) {
    const [variant] = await getDatabase().select({ id: productVariants.id }).from(productVariants)
      .where(and(eq(productVariants.productId, id.data), eq(productVariants.active, true))).limit(1);
    if (!variant) throw new Error("Add an active purchasable variant before activating this product.");
  }
  const [updated] = await getDatabase().update(products).set({ active, updatedAt: new Date() })
    .where(eq(products.id, id.data)).returning({ id: products.id });
  if (!updated) throw new Error("Product not found.");
}

const variantInputSchema = z.object({
  id: idSchema.optional(),
  productId: idSchema,
  sizeId: z.union([idSchema, z.literal("")]),
  colorId: z.union([idSchema, z.literal("")]),
  sku: z.string().trim().min(2).max(80),
  priceNpr: priceSchema,
  salePriceNpr: z.string().trim().max(16),
  active: z.boolean(),
  initialStock: z.number().int().min(0).max(100000).optional(),
});

export async function saveAdminVariant(actor: AdminActor, input: unknown) {
  authorize(actor);
  const parsed = variantInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Variant details are invalid.");
  const pricePaisa = parseNprToPaisa(parsed.data.priceNpr);
  const salePricePaisa = parsed.data.salePriceNpr ? parseNprToPaisa(parsed.data.salePriceNpr) : null;
  if (salePricePaisa !== null && salePricePaisa >= pricePaisa) throw new Error("Sale price must be lower than the regular price.");
  const db = getDatabase();
  try {
    await db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, parsed.data.productId)).for("update").limit(1);
    if (!product) throw new Error("Product not found.");
    if (parsed.data.id) {
      const [existing] = await tx.select({ id: productVariants.id, productId: productVariants.productId }).from(productVariants)
        .where(eq(productVariants.id, parsed.data.id)).limit(1);
      if (!existing || existing.productId !== parsed.data.productId) throw new Error("Variant not found for this product.");
      if (!parsed.data.active) {
        const [ownerProduct] = await tx.select({ active: products.active }).from(products).where(eq(products.id, parsed.data.productId)).limit(1);
        const [otherActive] = await tx.select({ id: productVariants.id }).from(productVariants)
          .where(and(eq(productVariants.productId, parsed.data.productId), eq(productVariants.active, true), sql`${productVariants.id} <> ${parsed.data.id}`)).limit(1);
        if (ownerProduct?.active && !otherActive) throw new Error("Deactivate the product or activate another variant before disabling its last active variant.");
      }
    }
    if (parsed.data.sizeId) {
      const [size] = await tx.select({ id: sizes.id, active: sizes.active }).from(sizes).where(eq(sizes.id, parsed.data.sizeId)).limit(1);
      if (!size || !size.active) throw new Error("Choose an active size.");
    }
    if (parsed.data.colorId) {
      const [color] = await tx.select({ id: colors.id, active: colors.active }).from(colors).where(eq(colors.id, parsed.data.colorId)).limit(1);
      if (!color || !color.active) throw new Error("Choose an active color.");
    }
    const [skuOwner] = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, parsed.data.sku)).limit(1);
    if (skuOwner && skuOwner.id !== parsed.data.id) throw new Error("That variant SKU is already in use.");
    const combination = and(
      eq(productVariants.productId, parsed.data.productId),
      parsed.data.sizeId ? eq(productVariants.sizeId, parsed.data.sizeId) : isNull(productVariants.sizeId),
      parsed.data.colorId ? eq(productVariants.colorId, parsed.data.colorId) : isNull(productVariants.colorId),
    );
    const [duplicate] = await tx.select({ id: productVariants.id }).from(productVariants).where(combination).limit(1);
    if (duplicate && duplicate.id !== parsed.data.id) throw new Error("This size and color combination already exists for the product.");
    const values = {
      productId: parsed.data.productId,
      sizeId: parsed.data.sizeId || null,
      colorId: parsed.data.colorId || null,
      sku: parsed.data.sku,
      pricePaisa,
      salePricePaisa,
      active: parsed.data.active,
      updatedAt: new Date(),
    };
    if (parsed.data.id) {
      await tx.update(productVariants).set(values).where(eq(productVariants.id, parsed.data.id));
    } else {
      const [created] = await tx.insert(productVariants).values(values).returning({ id: productVariants.id });
      await tx.insert(inventory).values({ variantId: created.id, onHand: parsed.data.initialStock ?? 0, updatedBy: actor.userId });
    }
    });
  } catch (error) { raiseDatabaseConflict(error, "Could not save the variant."); }
}

const imageMetadataSchema = z.object({
  id: idSchema.optional(),
  productId: idSchema,
  altText: z.string().trim().min(2).max(240),
  sortOrder: z.number().int().min(0).max(10000),
  isPrimary: z.boolean(),
});

const imageInputSchema = imageMetadataSchema.extend({
  url: z.string().trim().url().max(2048).refine((value) => new URL(value).protocol === "https:", "Use an HTTPS image URL."),
});

const uploadedImageInputSchema = imageMetadataSchema.extend({
  url: z.string().regex(/^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i, "Invalid local product image URL."),
});

async function persistAdminImage(input: z.infer<typeof imageMetadataSchema> & { url: string }) {
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, input.productId)).for("update").limit(1);
    if (!product) throw new Error("Product not found.");
    if (input.id) {
      const [existing] = await tx.select({ id: productImages.id, productId: productImages.productId }).from(productImages)
        .where(eq(productImages.id, input.id)).limit(1);
      if (!existing || existing.productId !== input.productId) throw new Error("Image not found for this product.");
    }
    if (input.isPrimary) {
      await tx.update(productImages).set({ isPrimary: false, updatedAt: new Date() }).where(eq(productImages.productId, input.productId));
    }
    const values = {
      productId: input.productId,
      url: input.url,
      altText: input.altText,
      sortOrder: input.sortOrder,
      isPrimary: input.isPrimary,
      updatedAt: new Date(),
    };
    if (input.id) await tx.update(productImages).set(values).where(eq(productImages.id, input.id));
    else await tx.insert(productImages).values(values);
  });
}

export async function saveAdminImage(actor: AdminActor, input: unknown) {
  authorize(actor);
  const parsed = imageInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Image details are invalid.");
  await persistAdminImage(parsed.data);
}

export async function saveAdminUploadedImage(actor: AdminActor, input: unknown) {
  authorize(actor);
  const parsed = uploadedImageInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Uploaded image details are invalid.");
  await persistAdminImage(parsed.data);
}

export async function removeAdminImage(actor: AdminActor, input: unknown) {
  authorize(actor);
  const id = idSchema.safeParse(input);
  if (!id.success) throw new Error("Invalid image ID.");
  const [removed] = await getDatabase().delete(productImages).where(eq(productImages.id, id.data)).returning({ id: productImages.id, url: productImages.url });
  if (!removed) throw new Error("Image not found.");
  return removed.url;
}

export async function updateAdminInventory(actor: AdminActor, input: unknown) {
  authorize(actor);
  const parsed = z.object({ variantId: idSchema, onHand: z.number().int().min(0).max(100000) }).safeParse(input);
  if (!parsed.success) throw new Error("Stock must be a nonnegative whole number.");
  const [updated] = await getDatabase().update(inventory).set({ onHand: parsed.data.onHand, updatedBy: actor.userId, updatedAt: new Date() })
    .where(and(eq(inventory.variantId, parsed.data.variantId), sql`${inventory.reserved} <= ${parsed.data.onHand}`))
    .returning({ variantId: inventory.variantId });
  if (!updated) throw new Error("Variant not found, or stock cannot be set below its reserved quantity.");
}

export async function getAdminProducts(filters: { query?: string; categoryId?: string; active?: string; sort?: string }) {
  const db = getDatabase();
  const where = and(
    filters.query ? ilike(products.name, `%${filters.query.slice(0, 100)}%`) : undefined,
    filters.categoryId && idSchema.safeParse(filters.categoryId).success ? eq(products.categoryId, filters.categoryId) : undefined,
    filters.active === "active" ? eq(products.active, true) : filters.active === "inactive" ? eq(products.active, false) : undefined,
  );
  const orderBy = filters.sort === "name" ? asc(products.name) : filters.sort === "price" ? asc(products.basePricePaisa) : sql`${products.updatedAt} desc`;
  return db.select({ product: products, categoryName: categories.name }).from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id)).where(where).orderBy(orderBy);
}

export async function getAdminProduct(id: string) {
  if (!idSchema.safeParse(id).success) return null;
  const db = getDatabase();
  const [product] = await db.select({ product: products, categoryName: categories.name }).from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id)).where(eq(products.id, id)).limit(1);
  if (!product) return null;
  const [images, variants, allSizes, allColors] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder)),
    db.select({ variant: productVariants, stock: inventory.onHand, reserved: inventory.reserved, sizeLabel: sizes.label, colorName: colors.name })
      .from(productVariants).innerJoin(inventory, eq(inventory.variantId, productVariants.id))
      .leftJoin(sizes, eq(productVariants.sizeId, sizes.id)).leftJoin(colors, eq(productVariants.colorId, colors.id))
      .where(eq(productVariants.productId, id)).orderBy(asc(productVariants.createdAt)),
    db.select().from(sizes).orderBy(asc(sizes.sortOrder)),
    db.select().from(colors).orderBy(asc(colors.name)),
  ]);
  return { ...product, images, variants, sizes: allSizes, colors: allColors };
}

export async function getAdminCategory(id: string) {
  if (!idSchema.safeParse(id).success) return null;
  const [category] = await getDatabase().select().from(categories).where(eq(categories.id, id)).limit(1);
  return category ?? null;
}

export async function getAdminInventory() {
  return getDatabase().select({
    variantId: productVariants.id,
    productId: products.id,
    productName: products.name,
    productActive: products.active,
    variantActive: productVariants.active,
    sku: productVariants.sku,
    sizeLabel: sizes.label,
    colorName: colors.name,
    onHand: inventory.onHand,
    reserved: inventory.reserved,
    threshold: inventory.lowStockThreshold,
  }).from(inventory).innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(sizes, eq(productVariants.sizeId, sizes.id)).leftJoin(colors, eq(productVariants.colorId, colors.id))
    .orderBy(asc(products.name), asc(productVariants.sku));
}
