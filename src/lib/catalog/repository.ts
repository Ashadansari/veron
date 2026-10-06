import "server-only";

import { sampleCategories, sampleProducts } from "@/lib/catalog/sample-data";
import type { CatalogProduct, ProductVariant } from "@/lib/catalog/types";
import { getPrismaClient } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const productInclude = {
  category: true,
  images: { orderBy: { sortOrder: "asc" as const } },
  variants: {
    where: { active: true },
    include: { size: true, color: true, inventory: true },
    orderBy: { createdAt: "asc" as const },
  },
};

type PrismaCatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toCatalogProduct(row: PrismaCatalogProduct): CatalogProduct {
  const variants: ProductVariant[] = row.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    size: variant.size?.label ?? "One size",
    color: variant.color?.name ?? "Default",
    pricePaisa: (variant.salePricePaisa ?? variant.pricePaisa).toString(),
    ...(variant.salePricePaisa !== null ? { originalPricePaisa: variant.pricePaisa.toString() } : {}),
    stock: Math.max(0, (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0)),
  }));
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category?.name ?? "Collection",
    description: row.description,
    images: row.images.map((image) => ({ src: image.url, alt: image.altText })),
    variants,
    createdAt: row.createdAt.getTime(),
    imageTone: "#e8e0d4",
  };
}

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  if (!process.env.DATABASE_URL) return sampleProducts;
  const rows = await getPrismaClient().product.findMany({
    where: { active: true, category: { is: { active: true } } },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toCatalogProduct);
}

export async function getCatalogProductBySlug(slug: string): Promise<CatalogProduct | undefined> {
  if (!process.env.DATABASE_URL) return sampleProducts.find((product) => product.slug === slug);
  const row = await getPrismaClient().product.findFirst({
    where: { slug, active: true, category: { is: { active: true } } },
    include: productInclude,
  });
  return row ? toCatalogProduct(row) : undefined;
}

export async function getCatalogCategories() {
  if (!process.env.DATABASE_URL) return sampleCategories;
  const rows = await getPrismaClient().category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { name: true, description: true },
  });
  return rows.map((row) => ({ name: row.name, description: row.description ?? "" }));
}

export async function getCatalogProductsBySlugs(slugs: string[]): Promise<CatalogProduct[]> {
  if (!slugs.length) return [];
  if (!process.env.DATABASE_URL) return sampleProducts.filter((product) => slugs.includes(product.slug));
  const rows = await getPrismaClient().product.findMany({
    where: { slug: { in: slugs }, active: true, category: { is: { active: true } } },
    include: productInclude,
  });
  return rows.map(toCatalogProduct);
}

export async function getRelatedCatalogProducts(category: string, excludeId: string, take = 3): Promise<CatalogProduct[]> {
  if (!process.env.DATABASE_URL) {
    return sampleProducts.filter((product) => product.id !== excludeId && product.category === category).slice(0, take);
  }
  const rows = await getPrismaClient().product.findMany({
    where: { id: { not: excludeId }, active: true, category: { is: { active: true, name: category } } },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toCatalogProduct);
}

export type CartLookup = { productSlug: string; variantSku: string; quantity: number };

export async function resolveCartLookupEntries(entries: CartLookup[]) {
  if (!entries.length) return [];
  const requestedSlugs = [...new Set(entries.map((entry) => entry.productSlug))];
  let products: CatalogProduct[];
  if (!process.env.DATABASE_URL) {
    products = sampleProducts.filter((product) => requestedSlugs.includes(product.slug));
  } else {
    const rows = await getPrismaClient().product.findMany({
      where: { slug: { in: requestedSlugs }, active: true, category: { is: { active: true } } },
      include: productInclude,
    });
    products = rows.map(toCatalogProduct);
  }
  return entries.flatMap((entry) => {
    const product = products.find((candidate) => candidate.slug === entry.productSlug);
    const variant = product?.variants.find((candidate) => (candidate.sku ?? candidate.id) === entry.variantSku);
    if (!product || !variant || variant.stock < 1) return [];
    return [{ productId: product.id, variantId: variant.id, quantity: Math.min(entry.quantity, variant.stock), product, variant }];
  });
}
