import type { Metadata } from "next";
import { DeleteAccountForm, PasswordForm } from "@/components/account-actions";

export const metadata: Metadata = { title: "Account settings | VÉRON" };

export default function AccountSettingsPage() {
  return <main className="grid max-w-4xl gap-10">
    <section><p className="eyebrow">SECURITY</p><h2 className="mb-5 text-2xl font-medium">Change password</h2><PasswordForm /></section>
    <section className="border-t border-ink/15 pt-8"><p className="eyebrow">ACCOUNT</p><h2 className="mb-3 text-2xl font-medium">Delete account</h2><p className="mb-5 max-w-2xl text-sm text-ink/70">We remove your credentials and saved personal information. Historical orders remain for business records and their delivery details are anonymized.</p><DeleteAccountForm /></section>
  </main>;
}
