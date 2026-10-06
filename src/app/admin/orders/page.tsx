import Link from "next/link";
import { formatPaisa } from "@/lib/commerce/money";
import { getAdminOrders } from "@/lib/commerce/order-management";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; payment?: string }> }) {
  const params = await searchParams;
  const rows = await getAdminOrders({ query: params.q, status: params.status, paymentStatus: params.payment });
  const statuses = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
  const payments = ["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"];
  return <div className="admin-content">
    <div className="admin-page-heading"><div><p className="eyebrow">FULFILLMENT</p><h1>Orders</h1><p className="admin-muted">Review customer orders and update fulfillment status.</p></div></div>
    <form method="get" className="admin-filter-bar">
      <label>Search<input name="q" defaultValue={params.q} placeholder="Order, customer, phone" maxLength={80} /></label>
      <label>Order status<select name="status" defaultValue={params.status ?? "all"}><option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Payment status<select name="payment" defaultValue={params.payment ?? "all"}><option value="all">All payment states</option>{payments.map((value) => <option key={value}>{value}</option>)}</select></label>
      <button className="button button-outline">Apply filters</button>
    </form>
    <section className="admin-panel"><div className="admin-section-heading"><h2>{rows.length} recent {rows.length === 1 ? "order" : "orders"}</h2></div>
      {rows.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th><th /></tr></thead><tbody>
        {rows.map(({ order, itemCount }) => <tr key={order.id}><td><strong>{order.orderNumber}</strong></td><td>{order.customerName || "Deleted customer"}<small>{order.customerPhone}</small></td><td>{itemCount}</td><td>{order.status}</td><td>{order.paymentMethod} · {order.paymentStatus}</td><td>{formatPaisa(order.totalPaisa)}</td><td>{new Intl.DateTimeFormat("en-NP", { dateStyle: "medium" }).format(order.placedAt)}</td><td><Link className="text-link" href={`/admin/orders/${order.id}`}>View</Link></td></tr>)}
      </tbody></table></div> : <div className="admin-empty"><h3>No orders found</h3><p>Orders placed by customers will appear here.</p></div>}
    </section>
  </div>;
}
