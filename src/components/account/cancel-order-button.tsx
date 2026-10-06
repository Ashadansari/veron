"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelCustomerOrder } from "@/app/actions/customer";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <div className="mt-6">
    <button type="button" className="button button-outline" disabled={pending} onClick={() => {
      if (!window.confirm("Cancel this unpaid order? Its stock will be returned to inventory.")) return;
      startTransition(async () => {
        try { await cancelCustomerOrder(orderId); setMessage("Order cancelled and stock returned."); router.refresh(); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Order could not be cancelled."); }
      });
    }}>{pending ? "Cancelling…" : "Cancel order"}</button>
    {message && <p className="form-status" role="status">{message}</p>}
  </div>;
}
