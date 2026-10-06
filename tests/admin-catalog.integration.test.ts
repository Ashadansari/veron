import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db";
import { categories, colors, inventory, orderItems, orders, productImages, products, productVariants, sizes, user } from "@/db/schema";
import { assertRole, AuthorizationError } from "@/lib/authz";
import {
  removeAdminImage,
  saveAdminCategory,
  saveAdminColor,
  saveAdminImage,
  saveAdminProduct,
  saveAdminSize,
  saveAdminVariant,
  setAdminCategoryActive,
  setAdminProductActive,
  updateAdminInventory,
} from "@/lib/admin/catalog-service";

const suffix = randomUUID();
const adminId = randomUUID();
const adminActor = { userId: adminId, role: "ADMIN" };
const customerActor = { userId: randomUUID(), role: "CUSTOMER" };
const categoryIds: string[] = [];
const productIds: string[] = [];
const sizeIds: string[] = [];
const colorIds: string[] = [];
const orderIds: string[] = [];
const orderItemIds: string[] = [];

before(async () => {
  await getDatabase().insert(user).values({
    id: adminId,
    name: "Phase Five Admin",
    email: `phase5-admin-${suffix}@example.test`,
    role: "ADMIN",
  });
});

after(async () => {
  const db = getDatabase();
  if (orderItemIds.length) await db.delete(orderItems).where(inArray(orderItems.id, orderItemIds));
  if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));
  if (productIds.length) await db.delete(products).where(inArray(products.id, productIds));
  if (categoryIds.length) await db.delete(categories).where(inArray(categories.id, categoryIds));
  if (sizeIds.length) await db.delete(sizes).where(inArray(sizes.id, sizeIds));
  if (colorIds.length) await db.delete(colors).where(inArray(colors.id, colorIds));
  await db.delete(user).where(eq(user.id, adminId));
});

