import Link from "next/link";

export function AdminPlaceholder({ title, description }: { title: string; description: string }) {
  return <div className="admin-content">
    <p className="eyebrow">STORE OPERATIONS</p><h1>{title}</h1>
    <section className="admin-panel admin-empty"><h2>This section is not active yet</h2><p>{description}</p><Link className="text-link" href="/admin">Return to dashboard</Link></section>
  </div>;
}
