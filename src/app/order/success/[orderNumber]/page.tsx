import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import { formatPaisa } from "@/lib/commerce/money";
import { getCustomerOrderByNumber } from "@/lib/commerce/customer-queries";
import { getCurrentSession } from "@/lib/authz";

export const metadata: Metadata = { title: "Order confirmed | VÉRON" };
export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const current = await getCurrentSession();
  if (!current) redirect("/login?next=/account/orders");
  if (current.user.role !== "CUSTOMER") redirect("/admin");
  const { orderNumber } = await params;
  const result = await getCustomerOrderByNumber(current.user.id, orderNumber);
  if (!result) notFound();
  const address = result.order.shippingAddressSnapshot as Record<string, string | number | null>;
  const paymentMessage = result.order.paymentStatus === "PAID"
    ? "Khalti has verified your payment. Your order is confirmed."
    : result.order.paymentStatus === "PENDING"
      ? "Payment is pending verification. Do not pay again; check your order history for updates."
      : result.order.paymentStatus === "FAILED"
        ? "The payment was not completed. The order has been cancelled and the stock released."
        : "Pay when your Cash on Delivery order arrives.";
  return <StorefrontFrame><main className="page-wrap py-14">
    <p className="eyebrow">{result.order.paymentStatus === "PAID" ? "PAYMENT VERIFIED" : "ORDER DETAILS"}</p><h1>{result.order.paymentStatus === "PAID" ? "Payment successful" : result.order.paymentStatus === "FAILED" ? "Payment not completed" : "Thank you for your order"}</h1>
    <p className="mt-2 text-ink/70">Order <strong>{result.order.orderNumber}</strong> · {result.order.status} · {result.order.paymentMethod === "COD" ? "Cash on Delivery" : "Khalti"} · {result.order.paymentStatus}</p>
    <p className="mt-2 text-ink/70">{paymentMessage}</p>
    <section className="mt-8 max-w-3xl rounded-xl border border-ink/15 p-5"><h2 className="font-medium">Delivery address</h2><p className="mt-2 text-sm text-ink/70">{[address.fullName, address.phoneNumber, address.streetAddress, address.toleArea, address.wardNumber ? `Ward ${address.wardNumber}` : null, address.municipality, address.district, address.province, address.postalCode].filter(Boolean).join(", ")}</p></section>
    <section className="mt-8 max-w-3xl"><h2 className="mb-3 font-medium">Order summary</h2><div className="grid gap-3">{result.items.map((item) => <div className="flex justify-between gap-4 border-b border-ink/10 py-3" key={item.id}><span>{item.productName} · {item.variantLabel} × {item.quantity}</span><strong>{formatPaisa(item.lineTotalPaisa)}</strong></div>)}</div>
      <div className="mt-5 grid max-w-md grid-cols-2 gap-2 text-sm"><span>Subtotal</span><strong className="text-right">{formatPaisa(result.order.subtotalPaisa)}</strong><span>Shipping · {result.order.shippingRuleName}</span><strong className="text-right">{formatPaisa(result.order.shippingPaisa)}</strong><span>Payment status</span><strong className="text-right">{result.order.paymentStatus}</strong><span>Payment method</span><strong className="text-right">{result.order.paymentMethod === "COD" ? "Cash on Delivery" : "Khalti"}</strong><span className="font-medium">Total</span><strong className="text-right">{formatPaisa(result.order.totalPaisa)}</strong></div>
    </section><div className="mt-8 flex gap-4"><Link className="button button-dark" href={`/account/orders/${result.order.id}`}>View order</Link><Link className="button button-outline" href="/shop">Continue shopping</Link></div>
  </main></StorefrontFrame>;
}
