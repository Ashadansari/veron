"use client";

import { useActionState } from "react";
import { updateOrderStatusAdminAction } from "@/app/actions/admin";
import { idleAdminAction } from "@/lib/admin/action-result";

const statuses = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const;

export function OrderStatusForm({ orderId, status }: { orderId: string; status: typeof statuses[number] }) {
  const [result, action, pending] = useActionState(updateOrderStatusAdminAction, idleAdminAction);
  return <form action={action} className="admin-form" onSubmit={(event) => {
    const form = event.currentTarget;
    if (new FormData(form).get("status") === "CANCELLED" && !window.confirm("Cancel this order and restore its stock? A paid order will require a separate refund.")) event.preventDefault();
  }}>
    <input type="hidden" name="orderId" value={orderId} />
    <label>Update status<select name="status" defaultValue={status}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>Note<input name="note" maxLength={1000} /></label>
    {result.message && <p className={result.status === "error" ? "form-error" : "form-status"} role={result.status === "error" ? "alert" : "status"}>{result.message}</p>}
    <button className="button button-dark" disabled={pending}>{pending ? "Saving…" : "Save status"}</button>
  </form>;
}
