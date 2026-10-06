import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPaisa } from "@/lib/commerce/money";
import { getAdminCustomerDetails } from "@/lib/admin/customer-service";
import { AdminCustomerDeactivateButton } from "@/components/admin/customer-deactivate-button";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminCustomerDetails(id);
  if (!result) notFound();
  const { customer, orders } = result;

  return <div className="admin-content">
    <p className="eyebrow">STORE OPERATIONS</p>
    <Link className="text-link" href="/admin/customers">← Customers</Link>
    <div className="admin-page-heading"><div><h1>{customer.name}</h1><p className="admin-muted">Customer account and order history</p></div></div>
    <section className="admin-panel">
      <h2>Account</h2>
      <div className="admin-detail-grid">
        <div><span>Name</span><strong>{customer.name}</strong></div>
        <div><span>Email</span><strong>{customer.email}</strong></div>
        <div><span>Phone</span><strong>{customer.phone ?? "Not provided"}</strong></div>
        <div><span>Status</span><strong>{customer.deletedAt ? "Anonymized" : "Active"}</strong></div>
        <div><span>Created</span><strong>{new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(customer.createdAt)}</strong></div>
      </div>
      {customer.deletedAt && <p className="admin-muted">This account was anonymized. Historical orders remain available with their order snapshots.</p>}
      {!customer.deletedAt && <div className="mt-6 border-t border-ink/15 pt-5"><h3 className="font-medium">Deactivate customer account</h3><p className="admin-muted">Login access and saved personal details will be removed. Historical orders, items, payment records, and status history are preserved; order delivery details are anonymized.</p><AdminCustomerDeactivateButton customerId={customer.id} /></div>}
    </section>
    <section className="admin-panel">
      <div className="admin-section-heading"><h2>Orders · {orders.length}</h2></div>
      {orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th><th /></tr></thead><tbody>
        {orders.map((order) => <tr key={order.id}>
          <td><strong>{order.orderNumber}</strong></td>
          <td>{order.status}</td>
          <td>{order.paymentMethod} · {order.paymentStatus}</td>
          <td>{formatPaisa(order.totalPaisa)}</td>
          <td>{new Intl.DateTimeFormat("en-NP", { dateStyle: "medium" }).format(order.placedAt)}</td>
          <td><Link className="text-link" href={`/admin/orders/${order.id}`}>View order</Link></td>
        </tr>)}
      </tbody></table></div> : <div className="admin-empty"><p>This customer has no orders.</p></div>}
    </section>
  </div>;
}
