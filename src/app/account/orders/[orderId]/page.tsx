import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerOrder } from "@/lib/commerce/customer-queries";
import { formatPaisa } from "@/lib/commerce/money";
import { getCurrentSession } from "@/lib/authz";
import { CancelOrderButton } from "@/components/account/cancel-order-button";

export const metadata: Metadata = { title: "Order details | VÉRON" };
export const dynamic = "force-dynamic";

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const current = await getCurrentSession();
  if (!current) notFound();
  const { orderId } = await params;
  const result = await getCustomerOrder(current.user.id, orderId);
  if (!result) notFound();

  const address = result.order.shippingAddressSnapshot as Record<string, string | number | null>;
  return <main className="max-w-3xl">
    <Link className="text-link" href="/account/orders">← Your orders</Link>
    <p className="eyebrow mt-6">ORDER DETAILS</p><h2 className="mb-2 text-2xl font-medium">{result.order.orderNumber}</h2>
    <p className="mb-6 text-ink/70">Placed {new Date(result.order.placedAt).toLocaleString("en-NP")} · {result.order.status}</p>
    <section className="mb-8 rounded-xl border border-ink/15 p-5"><h3 className="font-medium">Delivery address</h3>
      <p className="mt-2 text-sm text-ink/70">{[address.fullName, address.phoneNumber, address.streetAddress, address.toleArea, address.wardNumber ? `Ward ${address.wardNumber}` : null, address.municipality, address.district, address.province, address.postalCode].filter(Boolean).join(", ")}</p>
    </section>
    <section><h3 className="mb-3 font-medium">Items</h3><div className="grid gap-3">{result.items.map((item) => <div className="flex justify-between gap-4 border-b border-ink/10 py-3" key={item.id}>
      <span>{item.productName} · {item.variantLabel} × {item.quantity}</span><strong>{formatPaisa(item.lineTotalPaisa)}</strong>
    </div>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-sm"><span>Subtotal</span><strong className="text-right">{formatPaisa(result.order.subtotalPaisa)}</strong><span>Shipping · {result.order.shippingRuleName}</span><strong className="text-right">{formatPaisa(result.order.shippingPaisa)}</strong><span className="font-medium">Total</span><strong className="text-right">{formatPaisa(result.order.totalPaisa)}</strong><span>Payment</span><strong className="text-right">{result.order.paymentMethod} · {result.order.paymentStatus}</strong></div>
    </section>
    {result.order.status === "PLACED" && result.order.paymentStatus === "UNPAID" && <CancelOrderButton orderId={result.order.id} />}
  </main>;
}
