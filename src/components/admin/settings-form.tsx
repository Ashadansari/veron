"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveStoreSettingsAdminAction } from "@/app/actions/admin";
import { idleAdminAction, type AdminActionResult } from "@/lib/admin/action-result";

type Settings = {
  storeName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  shippingChargePaisa: bigint;
  freeShippingThresholdPaisa: bigint | null;
  codEnabled: boolean;
  storeActive: boolean;
};

function Feedback({ state }: { state: AdminActionResult }) {
  if (!state.message) return null;
  return <p className={state.status === "error" ? "admin-message admin-error" : "admin-message admin-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}

export function StoreSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveStoreSettingsAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-form">
    <div className="admin-form-grid">
      <label>Store name<input name="storeName" required minLength={2} maxLength={120} defaultValue={settings.storeName} /></label>
      <label>Contact email<input name="contactEmail" type="email" maxLength={254} defaultValue={settings.contactEmail ?? ""} /></label>
      <label>Store phone (Nepal)<input name="contactPhone" type="tel" maxLength={20} placeholder="+977 98XXXXXXXX" defaultValue={settings.contactPhone ?? ""} /></label>
      <label>Currency<input value="NPR · Nepalese Rupee" readOnly aria-readonly="true" /></label>
      <label>Default shipping fee (NPR)<input name="shippingChargeNpr" type="number" min="0" step="0.01" required defaultValue={paisaToInput(settings.shippingChargePaisa)} /></label>
      <label>Free shipping threshold (NPR)<input name="freeShippingThresholdNpr" type="number" min="0" step="0.01" placeholder="Leave blank to disable" defaultValue={settings.freeShippingThresholdPaisa === null ? "" : paisaToInput(settings.freeShippingThresholdPaisa)} /></label>
    </div>
    <p className="admin-muted">Province or district delivery rules, when configured, take precedence over the default fee and threshold.</p>
    <label className="admin-checkbox"><input name="codEnabled" type="checkbox" defaultChecked={settings.codEnabled} /> Cash on Delivery is available</label>
    <label className="admin-checkbox"><input name="storeActive" type="checkbox" defaultChecked={settings.storeActive} /> Store is open for checkout</label>
    <Feedback state={state} />
    <button className="button button-dark" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
  </form>;
}

function paisaToInput(value: bigint) {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}
