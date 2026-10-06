import type { Metadata } from "next";
import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { addresses, orders } from "@/db/schema";
import { getCurrentSession } from "@/lib/authz";

export const metadata: Metadata = { title: "Account | NajFancyStore" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const current = await getCurrentSession();
  if (!current) return null;
  const db = getDatabase();
  const [[orderCount], [addressCount]] = await Promise.all([
    db.select({ value: count() }).from(orders).where(eq(orders.userId, current.user.id)),
    db.select({ value: count() }).from(addresses).where(eq(addresses.userId, current.user.id)),
  ]);

  return <main>
    <p className="eyebrow">WELCOME BACK</p>
    <h2 className="mb-2 text-2xl font-medium">Namaste, {current.user.name}</h2>
    <p className="mb-8 text-ink/70">Manage your details, delivery addresses, and orders from here.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Link className="rounded-xl border border-ink/15 p-6" href="/account/orders"><strong>{orderCount.value}</strong><p>Your orders</p></Link>
      <Link className="rounded-xl border border-ink/15 p-6" href="/account/addresses"><strong>{addressCount.value}</strong><p>Saved addresses</p></Link>
    </div>
    <p className="mt-8"><Link className="text-link" href="/shop">Continue shopping →</Link></p>
  </main>;
}
