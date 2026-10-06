import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { isGoogleOAuthConfigured } from "@/lib/auth/google-oauth";

export default function LoginPage() {
  return <main className="account-shell"><p className="eyebrow">WELCOME BACK</p><h1>Sign in to your account</h1><AuthForm mode="login" googleEnabled={isGoogleOAuthConfigured()} /><p>New to Naj Fancy Store? <Link href="/register">Create an account</Link></p></main>;
}