test("admin catalog services enforce authorization, validation, and historical safety", async (t) => {
  const db = getDatabase();

  await t.test("customers cannot reach catalog mutation services", async () => {
    const validProduct = {
      name: "Unauthorized Item", slug: `unauthorized-${suffix}`, description: "", categoryId: "", sku: "",
      priceNpr: "10.00", compareAtPriceNpr: "", active: false,
    };
    const customerDenied = (error: unknown) => error instanceof AuthorizationError && error.status === 403;
    const unauthenticatedActor = { userId: "", role: "" };
    const unauthenticatedDenied = (error: unknown) => error instanceof AuthorizationError && error.status === 401;
    assert.throws(() => assertRole(undefined, "ADMIN"), unauthenticatedDenied);
    await assert.rejects(() => saveAdminProduct(unauthenticatedActor, validProduct), unauthenticatedDenied);
    await assert.rejects(() => setAdminProductActive(unauthenticatedActor, randomUUID(), false), unauthenticatedDenied);
    await assert.rejects(() => saveAdminCategory(unauthenticatedActor, { name: "No", slug: "no", description: "", active: true }), unauthenticatedDenied);
    await assert.rejects(() => setAdminCategoryActive(unauthenticatedActor, randomUUID(), false), unauthenticatedDenied);
    await assert.rejects(() => saveAdminVariant(unauthenticatedActor, { productId: randomUUID() }), unauthenticatedDenied);
    await assert.rejects(() => updateAdminInventory(unauthenticatedActor, { variantId: randomUUID(), onHand: 20 }), unauthenticatedDenied);
    await assert.rejects(() => saveAdminImage(unauthenticatedActor, { productId: randomUUID() }), unauthenticatedDenied);
    assert.throws(() => assertRole("CUSTOMER", "ADMIN"), customerDenied);
    await assert.rejects(() => saveAdminProduct(customerActor, validProduct), customerDenied);
    await assert.rejects(() => setAdminProductActive(customerActor, randomUUID(), false), customerDenied);
    await assert.rejects(() => saveAdminCategory(customerActor, { name: "No", slug: "no", description: "", active: true }), customerDenied);
    await assert.rejects(() => saveAdminSize(customerActor, { label: "No", sortOrder: 0, active: true }), customerDenied);
    await assert.rejects(() => saveAdminColor(customerActor, { name: "No", hex: "", active: true }), customerDenied);
    await assert.rejects(() => setAdminCategoryActive(customerActor, randomUUID(), false), customerDenied);
    await assert.rejects(() => saveAdminVariant(customerActor, { productId: randomUUID() }), customerDenied);
    await assert.rejects(() => updateAdminInventory(customerActor, { variantId: randomUUID(), onHand: 20 }), customerDenied);
    await assert.rejects(() => saveAdminImage(customerActor, { productId: randomUUID() }), customerDenied);
  });

  await t.test("admin can create, edit, deactivate, and reactivate categories", async () => {
    const categoryId = await saveAdminCategory(adminActor, {
      name: "Phase Five Wear", slug: `phase-five-${suffix}`, description: "Initial description", active: true,
    });
    categoryIds.push(categoryId);
    await assert.rejects(() => saveAdminCategory(adminActor, {
      name: " Phase   Five   Wear ", slug: `phase-five-other-${suffix}`, description: "", active: true,
    }), /category name is already in use/i);
    await assert.rejects(() => saveAdminCategory(adminActor, {
      name: "Duplicate Slug", slug: `phase-five-${suffix}`, description: "", active: true,
    }), /already in use/);
    await saveAdminCategory(adminActor, { id: categoryId, name: "Phase Five Clothing", slug: `phase-five-edited-${suffix}`, description: "Updated", active: true });
    await setAdminCategoryActive(adminActor, categoryId, false);
    assert.equal((await db.select().from(categories).where(eq(categories.id, categoryId)).then(([row]) => row.active)), false);
    await setAdminCategoryActive(adminActor, categoryId, true);
    assert.equal((await db.select().from(categories).where(eq(categories.id, categoryId)).then(([row]) => row.active)), true);
    await assert.rejects(() => setAdminCategoryActive(adminActor, "not-a-uuid", true), /Invalid category ID/);
  });

  await t.test("sizes and colors normalize names, reject case-insensitive duplicates, and remain database-driven", async () => {
    const sizeLabel = `P5 ${suffix.slice(0, 6)} 3XL`;
    const sizeId = await saveAdminSize(adminActor, { label: `  ${sizeLabel}   `, sortOrder: 8, active: true });
    sizeIds.push(sizeId);
    assert.equal((await db.select().from(sizes).where(eq(sizes.id, sizeId)).then(([row]) => row.label)), sizeLabel);
    await assert.rejects(() => saveAdminSize(adminActor, { label: sizeLabel.toLowerCase(), sortOrder: 9, active: true }), /size already exists/i);
    const numericSize = `42-${suffix.slice(0, 4)}`;
    await saveAdminSize(adminActor, { id: sizeId, label: numericSize, sortOrder: 9, active: true });
    assert.equal((await db.select().from(sizes).where(eq(sizes.id, sizeId)).then(([row]) => row.label)), numericSize);

    const colorName = `P5 Navy ${suffix.slice(0, 6)}`;
    const colorId = await saveAdminColor(adminActor, { name: `  ${colorName.replace(" ", "   ")} `, hex: "#1a2B3c", active: true });
    colorIds.push(colorId);
    const [savedColor] = await db.select().from(colors).where(eq(colors.id, colorId)).limit(1);
    assert.equal(savedColor.name, colorName);
    assert.equal(savedColor.hex, "#1A2B3C");
    await assert.rejects(() => saveAdminColor(adminActor, { name: colorName.toLowerCase(), hex: "", active: true }), /color already exists/i);
    const editedColor = `P5 White ${suffix.slice(0, 6)}`;
    await saveAdminColor(adminActor, { id: colorId, name: editedColor, hex: "", active: true });
    assert.equal((await db.select().from(colors).where(eq(colors.id, colorId)).then(([row]) => row.name)), editedColor);
  });

  await t.test("product pricing is paisa-safe and slug, SKU, and category are validated", async () => {
    const [category] = await db.select().from(categories).where(eq(categories.id, categoryIds[0])).limit(1);
    await assert.rejects(() => saveAdminProduct(adminActor, {
      name: "Premature Active Product", slug: `premature-active-${suffix}`, description: "", categoryId: "", sku: "",
      priceNpr: "10", compareAtPriceNpr: "", active: true,
    }), /add an active purchasable variant/i);
    const productId = await saveAdminProduct(adminActor, {
      name: "Phase Five Shirt", slug: `phase-five-shirt-${suffix}`, description: "A test garment", categoryId: category.id,
      sku: `P5-PRODUCT-${suffix.slice(0, 8)}`, priceNpr: "1200.50", compareAtPriceNpr: "1500.00", active: false,
    });
    productIds.push(productId);
    const [saved] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    assert.equal(saved.basePricePaisa, 120050n);
    assert.equal(saved.compareAtPricePaisa, 150000n);
    await saveAdminProduct(adminActor, {
      id: productId, name: "Phase Five Shirt Updated", slug: `phase-five-shirt-edited-${suffix}`, description: "Updated garment",
      categoryId: category.id, sku: saved.sku, priceNpr: "1199.99", compareAtPriceNpr: "1500", active: false,
    });
    await assert.rejects(() => saveAdminProduct(adminActor, {
      name: "Bad Price", slug: `bad-price-${suffix}`, description: "", categoryId: "", sku: "", priceNpr: "-1", compareAtPriceNpr: "", active: false,
    }), /valid NPR amount/);
    await assert.rejects(() => saveAdminProduct(adminActor, {
      name: "Bad Compare", slug: `bad-compare-${suffix}`, description: "", categoryId: "", sku: "", priceNpr: "100", compareAtPriceNpr: "100", active: false,
    }), /greater than/);
    await assert.rejects(() => saveAdminProduct(adminActor, {
      name: "Bad Category", slug: `bad-category-${suffix}`, description: "", categoryId: randomUUID(), sku: "", priceNpr: "10", compareAtPriceNpr: "", active: false,
    }), /active category/);
    await assert.rejects(() => saveAdminProduct(adminActor, {
      name: "Duplicate Slug Product", slug: `phase-five-shirt-edited-${suffix}`, description: "", categoryId: "", sku: "", priceNpr: "10", compareAtPriceNpr: "", active: false,
    }), /slug is already in use/);
    await assert.rejects(() => saveAdminProduct(adminActor, {
      name: "Duplicate SKU Product", slug: `duplicate-sku-${suffix}`, description: "", categoryId: "", sku: saved.sku,
      priceNpr: "10", compareAtPriceNpr: "", active: false,
    }), /SKU is already in use/);
    await assert.rejects(() => setAdminProductActive(adminActor, randomUUID(), true), /Product not found/);
  });

  await t.test("variants enforce valid options, unique combinations, discounts, and stock", async () => {
    const [size] = await db.insert(sizes).values({ label: `P5-${suffix.slice(0, 6)}`, sortOrder: 1 }).returning();
    sizeIds.push(size.id);
    const [black, blue] = await db.insert(colors).values([
      { name: `P5 Black ${suffix}`, hex: "#000000" }, { name: `P5 Blue ${suffix}`, hex: "#0000ff" },
    ]).returning();
    colorIds.push(black.id, blue.id);
    const productId = productIds[0];
    const sku = `P5-VAR-${suffix.slice(0, 8)}`;
    const variantInput = { productId, sizeId: size.id, colorId: black.id, sku, priceNpr: "1200", salePriceNpr: "999.90", active: true, initialStock: 8 };
    await saveAdminVariant(adminActor, variantInput);
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.sku, sku)).limit(1);
    assert.ok(variant);
    await saveAdminVariant(adminActor, { ...variantInput, colorId: blue.id, sku: `${sku}-BLUE`, initialStock: 3 });
    const [secondSize] = await db.insert(sizes).values({ label: `P5-2-${suffix.slice(0, 5)}`, sortOrder: 2 }).returning();
    sizeIds.push(secondSize.id);
    await saveAdminVariant(adminActor, { ...variantInput, sizeId: secondSize.id, sku: `${sku}-SECOND-SIZE`, initialStock: 4 });
    const productVariantsSaved = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
    assert.equal(productVariantsSaved.length, 3);
    const independentStock = await db.select({ variantId: inventory.variantId, onHand: inventory.onHand }).from(inventory)
      .where(inArray(inventory.variantId, productVariantsSaved.map((row) => row.id)));
    assert.deepEqual(independentStock.map((row) => row.onHand).sort((a, b) => a - b), [3, 4, 8]);
    await assert.rejects(() => saveAdminVariant(adminActor, { ...variantInput, sku: `${sku}-DUP` }), /combination already exists/);
    await assert.rejects(() => saveAdminVariant(adminActor, { ...variantInput, colorId: blue.id, priceNpr: "100", salePriceNpr: "100" }), /lower than/);
    await assert.rejects(() => saveAdminVariant(adminActor, { ...variantInput, sizeId: randomUUID(), sku: `${sku}-BAD-SIZE` }), /active size/);
    await assert.rejects(() => saveAdminVariant(adminActor, { ...variantInput, productId: randomUUID(), sku: `${sku}-BAD-PRODUCT` }), /Product not found/);
    await assert.rejects(() => saveAdminVariant(adminActor, { ...variantInput, colorId: blue.id, sku, priceNpr: "1200", salePriceNpr: "" }), /SKU is already in use/);
    await assert.rejects(() => updateAdminInventory(adminActor, { variantId: variant.id, onHand: -1 }), /nonnegative whole number/);
    await updateAdminInventory(adminActor, { variantId: variant.id, onHand: 11 });
    assert.equal((await db.select().from(inventory).where(eq(inventory.variantId, variant.id)).then(([row]) => row.onHand)), 11);
    await assert.rejects(() => updateAdminInventory(adminActor, { variantId: randomUUID(), onHand: 3 }), /Variant not found/);
    await saveAdminProduct(adminActor, {
      id: productId, name: "Phase Five Shirt Updated", slug: `phase-five-shirt-edited-${suffix}`, description: "Updated garment",
      categoryId: categoryIds[0], sku: `P5-PRODUCT-${suffix.slice(0, 8)}`, priceNpr: "1199.99", compareAtPriceNpr: "1500", active: false,
    });
    const paisaToNpr = (paisa: bigint) => `${paisa / 100n}.${(paisa % 100n).toString().padStart(2, "0")}`;
    for (const savedVariant of productVariantsSaved) {
      await saveAdminVariant(adminActor, {
        id: savedVariant.id,
        productId,
        sizeId: savedVariant.sizeId ?? "",
        colorId: savedVariant.colorId ?? "",
        sku: savedVariant.sku,
        priceNpr: paisaToNpr(savedVariant.pricePaisa),
        salePriceNpr: savedVariant.salePricePaisa === null ? "" : paisaToNpr(savedVariant.salePricePaisa),
        active: false,
        initialStock: undefined,
      });
    }
    await assert.rejects(() => saveAdminProduct(adminActor, {
      id: productId, name: "Phase Five Shirt Updated", slug: `phase-five-shirt-edited-${suffix}`, description: "Updated garment",
      categoryId: categoryIds[0], sku: `P5-PRODUCT-${suffix.slice(0, 8)}`, priceNpr: "1199.99", compareAtPriceNpr: "1500", active: true,
    }), /active purchasable variant/);
    await saveAdminVariant(adminActor, { ...variantInput, id: variant.id, active: true, initialStock: undefined });
    await saveAdminProduct(adminActor, {
      id: productId, name: "Phase Five Shirt Updated", slug: `phase-five-shirt-edited-${suffix}`, description: "Updated garment",
      categoryId: categoryIds[0], sku: `P5-PRODUCT-${suffix.slice(0, 8)}`, priceNpr: "1199.99", compareAtPriceNpr: "1500", active: true,
    });
    await assert.rejects(() => saveAdminVariant(adminActor, { ...variantInput, id: variant.id, active: false, initialStock: undefined }), /last active variant/);
  });

  await t.test("image metadata, stock attribution, archive, and historical order integrity", async () => {
    const productId = productIds[0];
    const firstImageInput = { productId, url: "https://images.unsplash.com/photo-1", altText: "Front view", sortOrder: 0, isPrimary: true };
    await saveAdminImage(adminActor, firstImageInput);
    const [firstImage] = await db.select().from(productImages).where(eq(productImages.productId, productId)).limit(1);
    assert.ok(firstImage?.isPrimary);
    const secondImageInput = { productId, url: "https://images.unsplash.com/photo-2", altText: "Back view", sortOrder: 1, isPrimary: true };
    await saveAdminImage(adminActor, secondImageInput);
    const images = await db.select().from(productImages).where(eq(productImages.productId, productId));
    assert.equal(images.filter((image) => image.isPrimary).length, 1);
    assert.equal(images.find((image) => image.id === firstImage.id)?.isPrimary, false);
    await assert.rejects(() => saveAdminImage(adminActor, { ...firstImageInput, url: "http://insecure.example/image.jpg" }), /HTTPS/);
    await removeAdminImage(adminActor, firstImage.id);
    await assert.rejects(() => removeAdminImage(adminActor, "not-an-id"), /Invalid image ID/);

    const [variant] = await db.select().from(productVariants).where(and(
      eq(productVariants.productId, productId),
      eq(productVariants.sku, `P5-VAR-${suffix.slice(0, 8)}`),
    )).limit(1);
    assert.ok(variant);
    const [beforeUpdate] = await db.select().from(inventory).where(eq(inventory.variantId, variant.id)).limit(1);
    assert.equal(beforeUpdate.onHand, 11);
    await db.update(inventory).set({ reserved: 2 }).where(eq(inventory.variantId, variant.id));
    await assert.rejects(() => updateAdminInventory(adminActor, { variantId: variant.id, onHand: 1 }), /reserved quantity/);
    await updateAdminInventory(adminActor, { variantId: variant.id, onHand: 9 });
    const [attributed] = await db.select().from(inventory).where(eq(inventory.variantId, variant.id)).limit(1);
    assert.equal(attributed.updatedBy, adminId);
    assert.equal(attributed.onHand, 9);

    const [order] = await db.insert(orders).values({
      orderNumber: `P5-${suffix.slice(0, 20)}`, userId: null, customerName: "Order Snapshot", customerPhone: "+9779812345678",
      paymentMethod: "COD", subtotalPaisa: 120000n, shippingPaisa: 0n, totalPaisa: 120000n,
      shippingRuleName: "Test fixture", shippingAddressSnapshot: { fullName: "Order Snapshot" },
    }).returning();
    orderIds.push(order.id);
    const [item] = await db.insert(orderItems).values({
      orderId: order.id, productId, variantId: variant.id, productName: "Historical Shirt", sku: variant.sku,
      variantLabel: "Size / color", unitPricePaisa: 120000n, quantity: 1, lineTotalPaisa: 120000n,
    }).returning();
    orderItemIds.push(item.id);
    await setAdminProductActive(adminActor, productId, false);
    assert.equal((await db.select().from(orderItems).where(eq(orderItems.id, item.id)).then(([row]) => row.productName)), "Historical Shirt");
    await setAdminProductActive(adminActor, productId, true);
    assert.equal((await db.select().from(orders).where(eq(orders.id, order.id)).then(([row]) => row.id)), order.id);
  });
});
