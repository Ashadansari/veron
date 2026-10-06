"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart, setCartQuantity } from "@/app/actions/customer";
import { placeOrder } from "@/app/actions/place-order";

export function AddToCart({ variantId, max }: { variantId: string; max: number }) {
  const [message, setMessage] = useState("");
  return <div className="inline-control"><button className="button button-dark" disabled={max < 1} onClick={async () => {
    try { await addToCart({ variantId, quantity: 1 }); setMessage("Added to your cart."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not add this item."); }
  }}>{max < 1 ? "Out of stock" : "Add to cart"}</button>{message && <span role="status">{message}</span>}</div>;
}

export function CartQuantity({ variantId, quantity }: { variantId: string; quantity: number }) {
  const [message, setMessage] = useState("");
  return <div className="inline-control"><button aria-label="Remove one item" onClick={async () => { try { await setCartQuantity({ variantId, quantity: Math.max(0, quantity - 1) }); } catch { setMessage("Could not update quantity."); } }}>−</button><span>{quantity}</span><button aria-label="Add one item" onClick={async () => { try { await setCartQuantity({ variantId, quantity: quantity + 1 }); } catch { setMessage("Could not update quantity."); } }}>+</button>{message && <span role="alert">{message}</span>}</div>;
}

export function CheckoutForm({ addresses }: { addresses: Array<{ id: string; fullName: string; province: string; district: string; municipality: string; shippingLabel: string | null; codEnabled: boolean }> }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const router = useRouter();
  const selectedAddress = addresses.find((address) => address.id === addressId);
  return <form className="auth-form" action={async (data) => {
    setBusy(true); setMessage("");
    try { await placeOrder({ addressId: String(data.get("addressId")), method: "COD" }); router.push("/account/orders"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not place your order."); setBusy(false); }
  }}>
    <label>Delivery address<select name="addressId" value={addressId} onChange={(event) => setAddressId(event.target.value)} required>{addresses.map((address) => <option key={address.id} value={address.id}>{address.fullName} · {address.municipality}, {address.district}, {address.province}</option>)}</select></label>
    {selectedAddress?.codEnabled ? <p>Delivery: {selectedAddress.shippingLabel}. Cash on Delivery is available.</p> : <p>Delivery is not currently available for this address under the store’s shipping rules.</p>}
    {message && <p role="alert" className="form-error">{message}</p>}
    <button className="button button-dark" disabled={busy || !selectedAddress?.codEnabled}>{busy ? "Placing order…" : "Place order"}</button>
  </form>;
}
