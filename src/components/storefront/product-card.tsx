import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/types";
import { formatNpr } from "@/lib/catalog/money";
import { getProductLowestPrice } from "@/lib/catalog/pricing";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const lowest = getProductLowestPrice(product);
  const original = lowest?.originalPricePaisa;
  return (
    <article className="product-card group">
      <Link className="product-image" href={`/products/${product.slug}`} aria-label={`View ${product.name}`} style={{ backgroundColor: product.imageTone }}>
        {product.images[0] && <Image
          src={product.images[0].src}
          alt={product.images[0].alt}
          fill
          unoptimized
          sizes="(max-width: 640px) 75vw, (max-width: 1024px) 42vw, 23vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />}
      </Link>
      <div className="flex items-start justify-between gap-3 pt-4">
        <div>
          <p className="eyebrow text-[10px]">{product.category ?? "Collection"}</p>
          <h3 className="mt-1 text-sm font-medium leading-snug text-ink"><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
          <p className="mt-2 text-sm font-semibold text-ink">{lowest ? formatNpr(lowest.pricePaisa) : "Currently unavailable"}</p>
          {original && lowest && <p className="price-original">{formatNpr(original)}</p>}
        </div>
      </div>
    </article>
  );
}
