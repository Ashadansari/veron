import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "@/components/storefront/icons";
import { ProductCard } from "@/components/storefront/product-card";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { getCatalogCategories, getCatalogProducts } from "@/lib/catalog/repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, products] = await Promise.all([getCatalogCategories(), getCatalogProducts()]);
  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <Image
            className="hero-image"
            src="https://images.unsplash.com/photo-1668371679302-a8ec781e876e?auto=format&fit=crop&w=2200&q=90"
            alt="A model wearing a richly detailed red festive outfit"
            fill
            priority
            unoptimized
            sizes="100vw"
          />
          <div className="hero-overlay" />
          <div className="hero-content">
            <span className="hero-kicker"><span /> VÉRON · THE NEW COLLECTION</span>
            <h1 id="hero-title">A signature<br />in <em>every detail.</em></h1>
            <p>Elevated everyday and occasion wear for men and women.</p>
            <a className="button button-light" href="#shop">Discover the collection <ArrowIcon className="h-4 w-4" /></a>
          </div>
          <span className="hero-index">01 <span /> 04</span>
          <span className="hero-side-note">THE NEW SEASON, YOUR WAY</span>
        </section>

        <section className="benefit-strip" aria-label="Shopping benefits">
          <p><span>✳</span> Delivery settings shown at checkout</p>
          <i />
          <p><span>✳</span> Cash on Delivery where available</p>
          <i />
          <p><span>✳</span> Prices shown in NPR</p>
        </section>

        <section className="section-shell categories-section" id="categories">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CURATED FOR YOU</p>
              <h2>Discover the collection</h2>
            </div>
            <Link className="text-link" href="/shop">See everything <ArrowIcon className="h-4 w-4" /></Link>
          </div>
          <div className="category-grid">
            {categories.slice(0, 4).map((category, index) => (
              <Link className={"category-tile category-tile-" + (index + 1)} href={`/shop?category=${encodeURIComponent(category.name)}`} key={category.name}>
                <span className="category-index">0{index + 1}</span>
                <span className="category-copy">
                  <span className="category-title">{category.name}</span>
                  <span className="category-count">{category.description || "Explore the collection"}</span>
                </span>
                <span className="category-arrow"><ArrowIcon className="h-4 w-4" /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section-shell products-section" id="shop">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE VÉRON EDIT</p>
              <h2>New season, timeless style.</h2>
            </div>
            <Link className="text-link" href="/shop">Shop the collection <ArrowIcon className="h-4 w-4" /></Link>
          </div>
          <div className="product-grid">{products.slice(0, 4).map((product) => <ProductCard product={product} key={product.id} />)}</div>
        </section>

        <section className="story-panel" id="story">
          <div className="story-ornament" aria-hidden="true">✳</div>
          <div className="story-copy">
            <p className="eyebrow">MADE TO BE YOURS</p>
            <h2>Wear what feels<br /><em>like you.</em></h2>
            <p>Thoughtful silhouettes, considered details, and timeless pieces for every version of your day.</p>
          <Link className="button button-dark" href="/shop">Explore VÉRON <ArrowIcon className="h-4 w-4" /></Link>
          </div>
          <div className="story-image-wrap">
            <Image
              src="https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1100&q=85"
              alt="Softly layered fabric in warm rose and earth tones"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="story-image"
              unoptimized
            />
            <span className="story-caption">DRESS LIKE YOU MEAN IT</span>
          </div>
        </section>

        <section className="newsletter-section">
          <span className="newsletter-spark">✳</span>
          <p className="eyebrow">A NOTE FROM VÉRON</p>
          <h2>Fashion. Style. You.</h2>
          <p>Discover considered fashion for all the moments that matter.</p>
          <Link className="text-link" href="/shop">Find your signature style <ArrowIcon className="h-4 w-4" /></Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
