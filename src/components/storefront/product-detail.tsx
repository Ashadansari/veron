"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/storefront/cart-provider";
import { addToCart as addToCustomerCart } from "@/app/actions/customer";
import { ProductCard } from "@/components/storefront/product-card";
import type { CatalogProduct, ProductVariant } from "@/lib/catalog/types";
import { formatNpr } from "@/lib/catalog/money";

export default function ProductDetail({ product, related }: { product: CatalogProduct; related: CatalogProduct[] }) {
  const router = useRouter();
  const { refreshCustomerCart } = useCart();
  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState(product.variants.find((v) => v.stock > 0)?.size ?? product.variants[0]?.size ?? "");
  const [color, setColor] = useState(product.variants.find((v) => v.stock > 0 && v.size === size)?.color ?? product.variants.find((v) => v.size === size)?.color ?? "");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Set(product.variants.map((v) => v.color))];
  const variantsAtSize = product.variants.filter((v) => v.size === size);
  const selectedVariant: ProductVariant | undefined = product.variants.find((v) => v.size === size && v.color === color);
  const selected = selectedVariant && selectedVariant.stock > 0 ? selectedVariant : undefined;
  async function add(buyNow: boolean) {
    if (!selected) { setMessage("Choose an available size and color first."); return; }
    try {
      await addToCustomerCart({ variantId: selected.id, quantity });
      await refreshCustomerCart();
      setMessage("Added to your bag.");
      if (buyNow) router.push("/checkout");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in to add items to your bag.");
    }
  }
  return <main className="page-wrap product-detail-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/shop">Shop</Link><span>/</span><span>{product.category}</span><span>/</span><span>{product.name}</span></nav>
    <div className="product-detail-grid">
      <section className="product-gallery" aria-label="Product images">
        <div className="product-main-image" style={{ backgroundColor: product.imageTone }}>{product.images[imageIndex] && <Image src={product.images[imageIndex].src} alt={product.images[imageIndex].alt} fill priority unoptimized sizes="(max-width: 800px) 100vw, 55vw" className="object-cover" />}</div>
        <div className="product-thumbnails">{product.images.map((image, index) => <button key={image.src + index} type="button" aria-label={`Show image ${index + 1}`} aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)}><Image src={image.src} alt="" fill unoptimized sizes="80px" className="object-cover" /></button>)}</div>
      </section>
      <section className="product-buy-panel">
        <p className="eyebrow">{product.category}</p><h1>{product.name}</h1>
        <p className="product-description">{product.description}</p>
        <div className="detail-price">{selected ? formatNpr(selected.pricePaisa) : "Currently unavailable"}{selected?.originalPricePaisa && <span className="price-original">{formatNpr(selected.originalPricePaisa)}</span>}</div>
        <fieldset className="choice-group"><legend>Size</legend><div className="choice-options">{sizes.map((option) => { const matches = product.variants.filter((v) => v.size === option); const available = matches.some((v) => v.stock > 0); return <button type="button" key={option} disabled={!available} aria-pressed={size === option} aria-label={`Size ${option}${available ? "" : ", out of stock"}`} onClick={() => { setSize(option); const next = product.variants.find((v) => v.size === option && v.stock > 0) ?? matches[0]; setColor(next?.color ?? ""); setQuantity(1); setMessage(""); }}>{option}{!available && <small> · Out of stock</small>}</button>; })}</div></fieldset>
        <fieldset className="choice-group"><legend>Color <span>{color}</span></legend><div className="choice-options">{colors.map((option) => { const matches = variantsAtSize.filter((v) => v.color === option); const available = matches.some((v) => v.stock > 0); const unavailable = matches.length === 0; return <button type="button" key={option} disabled={!available} aria-pressed={color === option} aria-label={`Color ${option}${available ? "" : unavailable ? ", unavailable for this size" : ", out of stock"}`} onClick={() => { setColor(option); setQuantity(1); setMessage(""); }}>{option}{!available && <small>{unavailable ? " · Unavailable" : " · Out of stock"}</small>}</button>; })}</div></fieldset>
        {selectedVariant && <p className="stock-note">{selected ? `${selected.stock} available` : "Out of stock"}</p>}
        <label className="quantity-label">Quantity <input aria-label="Quantity" type="number" min={1} max={selected?.stock ?? 1} value={quantity} disabled={!selected} onChange={(e) => setQuantity(Math.max(1, Math.min(selected?.stock ?? 1, Number(e.target.value) || 1)))} /></label>
        <div className="buy-actions"><button className="button button-dark" type="button" disabled={!selected} onClick={() => add(false)}>Add to bag</button><button className="button button-outline" type="button" disabled={!selected} onClick={() => add(true)}>Buy now</button></div>
        <p role="status" aria-live="polite" className="form-status">{message}</p>
        <p className="shipping-note">Delivery options and charges are shown at checkout.</p>
      </section>
    </div>
    {related.length > 0 && <section className="related-section"><div className="section-heading"><div><p className="eyebrow">MORE TO LOVE</p><h2>From the same edit</h2></div><Link href={`/shop?category=${encodeURIComponent(product.category)}`}>View all</Link></div><div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
  </main>;
}
