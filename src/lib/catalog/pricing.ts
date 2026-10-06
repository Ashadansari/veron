import type { CatalogProduct } from "@/lib/catalog/types";

export function getProductLowestPrice(product: CatalogProduct) {
  return product.variants.filter((variant) => variant.stock > 0)
    .sort((left, right) => BigInt(left.pricePaisa) < BigInt(right.pricePaisa) ? -1 : BigInt(left.pricePaisa) > BigInt(right.pricePaisa) ? 1 : 0)[0] ?? null;
}
