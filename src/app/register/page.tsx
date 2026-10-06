import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { isGoogleOAuthConfigured } from "@/lib/auth/google-oauth";

export default function RegisterPage() {
  return <main className="account-shell"><p className="eyebrow">JOIN THE STORE</p><h1>Create your account</h1><AuthForm mode="register" googleEnabled={isGoogleOAuthConfigured()} /><p>Already have an account? <Link href="/login">Sign in</Link></p></main>;
}
