import Link from "next/link";
import { getAdminCustomers } from "@/lib/admin/customer-service";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const customers = await getAdminCustomers(params.q);
  return <div className="admin-content">
    <div className="admin-page-heading"><div><p className="eyebrow">STORE OPERATIONS</p><h1>Customers</h1><p className="admin-muted">Find customer accounts and review their order history.</p></div></div>
    <form method="get" className="admin-filter-bar">
      <label>Search customers<input name="q" defaultValue={params.q} placeholder="Name, email, or phone" maxLength={120} /></label>
      <button className="button button-outline">Search</button>
    </form>
    <section className="admin-panel">
      <div className="admin-section-heading"><h2>{customers.length} {customers.length === 1 ? "customer" : "customers"}{customers.length === 100 ? " · first 100" : ""}</h2></div>
      {customers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Account status</th><th>Orders</th><th>Latest order</th><th>Joined</th><th /></tr></thead><tbody>
        {customers.map((customer) => <tr key={customer.id}>
          <td><Link href={`/admin/customers/${encodeURIComponent(customer.id)}`}>{customer.name}</Link></td>
          <td>{customer.email}</td>
          <td>{customer.phone ?? "—"}</td>
          <td><span className={customer.deletedAt ? "admin-status" : "admin-status is-active"}>{customer.deletedAt ? "Anonymized" : "Active"}</span></td>
          <td>{customer.orderCount}</td>
          <td>{customer.latestOrder ? <><span>{customer.latestOrder.orderNumber}</span><small>{customer.latestOrder.status}</small></> : "—"}</td>
          <td>{new Intl.DateTimeFormat("en-NP", { dateStyle: "medium" }).format(customer.createdAt)}</td>
          <td><Link className="text-link" href={`/admin/customers/${encodeURIComponent(customer.id)}`}>View</Link></td>
        </tr>)}
      </tbody></table></div> : <div className="admin-empty"><h3>No matching customers</h3><p>Try another name, email address, or phone number.</p></div>}
    </section>
  </div>;
}
