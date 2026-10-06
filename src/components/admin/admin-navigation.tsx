"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/account-actions";
import { AdminOrderAlerts } from "@/components/admin/admin-order-alerts";

const links = [
  { label: "Dashboard", href: "/admin", match: (path: string) => path === "/admin" },
  { label: "Products", href: "/admin/products", match: (path: string) => path.startsWith("/admin/products") },
  { label: "Categories", href: "/admin/categories", match: (path: string) => path.startsWith("/admin/categories") },
  { label: "Inventory", href: "/admin/inventory", match: (path: string) => path.startsWith("/admin/inventory") },
  { label: "Orders", href: "/admin/orders", match: (path: string) => path.startsWith("/admin/orders") },
  { label: "Customers", href: "/admin/customers", match: (path: string) => path.startsWith("/admin/customers") },
  { label: "Settings", href: "/admin/settings", match: (path: string) => path.startsWith("/admin/settings") },
];

export function AdminNavigation({ name, email }: { name: string; email: string }) {
  const path = usePathname();
  return <>
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand">NajFancyStore<span>OPERATIONS</span></Link>
      <nav aria-label="Admin navigation">
        {links.map((link) => <Link key={link.href} href={link.href} aria-current={link.match(path) ? "page" : undefined} className={link.match(path) ? "admin-nav-link is-current" : "admin-nav-link"}>{link.label}</Link>)}
      </nav>
      <div className="admin-sidebar-user"><strong>{name}</strong><span>{email}</span><LogoutButton /></div>
    </aside>
    <header className="admin-mobile-header"><Link href="/admin" className="admin-brand">NajFancyStore<span>ADMIN</span></Link><span className="admin-mobile-user">{name}</span><LogoutButton /></header>
    <nav aria-label="Admin mobile navigation" className="admin-mobile-nav">
      {links.map((link) => <Link key={link.href} href={link.href} aria-current={link.match(path) ? "page" : undefined}>{link.label}</Link>)}
    </nav>
    <AdminOrderAlerts />
  </>;
}
