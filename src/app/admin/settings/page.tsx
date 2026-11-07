import { getDatabase } from "@/db";
import { storeSettings } from "@/db/schema";
import { StoreSettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [saved] = await getDatabase().select().from(storeSettings).limit(1);
  const settings = saved ?? {
    storeName: "VÉRON", contactEmail: null, contactPhone: null,
    shippingChargePaisa: 0n, freeShippingThresholdPaisa: null, codEnabled: true, storeActive: true,
  };
  return <div className="admin-content">
    <div className="admin-page-heading"><div><p className="eyebrow">STORE OPERATIONS</p><h1>Settings</h1><p className="admin-muted">Manage store contact, default Nepal delivery fees, and checkout availability.</p></div></div>
    <section className="admin-panel">
      <h2>Store and delivery defaults</h2>
      <p className="admin-muted">Amounts are stored as integer paisa. NPR is fixed for this Nepal storefront.</p>
      <StoreSettingsForm settings={{ ...settings, shippingChargePaisa: BigInt(settings.shippingChargePaisa), freeShippingThresholdPaisa: settings.freeShippingThresholdPaisa === null ? null : BigInt(settings.freeShippingThresholdPaisa) }} />
    </section>
  </div>;
}
