import { notFound, redirect } from "next/navigation";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { AuthorizationError, assertRole, getCurrentSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentSession();
  if (!current) redirect("/login?next=/admin");
  try { assertRole(current.user.role, "ADMIN"); }
  catch (error) {
    if (error instanceof AuthorizationError && error.status === 403) notFound();
    throw error;
  }
  return <div className="admin-app">
    <AdminNavigation name={current.user.name} email={current.user.email} />
    <main className="admin-main">{children}</main>
  </div>;
}
