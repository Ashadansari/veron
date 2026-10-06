import Link from "next/link";
import type { ReactNode } from "react";

export default function AccountPlaceholder({ title, children }: { title: string; children?: ReactNode }) {
  return <main className="page-wrap account-placeholder"><p className="eyebrow">YOUR ACCOUNT</p><h1>{title}</h1><div className="empty-state"><h2>Coming soon</h2><p>Customer account features are being prepared for a future release.</p>{children}</div><nav className="account-placeholder-links" aria-label="Account pages"><Link href="/account">Overview</Link><Link href="/account/profile">Profile</Link><Link href="/account/addresses">Addresses</Link><Link href="/account/orders">Orders</Link><Link href="/account/settings">Settings</Link></nav><Link className="text-link" href="/shop">Continue shopping</Link></main>;
}
