"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deactivateAdminCustomerAction } from "@/app/actions/admin";

export function AdminCustomerDeactivateButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <div>
    <button type="button" className="button button-outline" disabled={busy} onClick={async () => {
      if (!window.confirm("Deactivate this customer? They will lose login access and saved personal details. Historical orders and payment records will be preserved, with delivery details anonymized.")) return;
      setBusy(true);
      setMessage("");
      try {
        const result = await deactivateAdminCustomerAction(customerId, "DELETE");
        setMessage(result.message);
        if (result.status === "success") router.refresh();
      } catch {
        setMessage("Customer account could not be deactivated.");
      } finally {
        setBusy(false);
      }
    }}>{busy ? "Deactivating…" : "Deactivate customer"}</button>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </div>;
}
