import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { categories, inventory, products, productVariants, user } from "@/db/schema";
import { formatPaisa } from "@/lib/commerce/money";

export default async function AdminDashboardPage() {
  const db = getDatabase();
  const [
    [totalProducts], [activeProducts], [inactiveProducts], [categoryTotal], [lowStock], [customerTotal], recentProducts,
  ] = await Promise.all([
    db.select({ value: count() }).from(products),
    db.select({ value: count() }).from(products).where(eq(products.active, true)),
    db.select({ value: count() }).from(products).where(eq(products.active, false)),
    db.select({ value: count() }).from(categories),
    db.select({ value: count() }).from(inventory)
      .innerJoin(productVariants, eq(inventory.variantId, productVariants.id))
      .where(sql`${productVariants.active} = true and ${inventory.onHand} - ${inventory.reserved} <= ${inventory.lowStockThreshold}`),
    db.select({ value: count() }).from(user).where(sql`${user.role} = 'CUSTOMER' and ${user.deletedAt} is null`),
    db.select({ product: products, categoryName: categories.name }).from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id)).orderBy(desc(products.createdAt)).limit(8),
  ]);
  const stats = [
    { label: "Total products", value: totalProducts.value },
    { label: "Active products", value: activeProducts.value },
    { label: "Inactive products", value: inactiveProducts.value },
    { label: "Categories", value: categoryTotal.value },
    { label: "Low-stock variants", value: lowStock.value },
    { label: "Customers", value: customerTotal.value },
  ];

  return <div className="admin-content">
    <div className="admin-page-heading"><div><p className="eyebrow">STORE OPERATIONS</p><h1>Dashboard</h1><p className="admin-muted">A live overview of your catalog and stock.</p></div><Link className="button button-dark" href="/admin/products/new">Add product</Link></div>
    <section className="admin-stat-grid" aria-label="Store statistics">
      {stats.map((stat) => <article key={stat.label} className="admin-stat-card"><span>{stat.label}</span><strong>{stat.value.toLocaleString("en-NP")}</strong></article>)}
    </section>
    <section className="admin-panel">
      <div className="admin-section-heading"><div><h2>Recent products</h2><p className="admin-muted">Newest catalog records from PostgreSQL.</p></div><Link className="text-link" href="/admin/products">Manage products</Link></div>
      {recentProducts.length === 0 ? <div className="admin-empty"><h3>No products yet</h3><p>Add the first catalog item to get started.</p><Link className="button button-dark" href="/admin/products/new">Create product</Link></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>
        {recentProducts.map(({ product, categoryName }) => <tr key={product.id}><td><Link href={`/admin/products/${product.id}`}>{product.name}</Link><small>{product.sku ?? "No product SKU"}</small></td><td>{categoryName ?? "Uncategorized"}</td><td>{formatPaisa(product.basePricePaisa)}</td><td><span className={product.active ? "admin-status is-active" : "admin-status"}>{product.active ? "Active" : "Inactive"}</span></td><td>{new Intl.DateTimeFormat("en-NP", { dateStyle: "medium" }).format(product.updatedAt)}</td><td><Link href={`/admin/products/${product.id}/edit`} className="text-link">Edit</Link></td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}
