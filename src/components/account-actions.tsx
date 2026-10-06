"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { changePassword, deleteCustomerAccount, removeAddress, saveAddress, updateProfile } from "@/app/actions/customer";

type AddressValue = {
  id: string;
  fullName: string;
  phoneNumber: string;
  province: string;
  district: string;
  municipality: string;
  wardNumber: number;
  toleArea: string;
  streetAddress: string;
  postalCode: string | null;
  isDefault: boolean;
};

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  return <div>
    <button className="text-link" onClick={async () => {
      setError("");
      const result = await authClient.signOut();
      if (result.error) { setError("Could not sign out. Please try again."); return; }
      router.replace("/");
      router.refresh();
    }}>Log out</button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [message, setMessage] = useState("");
  return <form className="auth-form" action={async (data) => {
    setMessage("");
    try {
      await updateProfile({ name: String(data.get("name") ?? ""), phone: String(data.get("phone") ?? "") });
      setMessage("Profile saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save profile."); }
  }}>
    <label>Name<input name="name" defaultValue={name} autoComplete="name" required minLength={2} maxLength={120} /></label>
    <label>Nepal phone number<input name="phone" type="tel" defaultValue={phone} autoComplete="tel" required /></label>
    <button className="button button-dark">Save profile</button>
    {message && <p role="status">{message}</p>}
    <p className="border-t border-ink/15 pt-5 text-sm text-ink/70">Email contact: {email}</p>
  </form>;
}

export function AddressForm({ address }: { address?: AddressValue }) {
  const [message, setMessage] = useState("");
  return <form className="auth-form" action={async (data) => {
    setMessage("");
    try { await saveAddress(data); setMessage("Address saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this address."); }
  }}>
    {address && <input type="hidden" name="addressId" value={address.id} />}
    <label>Full name<input name="fullName" defaultValue={address?.fullName} autoComplete="name" required minLength={2} maxLength={140} /></label>
    <label>Phone number<input name="phoneNumber" type="tel" defaultValue={address?.phoneNumber} autoComplete="tel" required /></label>
    <label>Province<select name="province" defaultValue={address?.province ?? ""} required><option value="" disabled>Select a province</option>{["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"].map((province) => <option key={province}>{province}</option>)}</select></label>
    <label>District<input name="district" defaultValue={address?.district} required minLength={2} maxLength={80} /></label>
    <label>Municipality / Rural Municipality<input name="municipality" defaultValue={address?.municipality} required minLength={2} maxLength={120} /></label>
    <label>Ward number<input name="wardNumber" type="number" min={1} max={35} defaultValue={address?.wardNumber} required /></label>
    <label>Tole / Area<input name="toleArea" defaultValue={address?.toleArea} required minLength={2} maxLength={120} /></label>
    <label>Street / Address<input name="streetAddress" defaultValue={address?.streetAddress} autoComplete="street-address" required minLength={2} maxLength={240} /></label>
    <label>Postal code (optional)<input name="postalCode" defaultValue={address?.postalCode ?? ""} maxLength={15} autoComplete="postal-code" /></label>
    <label className="flex items-center gap-2"><input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} /> Make this my default address</label>
    <button className="button button-dark">{address ? "Save address" : "Add address"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}

export function DeleteAddressButton({ addressId }: { addressId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return <div>
    <button type="button" className="text-link" onClick={async () => {
      if (!window.confirm("Delete this saved address?")) return;
      setError("");
      try { await removeAddress(addressId); router.refresh(); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this address."); }
    }}>Delete address</button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}

export function PasswordForm() {
  const [message, setMessage] = useState("");
  return <form className="auth-form" action={async (data) => {
    setMessage("");
    try {
      await changePassword({ currentPassword: String(data.get("currentPassword") ?? ""), newPassword: String(data.get("newPassword") ?? "") });
      setMessage("Password updated. Other sessions were signed out.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update the password."); }
  }}>
    <label>Current password<input type="password" name="currentPassword" autoComplete="current-password" required /></label>
    <label>New password<input type="password" name="newPassword" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    <p>Use at least 12 characters, including a letter and a number.</p>
    <button className="button button-dark">Change password</button>
    {message && <p role="status">{message}</p>}
  </form>;
}

export function DeleteAccountForm() {
  const messageRouter = useRouter();
  const [message, setMessage] = useState("");
  return <form className="auth-form" action={async (data) => {
    setMessage("");
    try {
      await deleteCustomerAccount({ password: String(data.get("password") ?? ""), confirmation: String(data.get("confirmation") ?? "") });
      messageRouter.replace("/");
      messageRouter.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete the account."); }
  }}>
    <p>Account access and saved addresses will be removed. Historical orders remain, with personal delivery details anonymized.</p>
    <label>Confirm with your password<input type="password" name="password" autoComplete="current-password" required /></label>
    <label>Type DELETE to confirm<input name="confirmation" autoComplete="off" required /></label>
    <button className="button button-dark">Delete my account</button>
    {message && <p role="alert" className="form-error">{message}</p>}
  </form>;
}
