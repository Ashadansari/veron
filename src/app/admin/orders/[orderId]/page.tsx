import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDatabase } from "@/db";
import { orderItems, orderStatusEvents, orders, paymentRecords, user } from "@/db/schema";
import { requireAdmin } from "@/lib/authz";
import { formatPaisa } from "@/lib/commerce/money";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireAdmin();
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) notFound();
  const db = getDatabase();
  const [order] = await db.select({ order: orders, customerName: user.name, customerEmail: user.email }).from(orders)
    .leftJoin(user, eq(user.id, orders.userId)).where(eq(orders.id, orderId)).limit(1);
  if (!order) notFound();
  const [items, events, payments] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.order.id)),
    db.select().from(orderStatusEvents).where(eq(orderStatusEvents.orderId, order.order.id)).orderBy(asc(orderStatusEvents.createdAt)),
    db.select().from(paymentRecords).where(eq(paymentRecords.orderId, order.order.id)).orderBy(asc(paymentRecords.createdAt)),
  ]);
  const address = order.order.shippingAddressSnapshot as Record<string, string | number | null>;
  return <main className="admin-shell"><p className="eyebrow">ORDER OPERATIONS</p><Link href="/admin">← Back to orders</Link><h1>{order.order.orderNumber}</h1>
    <div className="admin-columns"><section><h2>Customer</h2><p>{order.customerName ?? "Deleted customer"}<br />{order.customerEmail ?? "Account deleted"}</p><h2>Delivery address</h2><p>{[address.fullName, address.phoneNumber, address.streetAddress, address.toleArea, address.wardNumber ? "Ward " + address.wardNumber : null, address.municipality, address.district, address.province, address.postalCode].filter(Boolean).join(", ") || "Personal delivery details anonymized"}</p></section>
      <section><h2>Order status</h2><p>{order.order.status} · {new Date(order.order.placedAt).toLocaleString("en-NP")}</p><p>Payment: {order.order.paymentMethod} · {order.order.paymentStatus}</p>{order.order.paymentStatus === "PAID" && order.order.status === "CANCELLED" && <p>Refund follow-up is required; no refund has been processed.</p>}<OrderStatusForm orderId={order.order.id} status={order.order.status} /></section></div>
    <section className="admin-section"><h2>Items</h2><div className="data-list">{items.map((item) => <div className="data-row" key={item.id}><span>{item.productName} · {item.variantLabel} · SKU {item.sku} × {item.quantity} at {formatPaisa(item.unitPricePaisa)}</span><strong>{formatPaisa(item.lineTotalPaisa)}</strong></div>)}</div><div className="order-total"><span>Items</span><strong>{formatPaisa(order.order.subtotalPaisa)}</strong><span>Delivery · {order.order.shippingRuleName}</span><strong>{formatPaisa(order.order.shippingPaisa)}</strong><span>Total · NPR</span><strong>{formatPaisa(order.order.totalPaisa)}</strong></div></section>
    <section className="admin-section"><h2>Payment attempts</h2><div className="data-list">{payments.map((payment) => <div className="data-row" key={payment.id}><span>{payment.provider.toUpperCase()} · {payment.status} · {formatPaisa(payment.amountPaisa)}<small>{payment.providerReference ? `Khalti pidx ${payment.providerReference}` : "No provider reference"}{payment.providerTransactionId ? ` · transaction ${payment.providerTransactionId}` : ""}</small></span><time>{new Date(payment.createdAt).toLocaleString("en-NP")}</time></div>)}</div><p className="admin-muted">Online payment status is updated only after provider lookup verification. Manual payment confirmation is not available.</p></section>
    <section className="admin-section"><h2>Status history</h2><div className="data-list">{events.map((event) => <div className="data-row" key={event.id}><span>{event.fromStatus ?? "Created"} → {event.toStatus} · {event.note ?? ""}</span><time>{new Date(event.createdAt).toLocaleString("en-NP")}</time></div>)}</div></section>
  </main>;
}
