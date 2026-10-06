"use client";

import { useMemo, useState } from "react";
import { parseNprToPaisa } from "@/lib/catalog/money";
import { getProductLowestPrice } from "@/lib/catalog/pricing";
import { ProductCard } from "@/components/storefront/product-card";
import type { CatalogProduct } from "@/lib/catalog/types";

type SortMode = "recommended" | "newest" | "name" | "price-low" | "price-high";

export default function ShopCatalog({ products, categories, initialQuery = "", initialCategory = "" }: { products: CatalogProduct[]; categories: { name: string; description: string }[]; initialQuery?: string; initialCategory?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortMode>("recommended");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const min = minPrice ? parseNprToPaisa(minPrice) : null;
    const max = maxPrice ? parseNprToPaisa(maxPrice) : null;
    const rows = products.filter((product) => {
      const price = getProductLowestPrice(product);
      if (term && !`${product.name} ${product.category} ${product.description}`.toLowerCase().includes(term)) return false;
      if (category && product.category !== category) return false;
      if (!price || (min !== null && BigInt(price.pricePaisa) < min) || (max !== null && BigInt(price.pricePaisa) > max)) return false;
      return true;
    });
    if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "newest") rows.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "price-low") rows.sort((a, b) => BigInt(getProductLowestPrice(a)!.pricePaisa) < BigInt(getProductLowestPrice(b)!.pricePaisa) ? -1 : 1);
    if (sort === "price-high") rows.sort((a, b) => BigInt(getProductLowestPrice(a)!.pricePaisa) > BigInt(getProductLowestPrice(b)!.pricePaisa) ? -1 : 1);
    return rows;
  }, [products, query, category, minPrice, maxPrice, sort]);
  function resetFilters() { setQuery(""); setCategory(""); setMinPrice(""); setMaxPrice(""); setSort("recommended"); }

  return <main className="shop-page page-wrap">
    <div className="shop-heading"><p className="eyebrow">THE NAJFANCY EDIT</p><h1>Pieces to make your own</h1><p>Considered clothing for every day, and every occasion.</p></div>
    <section className="shop-tools" aria-label="Product filters">
      <label>Search products<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “kurta” or “festive”" /></label>
      <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
      <label>Minimum price (NPR)<input type="number" min="0" step="0.01" inputMode="decimal" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="e.g. 2000" /></label>
      <label>Maximum price (NPR)<input type="number" min="0" step="0.01" inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="e.g. 8000" /></label>
      <label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}><option value="recommended">Recommended</option><option value="newest">Newest</option><option value="name">Name</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
    </section>
    <div className="shop-result-line"><p aria-live="polite">{filtered.length} {filtered.length === 1 ? "piece" : "pieces"}</p><button className="text-button" type="button" onClick={resetFilters}>Clear filters</button></div>
    {filtered.length ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><h2>No pieces found</h2><p>Try a different search or clear your filters.</p><button className="button button-dark" onClick={resetFilters}>Clear filters</button></div>}
  </main>;
}
