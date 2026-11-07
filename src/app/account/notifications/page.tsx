import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSession } from "@/lib/authz";
import { getCustomerOrderNotifications } from "@/lib/notifications/customer-notifications";

export const metadata: Metadata = { title: "Order notifications | VÉRON" };
export const dynamic = "force-dynamic";

export default async function AccountNotificationsPage() {
  const current = await getCurrentSession();
  if (!current) return null;
  const notifications = await getCustomerOrderNotifications({ userId: current.user.id, role: current.user.role ?? "" });

  return <main>
    <p className="eyebrow">ORDER UPDATES</p>
    <h2 className="mb-6 text-2xl font-medium">Notifications</h2>
    {notifications.length ? <ul className="grid gap-3">
      {notifications.map((notification) => <li key={notification.id}>
        <Link className="block rounded-xl border border-ink/15 p-5" href={`/account/orders/${notification.orderId}`}>
          <p>{notification.message}</p>
          <time className="mt-2 block text-sm text-ink/60" dateTime={notification.createdAt.toISOString()}>
            {notification.createdAt.toLocaleString("en-NP", { timeZone: "Asia/Kathmandu" })}
          </time>
        </Link>
      </li>)}
    </ul> : <p className="text-ink/70">Order updates will appear here.</p>}
  </main>;
}
