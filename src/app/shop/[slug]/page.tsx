import Image from "next/image";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductPurchase } from "@/components/product-purchase";
import { getDatabase } from "@/db";
import { categories, colors, inventory, productImages, productVariants, products, sizes } from "@/db/schema";
import { formatPaisa } from "@/lib/commerce/money";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDatabase();
  const [product] = await db.select({ id: products.id, name: products.name, description: products.description, category: categories.name }).from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId)).where(and(eq(products.slug, slug), eq(products.active, true))).limit(1);
  if (!product) notFound();
  const [images, variants] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.sortOrder)),
    db.select({ id: productVariants.id, sku: productVariants.sku, price: productVariants.pricePaisa, sale: productVariants.salePricePaisa, size: sizes.label, color: colors.name, onHand: inventory.onHand, reserved: inventory.reserved })
      .from(productVariants).innerJoin(inventory, eq(inventory.variantId, productVariants.id)).leftJoin(sizes, eq(sizes.id, productVariants.sizeId)).leftJoin(colors, eq(colors.id, productVariants.colorId))
      .where(and(eq(productVariants.productId, product.id), eq(productVariants.active, true))).orderBy(asc(productVariants.pricePaisa)),
  ]);
  return <main className="account-shell"><p className="eyebrow"><Link href="/shop">Shop</Link> / {product.category ?? "Collection"}</p><div className="product-detail">
    <div className="product-detail-images">{images.map((image) => <div className="detail-image" key={image.id}><Image src={image.url} alt={image.altText} fill unoptimized sizes="(max-width: 800px) 100vw, 55vw" className="object-cover" /></div>)}</div>
    <section><h1>{product.name}</h1><p className="product-detail-copy">{product.description}</p>
      <ProductPurchase options={variants.map((variant) => ({ id: variant.id, label: [variant.size, variant.color, variant.sku].filter(Boolean).join(" · "), size: variant.size ?? "One size", color: variant.color ?? "Default", stock: Math.max(0, variant.onHand - variant.reserved), price: formatPaisa(variant.sale ?? variant.price) }))} />
      <p>Prices and stock are confirmed by the store server when an item is added to your cart and again at checkout.</p>
    </section>
  </div></main>;
}
