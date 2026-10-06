"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Alert = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  total: string;
  currency: string;
  createdAt: string;
  isRead: boolean;
  eventType: "NEW_ORDER" | "ORDER_CANCELLED";
  title: string;
  description: string;
};

type AlertResponse = { unreadCount: number; items: Alert[] };

function relativeTime(value: string) {
  const delta = new Date(value).getTime() - Date.now();
  const seconds = Math.round(delta / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export function AdminOrderAlerts() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertResponse>({ unreadCount: 0, items: [] });
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as AlertResponse;
      setAlerts(result);
    } catch {
      // Keep the existing inbox view if a periodic refresh is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60_000);
    const onVisibilityChange = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  async function markAllRead() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (response.ok) await refresh();
    } catch {
      // The count is refreshed on the next poll if this request fails.
    } finally {
      setBusy(false);
    }
  }

  async function openOrder(alert: Alert) {
    if (!alert.isRead) {
      setBusy(true);
      try {
        await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notificationId: alert.id }),
        });
        await refresh();
      } catch {
        // Navigation remains available even if recording the read state fails.
      } finally {
        setBusy(false);
      }
    }
    setOpen(false);
    router.push(`/admin/orders/${alert.orderId}`);
  }

  return <div className="admin-alerts-anchor">
    <button
      type="button"
      className="admin-alerts-trigger"
      aria-label={`Order notifications${alerts.unreadCount ? `, ${alerts.unreadCount} unread` : ""}`}
      aria-expanded={open}
      aria-controls="admin-order-alerts-panel"
      onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      <span className="admin-alerts-label">Orders</span>
      {alerts.unreadCount > 0 && <span className="admin-alerts-count" aria-live="polite">{alerts.unreadCount > 99 ? "99+" : alerts.unreadCount}</span>}
    </button>
    {open && <section id="admin-order-alerts-panel" className="admin-alerts-panel" aria-label="Recent order alerts">
      <div className="admin-alerts-panel-heading">
        <div><strong>Order alerts</strong><span>{alerts.unreadCount} unread</span></div>
        {alerts.unreadCount > 0 && <button type="button" className="text-link" onClick={() => void markAllRead()} disabled={busy}>Mark all read</button>}
      </div>
      {alerts.items.length === 0 ? <p className="admin-alerts-empty">No recent order alerts.</p> : <ul className="admin-alerts-list">
        {alerts.items.map((alert) => <li key={alert.id}>
          <button type="button" className={`admin-alert-item${alert.isRead ? " is-read" : " is-unread"}`} onClick={() => void openOrder(alert)} disabled={busy}>
            <span className="admin-alert-title">{alert.title}</span>
            <span>{alert.description}</span>
            <span className="admin-alert-meta">{alert.eventType === "NEW_ORDER" && <strong>{alert.total}</strong>}<time dateTime={alert.createdAt}>{relativeTime(alert.createdAt)}</time></span>
          </button>
        </li>)}
      </ul>}
      <p className="admin-alerts-retention">Showing order alerts from the last 90 days.</p>
    </section>}
  </div>;
}
