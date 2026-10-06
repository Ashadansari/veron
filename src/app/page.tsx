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
            <span className="hero-kicker"><span /> A LITTLE MORE YOU</span>
            <h1 id="hero-title">Made for your<br />kind of <em>everyday.</em></h1>
            <p>Easy, expressive clothing for every version of you.</p>
            <a className="button button-light" href="#shop">Find your favourite <ArrowIcon className="h-4 w-4" /></a>
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
              <p className="eyebrow">A GOOD PLACE TO START</p>
              <h2>What are you in the mood for?</h2>
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
              <p className="eyebrow">YOUR NEXT LOVE, MAYBE?</p>
              <h2>Good things, just in</h2>
            </div>
            <Link className="text-link" href="/shop">Shop the collection <ArrowIcon className="h-4 w-4" /></Link>
          </div>
          <div className="product-grid">{products.slice(0, 4).map((product) => <ProductCard product={product} key={product.id} />)}</div>
        </section>

        <section className="story-panel" id="story">
          <div className="story-ornament" aria-hidden="true">✳</div>
          <div className="story-copy">
            <p className="eyebrow">NOT JUST FOR THE BIG DAYS</p>
            <h2>Wear what feels<br /><em>like you.</em></h2>
            <p>Some days call for a little extra. Some days call for your favourite kurta and nowhere to be. We make room for all of them.</p>
          <Link className="button button-dark" href="/shop">Explore the store <ArrowIcon className="h-4 w-4" /></Link>
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
          <p className="eyebrow">LETTERS FROM US</p>
          <h2>Good things in your inbox.</h2>
          <p>Store updates are coming soon.</p>
          <Link className="text-link" href="/account">Account features are coming soon <ArrowIcon className="h-4 w-4" /></Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
