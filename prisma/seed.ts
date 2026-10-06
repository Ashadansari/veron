import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { sampleProducts } from "../src/lib/catalog/sample-data";
import { getDevelopmentSeedAdmin } from "./seed-admin";

if (process.env.NODE_ENV === "production") {
  throw new Error("The development seed is disabled in production.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to seed PostgreSQL.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function seed() {
  const admin = await getDevelopmentSeedAdmin(prisma, process.env.SEED_ADMIN_EMAIL || "dev-admin@najfancystore.test");

  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, storeName: "Naj Fancy Store", currency: "NPR", locale: "ne-NP", timeZone: "Asia/Kathmandu" },
  });

  const categoryByName = new Map<string, string>();
  const categoryNames = [...new Set(sampleProducts.map((product) => product.category))];
  for (const name of categoryNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name, active: true },
      create: { name, slug, active: true },
    });
    categoryByName.set(name, category.id);
  }

  for (const product of sampleProducts) {
    const categoryId = categoryByName.get(product.category);
    if (!categoryId) throw new Error(`Missing category for ${product.slug}.`);
    const variantsByPrice = [...product.variants].sort((left, right) => BigInt(left.pricePaisa) < BigInt(right.pricePaisa) ? -1 : 1);
    const baseVariant = variantsByPrice[0];
    const dbProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        categoryId,
        name: product.name,
        description: product.description,
        sku: `PRODUCT-${product.id.toUpperCase()}`,
        basePricePaisa: BigInt(baseVariant.pricePaisa),
        compareAtPricePaisa: baseVariant.originalPricePaisa ? BigInt(baseVariant.originalPricePaisa) : null,
        active: true,
      },
      create: {
        categoryId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        sku: `PRODUCT-${product.id.toUpperCase()}`,
        basePricePaisa: BigInt(baseVariant.pricePaisa),
        compareAtPricePaisa: baseVariant.originalPricePaisa ? BigInt(baseVariant.originalPricePaisa) : null,
        active: true,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: dbProduct.id } });
    await prisma.productImage.createMany({
      data: product.images.map((image, index) => ({
        productId: dbProduct.id,
        url: image.src,
        altText: image.alt,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    });

    for (const [index, variant] of product.variants.entries()) {
      const size = await prisma.size.upsert({
        where: { label: variant.size },
        update: { sortOrder: index, active: true },
        create: { label: variant.size, sortOrder: index, active: true },
      });
      const color = await prisma.color.upsert({
        where: { name: variant.color },
        update: { active: true },
        create: { name: variant.color, active: true },
      });
      const sku = variant.sku ?? variant.id.toUpperCase();
      const dbVariant = await prisma.productVariant.upsert({
        where: { sku },
        update: {
          productId: dbProduct.id,
          sizeId: size.id,
          colorId: color.id,
          pricePaisa: BigInt(variant.originalPricePaisa ?? variant.pricePaisa),
          salePricePaisa: variant.originalPricePaisa ? BigInt(variant.pricePaisa) : null,
          active: true,
        },
        create: {
          productId: dbProduct.id,
          sizeId: size.id,
          colorId: color.id,
          sku,
          pricePaisa: BigInt(variant.originalPricePaisa ?? variant.pricePaisa),
          salePricePaisa: variant.originalPricePaisa ? BigInt(variant.pricePaisa) : null,
          active: true,
        },
      });
      await prisma.inventory.upsert({
        where: { variantId: dbVariant.id },
        update: { onHand: variant.stock, reserved: 0, lowStockThreshold: 5, updatedBy: admin.id },
        create: { variantId: dbVariant.id, onHand: variant.stock, reserved: 0, lowStockThreshold: 5, updatedBy: admin.id },
      });
    }
  }
}

seed()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    console.error("Development seed failed.", error);
    process.exitCode = 1;
  });
