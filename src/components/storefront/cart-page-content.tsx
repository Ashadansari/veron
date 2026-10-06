"use client";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/storefront/cart-provider";
import { formatNpr } from "@/lib/catalog/money";
import { clearCustomerCart, setCartQuantity as saveCartQuantity } from "@/app/actions/customer";
import { useState } from "react";

export default function CartPageContent() {
  const { items, isLoaded, loadError, subtotalPaisa, setQuantity, removeItem, clearCart } = useCart();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  async function updateQuantity(variantId: string, quantity: number) {
    setBusy(true); setActionError("");
    try { await saveCartQuantity({ variantId, quantity }); if (quantity === 0) removeItem(variantId); else setQuantity(variantId, quantity); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Could not update your cart."); }
    finally { setBusy(false); }
  }
  if (!isLoaded) return <main className="page-wrap cart-page"><p role="status">Loading your bag…</p></main>;
  return <main className="page-wrap cart-page"><p className="eyebrow">YOUR SELECTION</p><h1>Your bag</h1>
    {loadError && <p className="form-error" role="alert">{loadError} <button className="text-button" type="button" onClick={() => window.location.reload()}>Reload</button></p>}
    {!items.length ? <div className="empty-state"><h2>Your bag is waiting</h2><p>Find something you love in the latest edit.</p><Link className="button button-dark" href="/shop">Explore the shop</Link></div> : <div className="cart-layout">
      <section className="cart-lines" aria-label="Items in your bag">{items.map(({ product, variant, quantity }) => <article className="cart-line" key={variant.id}>
        <Link className="cart-line-image" href={`/products/${product.slug}`} style={{ backgroundColor: product.imageTone }}>{product.images[0] && <Image src={product.images[0].src} alt={product.images[0].alt} fill unoptimized sizes="130px" />}</Link>
        <div className="cart-line-info"><p className="eyebrow">{product.category}</p><h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2><p>{variant.size} · {variant.color}</p><strong>{formatNpr(variant.pricePaisa)}</strong>
          <label>Quantity <select disabled={busy} aria-label={`Quantity for ${product.name} ${variant.size} ${variant.color}`} value={quantity} onChange={(e) => void updateQuantity(variant.id, Number(e.target.value))}>{Array.from({ length: Math.max(quantity, variant.stock) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <button className="text-button" type="button" disabled={busy} onClick={() => void updateQuantity(variant.id, 0)}>Remove</button>
        </div>
        <strong className="cart-line-total">{formatNpr((BigInt(variant.pricePaisa) * BigInt(quantity)).toString())}</strong>
      </article>)}</section>
      <aside className="cart-summary"><h2>Summary</h2><div><span>Subtotal</span><strong>{formatNpr(subtotalPaisa.toString())}</strong></div><div><span>Delivery</span><span>Shown at checkout</span></div><p>Delivery charges depend on the configured shipping options.</p>{actionError && <p className="form-error" role="alert">{actionError}</p>}<Link className="button button-dark" href="/checkout">Continue to checkout</Link><button className="text-button" type="button" disabled={busy} onClick={async () => { setBusy(true); setActionError(""); try { await clearCustomerCart(); clearCart(); } catch { setActionError("Could not clear your saved cart."); } finally { setBusy(false); } }}>Clear bag</button></aside>
    </div>}
  </main>;
}
