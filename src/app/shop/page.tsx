import type { Metadata } from "next";
import ShopCatalog from "@/components/storefront/shop-catalog";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import { getCatalogCategories, getCatalogProducts } from "@/lib/catalog/repository";

export const metadata: Metadata = { title: "Shop", description: "Browse clothing from the VÉRON edit." };
export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const [products, categories] = await Promise.all([getCatalogProducts(), getCatalogCategories()]);
  return <StorefrontFrame><ShopCatalog products={products} categories={categories} initialQuery={params.q ?? ""} initialCategory={params.category ?? ""} /></StorefrontFrame>;
}
