import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import ProductDetail from "@/components/storefront/product-detail";
import { getCatalogProductBySlug, getRelatedCatalogProducts } from "@/lib/catalog/repository";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProductBySlug(slug);
  return product ? { title: `${product.name} | NajFancyStore`, description: product.description, openGraph: { title: product.name, description: product.description, images: [product.images[0]?.src] } } : { title: "Product not found | NajFancyStore" };
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getCatalogProductBySlug(slug);
  if (!product) notFound();
  const related = await getRelatedCatalogProducts(product.category, product.id);
  return <StorefrontFrame><ProductDetail product={product} related={related} /></StorefrontFrame>;
}
