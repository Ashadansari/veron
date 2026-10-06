import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import { LogoutButton } from "@/components/account-actions";
import { getCurrentSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CustomerAccountLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentSession();
  if (!current) redirect("/login?next=/account");
  if (current.user.role !== "CUSTOMER") {
    if (current.user.role === "ADMIN") redirect("/admin");
    notFound();
  }

  return <StorefrontFrame>
    <div className="page-wrap py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">YOUR ACCOUNT</p><h1 className="text-3xl font-semibold">Account</h1></div>
        <LogoutButton />
      </div>
      <nav aria-label="Account navigation" className="mb-8 flex flex-wrap gap-x-6 gap-y-3 border-b border-ink/15 pb-4">
        <Link className="text-link" href="/account">Overview</Link>
        <Link className="text-link" href="/account/profile">Profile</Link>
        <Link className="text-link" href="/account/addresses">Addresses</Link>
        <Link className="text-link" href="/account/orders">Orders</Link>
        <Link className="text-link" href="/account/notifications">Notifications</Link>
        <Link className="text-link" href="/account/settings">Settings</Link>
      </nav>
      {children}
    </div>
  </StorefrontFrame>;
}
