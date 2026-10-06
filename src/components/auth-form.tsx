"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { customerSignupFormSchema } from "@/lib/auth-validation";

export function AuthForm({ mode, googleEnabled }: { mode: "login" | "register"; googleEnabled: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const parsed = customerSignupFormSchema.safeParse({
      name: data.get("name"),
      email: data.get("email"),
      password: data.get("password"),
      passwordConfirmation: data.get("passwordConfirmation"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your registration details.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json() as { error?: string; success?: boolean };
      if (!response.ok || !result.success) {
        setError(result.error ?? "We could not create your account. Please try again.");
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setError("We could not create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin(formData: FormData) {
    setError("");
    setBusy(true);
    try {
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError("Unable to sign in with those details.");
        return;
      }
      const role = result.data?.user?.role;
      if (!role) {
        setError("Unable to sign in with those details.");
        return;
      }
      router.push(role === "ADMIN" ? "/admin" : "/account");
      router.refresh();
    } catch {
      setError("Unable to sign in with those details.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!googleEnabled || busy) return;
    setError("");
    setBusy(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/auth/continue" });
      if (result.error) setError("Google sign-in could not be started. Please try again.");
    } catch {
      setError("Google sign-in could not be started. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const googleButton = <button className="button button-outline" type="button" onClick={() => void signInWithGoogle()} disabled={!googleEnabled || busy}>
    {googleEnabled ? "Continue with Google" : "Google sign-in is not configured"}
  </button>;

  if (mode === "register") {
    return <>
      <form className="auth-form" onSubmit={submitRegistration}>
        <label>Name<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label>
        <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <label>Confirm Password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create Account"}</button>
      </form>
      <div className="auth-form">{googleButton}</div>
    </>;
  }

  return <>
    <form action={submitLogin} className="auth-form">
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Please wait…" : "Sign In"}</button>
    </form>
    <div className="auth-form">{googleButton}</div>
  </>;
}
