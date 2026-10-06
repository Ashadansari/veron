import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminProduct } from "@/lib/admin/catalog-service";
import { formatPaisa } from "@/lib/commerce/money";

export const dynamic = "force-dynamic";

export default async function AdminProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminProduct(id);
  if (!data) notFound();
  const { product, categoryName, images, variants } = data;
  return <div className="admin-content">
    <p className="eyebrow">PRODUCT DETAILS</p><Link className="text-link" href="/admin/products">← Products</Link>
    <div className="admin-page-heading"><div><h1>{product.name}</h1><p className="admin-muted">{product.slug} · {categoryName ?? "Uncategorized"}</p></div><Link className="button button-dark" href={`/admin/products/${id}/edit`}>Edit product</Link></div>
    <section className="admin-panel"><div className="admin-detail-grid"><div><span>Status</span><strong>{product.active ? "Active" : "Inactive"}</strong></div><div><span>Product SKU</span><strong>{product.sku ?? "—"}</strong></div><div><span>Price</span><strong>{formatPaisa(product.basePricePaisa)}</strong></div><div><span>Original price</span><strong>{product.compareAtPricePaisa ? formatPaisa(product.compareAtPricePaisa) : "—"}</strong></div></div><h2>Description</h2><p className="admin-description">{product.description || "No description added."}</p></section>
    <section className="admin-panel"><h2>Images</h2>{images.length ? <ul className="admin-record-list">{images.map((image) => <li key={image.id}><span>{image.altText}{image.isPrimary ? " · Primary" : ""}</span><span>Order {image.sortOrder}</span><a href={image.url} target="_blank" rel="noreferrer">Open image</a></li>)}</ul> : <p className="admin-muted">No image metadata has been added.</p>}</section>
    <section className="admin-panel"><h2>Variants</h2>{variants.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Variant</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead><tbody>{variants.map(({ variant, sizeLabel, colorName, stock, reserved }) => <tr key={variant.id}><td>{[sizeLabel ?? "One size", colorName ?? "Default color"].join(" · ")}</td><td>{variant.sku}</td><td>{formatPaisa(variant.salePricePaisa ?? variant.pricePaisa)}</td><td>{stock - reserved} available <small>({stock} on hand, {reserved} reserved)</small></td><td>{variant.active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div> : <div className="admin-empty"><p>No purchasable variants yet.</p><Link className="text-link" href={`/admin/products/${id}/edit`}>Add a variant</Link></div>}</section>
  </div>;
}
