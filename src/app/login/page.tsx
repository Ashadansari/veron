import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";
import { isGoogleOAuthConfigured } from "@/lib/auth/google-oauth";

export default function LoginPage() {
  return <main className="account-shell auth-page"><BrandLogo className="auth-brand-logo" /><p className="eyebrow">WELCOME BACK</p><h1>Sign in to your account</h1><AuthForm mode="login" googleEnabled={isGoogleOAuthConfigured()} /><p>New to VÉRON? <Link href="/register">Create an account</Link></p></main>;
}
