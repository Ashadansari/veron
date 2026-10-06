"use client";

import { useState, type FormEvent } from "react";

export function VerificationResend({ email: initialEmail = "", onChangeEmail }: {
  email?: string;
  onChangeEmail?: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          callbackURL: `${window.location.origin}/auth/verified`,
        }),
      });
      if (!response.ok) {
        setError("We could not send a verification email. Please try again later.");
        return;
      }
      setMessage("If the address belongs to an unverified account, a new link has been sent.");
    } catch {
      setError("We could not send a verification email. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={resend}>
    {initialEmail ? <p>Verification email: <strong>{initialEmail}</strong></p> : <label>Email<input
      name="email"
      type="email"
      autoComplete="email"
      value={email}
      onChange={(event) => setEmail(event.target.value)}
      maxLength={254}
      required
    /></label>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="button button-dark" type="submit" disabled={busy}>
      {busy ? "Sending…" : "Resend verification email"}
    </button>
    {onChangeEmail && <button className="button button-outline" type="button" onClick={onChangeEmail}>Use a different email</button>}
  </form>;
}
