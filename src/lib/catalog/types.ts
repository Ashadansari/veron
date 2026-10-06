export type ProductImage = { src: string; alt: string };

export type ProductVariant = {
  id: string;
  sku?: string;
  size: string;
  color: string;
  pricePaisa: string;
  originalPricePaisa?: string;
  stock: number;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: number;
  imageTone: string;
};

/** Kept as a source-compatible alias for existing storefront component signatures. */
export type MockProduct = CatalogProduct;
