"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { placeOrder } from "@/app/actions/place-order";
import { useCart } from "@/components/storefront/cart-provider";
import { formatNpr } from "@/lib/catalog/money";

type Review = Awaited<ReturnType<typeof import("@/lib/commerce/customer-queries").getCheckoutReview>>;

export function CheckoutReview({ review }: { review: Review }) {
  const [addressId, setAddressId] = useState(review.addresses.find((address) => address.codEnabled)?.id ?? review.addresses[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "PROVIDER">("COD");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { clearCart } = useCart();
  const selected = review.addresses.find((address) => address.id === addressId);
  const unavailable = review.items.some((item) => !item.available);
  const shipping = selected?.shippingPaisa;
  const total = shipping === null || shipping === undefined ? null : (BigInt(review.subtotalPaisa) + BigInt(shipping)).toString();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || (paymentMethod === "COD" && !selected.codEnabled) || (paymentMethod === "PROVIDER" && !review.khaltiEnabled) || unavailable) return;
    setPending(true); setMessage("");
    try {
      const result = await placeOrder({ addressId: selected.id, method: paymentMethod });
      clearCart();
      if (result.paymentMethod === "PROVIDER" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      router.push(`/order/success/${encodeURIComponent(result.orderNumber)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not place your order. Your cart is still saved.");
      setPending(false);
    }
  }

  return <main className="page-wrap checkout-page">
    <p className="eyebrow">SECURE CHECKOUT</p><h1>Checkout</h1>
    {!review.items.length ? <div className="empty-state"><h2>Your cart is empty</h2><p>Add items before checking out.</p><Link className="button button-dark" href="/shop">Explore the shop</Link></div> : <div className="checkout-layout">
      <form className="checkout-form" onSubmit={submit}>
        <h2>Delivery address</h2>
        {review.addresses.length ? <label>Choose an address<select value={addressId} onChange={(event) => setAddressId(event.target.value)} required>{review.addresses.map((address) => <option key={address.id} value={address.id}>{address.fullName} · {address.municipality}, {address.district}, {address.province}</option>)}</select></label> : <p>No saved address. <Link className="text-link" href="/account/addresses">Add a Nepal delivery address</Link>.</p>}
        {selected && <div className="checkout-address"><strong>{selected.fullName}</strong><p>{selected.phoneNumber}<br />{[selected.streetAddress, selected.toleArea, `Ward ${selected.wardNumber}`, selected.municipality, selected.district, selected.province, selected.postalCode].filter(Boolean).join(", ")}</p></div>}
        <fieldset className="payment-choice"><legend>Payment method</legend>
          <label><input type="radio" name="paymentMethod" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} disabled={!selected?.codEnabled} /> Cash on Delivery</label>
          {paymentMethod === "COD" && <p>Payment remains unpaid until it is collected and recorded by the store.</p>}
          <label className={review.khaltiEnabled ? "" : "payment-unavailable"}><input type="radio" name="paymentMethod" checked={paymentMethod === "PROVIDER"} onChange={() => setPaymentMethod("PROVIDER")} disabled={!review.khaltiEnabled} /> Online payment through Khalti <span>{review.khaltiEnabled ? "· Secure redirect" : "· Configuration required"}</span></label>
        </fieldset>
        {unavailable && <p role="alert" className="form-error">One or more items have changed or no longer have enough stock. Return to your cart and review them.</p>}
        {selected && !selected.codEnabled && <p role="alert" className="form-error">Cash on Delivery is not available for this address under current shipping settings.</p>}
        {message && <p role="alert" className="form-error">{message}</p>}
        <button className="button button-dark" type="submit" disabled={pending || !selected || (paymentMethod === "COD" && !selected.codEnabled) || (paymentMethod === "PROVIDER" && !review.khaltiEnabled) || unavailable || review.items.length === 0}>{pending ? "Creating order…" : paymentMethod === "PROVIDER" ? "Continue to Khalti" : "Place order"}</button>
        <p><Link className="text-link" href="/cart">Return to cart</Link></p>
      </form>
      <aside className="checkout-summary"><h2>Order summary</h2>
        {review.items.map((item) => <div className="checkout-item" key={item.variantId}><span>{item.productName} · {item.variantLabel} × {item.quantity}{!item.available && <em> · Review item</em>}</span><strong>{formatNpr(item.lineTotalPaisa)}</strong></div>)}
        <div className="checkout-total"><span>Subtotal</span><strong>{formatNpr(review.subtotalPaisa)}</strong></div>
        <div className="checkout-total"><span>Shipping{selected?.ruleName ? ` · ${selected.ruleName}` : ""}</span><strong>{shipping === null || shipping === undefined ? "Unavailable" : formatNpr(shipping)}</strong></div>
        <div className="checkout-total"><span>Total</span><strong>{total === null ? "Unavailable" : formatNpr(total)}</strong></div>
        <p>Prices, shipping, stock, and the final total are recalculated by the server when you place the order.</p>
      </aside>
    </div>}
  </main>;
}
