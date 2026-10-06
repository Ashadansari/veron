import type { Metadata } from "next";
import { AddressForm, DeleteAddressButton } from "@/components/account-actions";
import { getCustomerAddresses } from "@/lib/commerce/customer-queries";
import { getCurrentSession } from "@/lib/authz";

export const metadata: Metadata = { title: "Your addresses | NajFancyStore" };
export const dynamic = "force-dynamic";

export default async function AccountAddressesPage() {
  const current = await getCurrentSession();
  if (!current) return null;
  const saved = await getCustomerAddresses(current.user.id);
  return <main className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
    <section>
      <p className="eyebrow">DELIVERY</p><h2 className="mb-6 text-2xl font-medium">Your addresses</h2>
      {saved.length ? <div className="grid gap-4">{saved.map((address) => <article className="rounded-xl border border-ink/15 p-5" key={address.id}>
        <div className="flex items-start justify-between gap-3"><div><strong>{address.fullName}</strong>{address.isDefault && <span className="ml-2 text-xs uppercase tracking-wide">Default</span>}
          <p className="mt-2 text-sm text-ink/70">{address.phoneNumber}<br />{address.streetAddress}, {address.toleArea}, Ward {address.wardNumber}<br />{address.municipality}, {address.district}, {address.province}{address.postalCode ? ` ${address.postalCode}` : ""}</p>
        </div><DeleteAddressButton addressId={address.id} /></div>
        <details className="mt-4"><summary className="text-link cursor-pointer">Edit address</summary><div className="mt-4"><AddressForm address={{
          id: address.id,
          fullName: address.fullName,
          phoneNumber: address.phoneNumber,
          province: address.province,
          district: address.district,
          municipality: address.municipality,
          wardNumber: address.wardNumber,
          toleArea: address.toleArea,
          streetAddress: address.streetAddress,
          postalCode: address.postalCode,
          isDefault: address.isDefault,
        }} /></div></details>
      </article>)}</div> : <p className="text-ink/70">You have not saved an address yet.</p>}
    </section>
    <section><p className="eyebrow">NEW DELIVERY ADDRESS</p><h2 className="mb-6 text-2xl font-medium">Add an address</h2><AddressForm /></section>
  </main>;
}
