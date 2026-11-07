"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/storefront/cart-provider";
import { BrandLogo } from "@/components/brand-logo";
import { BagIcon, SearchIcon } from "./icons";

export function SiteHeader() {
  const { itemCount } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <>
      <div className="announcement-bar">Delivery across Nepal <span aria-hidden="true">✦</span> Cash on Delivery where available</div>
      <header className="site-header">
        <div className="header-inner">
          <BrandLogo className="site-brand-logo" onClick={closeMenu} />
          <nav id="main-navigation" className={"desktop-nav" + (menuOpen ? " is-open" : "")} aria-label="Main navigation">
            <Link href="/" onClick={closeMenu}>Home</Link>
            <Link href="/shop" onClick={closeMenu}>Shop</Link>
            <Link href="/#categories" onClick={closeMenu}>Categories</Link>
            <Link href="/#story" onClick={closeMenu}>Our story</Link>
          </nav>
          <div className="header-actions">
            <button className="icon-button search-action" type="button" aria-label={searchOpen ? "Close search" : "Open product search"} aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)}>
              <SearchIcon className="h-[20px] w-[20px]" />
            </button>
            <Link className="bag-link" href="/cart" aria-label={"Cart, " + itemCount + (itemCount === 1 ? " item" : " items")}>
              <BagIcon className="h-[21px] w-[21px]" />{itemCount > 0 && <span className="bag-count" aria-hidden="true">{itemCount > 99 ? "99+" : itemCount}</span>}
            </Link>
            <Link className="account-header-link" href="/account">Account</Link>
            <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((open) => !open)}>
              <span /><span />
            </button>
          </div>
          {searchOpen && <form className="header-search-form" action="/shop" role="search"><label className="sr-only" htmlFor="header-search">Search products</label><input id="header-search" name="q" type="search" autoFocus placeholder="Search products" /><button className="button button-dark">Search</button></form>}
        </div>
      </header>
    </>
  );
}
