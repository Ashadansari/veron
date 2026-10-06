import type { Metadata } from "next";
import { ProfileForm } from "@/components/account-actions";
import { getCurrentSession } from "@/lib/authz";

export const metadata: Metadata = { title: "Profile | NajFancyStore" };
export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const current = await getCurrentSession();
  if (!current) return null;
  return <main className="max-w-xl">
    <p className="eyebrow">YOUR DETAILS</p><h2 className="mb-2 text-2xl font-medium">Profile</h2>
    <p className="mb-6 text-ink/70">Update contact details using the secure forms below.</p>
    <ProfileForm name={current.user.name} phone={current.user.phone ?? ""} email={current.user.email} />
  </main>;
}
