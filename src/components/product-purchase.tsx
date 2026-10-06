"use client";

import { useState } from "react";
import { AddToCart } from "@/components/commerce-controls";

type Option = { id: string; label: string; size: string; color: string; stock: number; price: string };

export function ProductPurchase({ options }: { options: Option[] }) {
  const firstAvailable = options.find((option) => option.stock > 0) ?? options[0];
  const [size, setSize] = useState(firstAvailable?.size ?? "");
  const [color, setColor] = useState(firstAvailable?.color ?? "");
  const sizes = [...new Set(options.map((option) => option.size))];
  const colors = [...new Set(options.map((option) => option.color))];
  const variantsAtSize = options.filter((option) => option.size === size);
  const selected = options.find((option) => option.size === size && option.color === color);
  if (!options.length) return <p>Currently unavailable.</p>;
  return <div className="purchase-panel">
    <fieldset className="choice-group"><legend>Size</legend><div className="choice-options">{sizes.map((option) => {
      const matches = options.filter((variant) => variant.size === option);
      const available = matches.some((variant) => variant.stock > 0);
      return <button key={option} type="button" disabled={!available} aria-pressed={size === option} aria-label={`Size ${option}${available ? "" : ", out of stock"}`} onClick={() => {
        setSize(option);
        const next = matches.find((variant) => variant.stock > 0) ?? matches[0];
        if (next) setColor(next.color);
      }}>{option}{!available && <small> · Out of stock</small>}</button>;
    })}</div></fieldset>
    <fieldset className="choice-group"><legend>Color <span>{color}</span></legend><div className="choice-options">{colors.map((option) => {
      const matches = variantsAtSize.filter((variant) => variant.color === option);
      const available = matches.some((variant) => variant.stock > 0);
      return <button key={option} type="button" disabled={!available} aria-pressed={color === option} aria-label={`Color ${option}${available ? "" : matches.length ? ", out of stock" : ", unavailable for this size"}`} onClick={() => setColor(option)}>{option}{!available && <small>{matches.length ? " · Out of stock" : " · Unavailable"}</small>}</button>;
    })}</div></fieldset>
    {selected && <><p className="product-detail-price">{selected.price}</p>{selected.stock > 0 ? <p className="stock-note">{selected.stock} available</p> : <p className="stock-note">Out of stock</p>}<AddToCart variantId={selected.id} max={selected.stock} /></>}
  </div>;
}
