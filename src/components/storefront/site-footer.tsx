import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <BrandLogo className="footer-brand-logo" variant="on-dark" />
          <p>Fashion. Style. You.<br />Timeless pieces for every occasion.</p>
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
        <span>© 2026 VÉRON</span>
        <span>Made with love, for Nepal</span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}
