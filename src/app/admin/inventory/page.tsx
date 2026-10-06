import Link from "next/link";
import { InventoryForm } from "@/components/admin/admin-forms";
import { getAdminInventory } from "@/lib/admin/catalog-service";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const items = await getAdminInventory();
  return <div className="admin-content">
    <div className="admin-page-heading"><div><p className="eyebrow">CATALOG OPERATIONS</p><h1>Inventory</h1><p className="admin-muted">Available stock subtracts reserved units from the on-hand count.</p></div></div>
    <section className="admin-panel">
      {items.length === 0 ? <div className="admin-empty"><h2>No variants to stock</h2><p>Create a product variant first; it will appear here for inventory control.</p><Link className="button button-dark" href="/admin/products">Open products</Link></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product / variant</th><th>SKU</th><th>On hand</th><th>Available</th><th>Low stock</th><th>Status</th><th>Adjust stock</th></tr></thead><tbody>{items.map((item) => {
        const available = item.onHand - item.reserved;
        const low = available <= item.threshold;
        return <tr key={item.variantId}><td><Link href={`/admin/products/${item.productId}/edit`}>{item.productName}</Link><small>{item.sizeLabel ?? "One size"} · {item.colorName ?? "Default color"}</small></td><td>{item.sku}</td><td>{item.onHand}</td><td>{available}</td><td><span className={low ? "admin-status is-low" : "admin-status is-active"}>{low ? `Low (≤ ${item.threshold})` : "In stock"}</span></td><td>{item.productActive && item.variantActive ? "Active" : "Inactive"}</td><td><InventoryForm variantId={item.variantId} onHand={item.onHand} /></td></tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}
