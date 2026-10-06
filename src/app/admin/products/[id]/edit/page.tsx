import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageForm, ProductForm, ProductImageUploadForm, RemoveImageForm, VariantForm } from "@/components/admin/admin-forms";
import { getDatabase } from "@/db";
import { categories } from "@/db/schema";
import { getAdminProduct } from "@/lib/admin/catalog-service";

export const dynamic = "force-dynamic";

export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [productData, categoryRows] = await Promise.all([
    getAdminProduct(id),
    getDatabase().select().from(categories).orderBy(categories.name),
  ]);
  if (!productData) notFound();
  const { product, images, variants, sizes, colors } = productData;
  return <div className="admin-content">
    <p className="eyebrow">CATALOG</p><Link className="text-link" href={`/admin/products/${id}`}>← Product details</Link><h1>Edit {product.name}</h1>
    <section className="admin-panel"><h2>Product information</h2><ProductForm product={product} categories={categoryRows} /></section>
    <section className="admin-panel"><div className="admin-section-heading"><div><h2>Product images</h2><p className="admin-muted">Add HTTPS image URLs or upload an image from this device. Device uploads are for local and staging use.</p></div></div>
      {images.length > 0 && <div className="admin-record-grid">{images.map((image) => <article className="admin-record-card" key={image.id}><div className="admin-record-meta"><a href={image.url} target="_blank" rel="noreferrer">{image.isPrimary ? "Primary image" : "Image record"} ↗</a><RemoveImageForm id={image.id} /></div><ImageForm productId={id} image={{ id: image.id, url: image.url, altText: image.altText, sortOrder: image.sortOrder, isPrimary: image.isPrimary }} /></article>)}</div>}
      <ImageForm productId={id} />
      <ProductImageUploadForm productId={id} />
    </section>
    <section className="admin-panel"><div className="admin-section-heading"><div><h2>Variants</h2><p className="admin-muted">A variant is one purchasable size/color combination with its own SKU, price, and stock.</p></div></div>
      {variants.length > 0 && <div className="admin-record-grid">{variants.map(({ variant, stock, sizeLabel, colorName }) => <article className="admin-record-card" key={variant.id}><p className="admin-muted">{sizeLabel ?? "One size"} · {colorName ?? "Default color"} · {stock} on hand</p><VariantForm productId={id} sizes={sizes} colors={colors} variant={{ id: variant.id, sizeId: variant.sizeId, colorId: variant.colorId, sku: variant.sku, pricePaisa: variant.pricePaisa, salePricePaisa: variant.salePricePaisa, active: variant.active, stock }} /></article>)}</div>}
      <VariantForm productId={id} sizes={sizes} colors={colors} />
    </section>
  </div>;
}
