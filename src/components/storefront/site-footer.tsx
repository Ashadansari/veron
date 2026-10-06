import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="brand-mark brand-mark-light" href="/" aria-label="Naj Fancy Store home">
            <span className="brand-name">naj<span>fancy</span></span>
            <span className="brand-caption">CLOTHING FOR NEPAL</span>
          </Link>
          <p>Clothes that feel like you.<br />Made for all the moments in between.</p>
        </div>
        <div className="footer-column">
          <p className="footer-heading">Explore</p>
          <Link href="/shop">New arrivals</Link>
          <Link href="/#categories">Collections</Link>
          <Link href="/shop">Bestsellers</Link>
        </div>
        <div className="footer-column">
          <p className="footer-heading">We&apos;re here</p>
          <a href="mailto:hello@najfancy.store">Contact us</a>
          <Link href="/checkout">Shipping & delivery</Link>
          <Link href="/account/orders">My orders</Link>
        </div>
        <div className="footer-note">
          <span className="footer-star">✳</span>
          <p>Thoughtfully chosen.<br />Lovingly worn.</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Naj Fancy Store</span>
        <span>Made with love, for Nepal</span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}
