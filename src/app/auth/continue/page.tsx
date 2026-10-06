import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/authz";

export default async function AuthContinuePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  redirect(session.user.role === "ADMIN" ? "/admin" : "/account");
}
