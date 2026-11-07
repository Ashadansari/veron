import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerOrders } from "@/lib/commerce/customer-queries";
import { formatPaisa } from "@/lib/commerce/money";
import { getCurrentSession } from "@/lib/authz";

export const metadata: Metadata = { title: "Your orders | VÉRON" };
export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const current = await getCurrentSession();
  if (!current) return null;
  const customerOrders = await getCustomerOrders(current.user.id);
  return <main>
    <p className="eyebrow">ORDER HISTORY</p><h2 className="mb-6 text-2xl font-medium">Your orders</h2>
    {customerOrders.length ? <div className="grid gap-3">{customerOrders.map((order) => <Link className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink/15 p-5" href={`/account/orders/${order.id}`} key={order.id}>
      <div><strong>{order.orderNumber}</strong><p className="text-sm text-ink/70">{new Date(order.placedAt).toLocaleDateString("en-NP")} · {order.status} · {order.itemCount} items</p></div>
      <div className="text-right"><strong>{formatPaisa(order.totalPaisa)}</strong><p className="text-sm text-ink/70">{order.paymentStatus} · {order.paymentMethod}</p></div>
    </Link>)}</div> : <p className="text-ink/70">Your orders will appear here after checkout.</p>}
  </main>;
}
