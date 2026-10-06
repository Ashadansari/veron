import Link from "next/link";
import { VerificationResend } from "@/components/auth/verification-resend";

const verificationErrors = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND", "INVALID_USER"]);

export default async function EmailVerifiedPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const verificationFailed = typeof error === "string" && verificationErrors.has(error);

  return <main className="account-shell">
    <p className="eyebrow">EMAIL VERIFICATION</p>
    <h1>{verificationFailed ? "Verification link could not be used" : "Email verification complete"}</h1>
    {verificationFailed
      ? <p role="alert">This link may be invalid, expired, or already used. Request a new verification email below.</p>
      : <p role="status">Your email is verified, or this link has already been used. You can continue to sign in.</p>}
    {verificationFailed && <VerificationResend />}
    <p><Link href="/login">Continue to sign in</Link></p>
  </main>;
}
