import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDatabase } from "@/db";
import { categories } from "@/db/schema";
import { ProductArchiveForm } from "@/components/admin/admin-forms";
import { getAdminProducts } from "@/lib/admin/catalog-service";
import { formatPaisa } from "@/lib/commerce/money";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string }> }) {
  const params = await searchParams;
  const [rows, categoryRows] = await Promise.all([
    getAdminProducts({ query: params.q, categoryId: params.category, active: params.status, sort: params.sort }),
    getDatabase().select().from(categories).orderBy(asc(categories.name)),
  ]);
  return <div className="admin-content">
    <div className="admin-page-heading"><div><p className="eyebrow">CATALOG</p><h1>Products</h1><p className="admin-muted">Search and manage products, prices, variants, and images.</p></div><Link className="button button-dark" href="/admin/products/new">Add product</Link></div>
    <form method="get" className="admin-filter-bar">
      <label>Search<input name="q" defaultValue={params.q} placeholder="Name or SKU" maxLength={100} /></label>
      <label>Category<select name="category" defaultValue={params.category ?? ""}><option value="">All categories</option>{categoryRows.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={params.status ?? "all"}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <label>Sort<select name="sort" defaultValue={params.sort ?? "updated"}><option value="updated">Recently updated</option><option value="name">Name</option><option value="price">Price: low to high</option></select></label>
      <button className="button button-outline">Apply filters</button>
    </form>
    <section className="admin-panel">
      <div className="admin-section-heading"><h2>{rows.length} {rows.length === 1 ? "product" : "products"}</h2></div>
      {rows.length === 0 ? <div className="admin-empty"><h3>No matching products</h3><p>Change the filters or add a product to the catalog.</p><Link href="/admin/products/new" className="button button-dark">Add product</Link></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {rows.map(({ product, categoryName }) => <tr key={product.id}><td><Link href={`/admin/products/${product.id}`}>{product.name}</Link><small>{product.sku ?? "No product SKU"} · {product.slug}</small></td><td>{categoryName ?? "Uncategorized"}</td><td>{formatPaisa(product.basePricePaisa)}{product.compareAtPricePaisa ? <small>Was {formatPaisa(product.compareAtPricePaisa)}</small> : null}</td><td><span className={product.active ? "admin-status is-active" : "admin-status"}>{product.active ? "Active" : "Inactive"}</span></td><td>{new Intl.DateTimeFormat("en-NP", { dateStyle: "medium" }).format(product.updatedAt)}</td><td><div className="admin-row-actions"><Link className="text-link" href={`/admin/products/${product.id}/edit`}>Edit</Link><ProductArchiveForm id={product.id} active={product.active} /></div></td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}
