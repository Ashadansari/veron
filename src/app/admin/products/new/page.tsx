import Link from "next/link";
import { asc } from "drizzle-orm";
import { ProductForm } from "@/components/admin/admin-forms";
import { getDatabase } from "@/db";
import { categories } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function NewAdminProductPage() {
  const categoryRows = await getDatabase().select().from(categories).orderBy(asc(categories.name));
  return <div className="admin-content admin-narrow">
    <p className="eyebrow">CATALOG</p><Link className="text-link" href="/admin/products">← Products</Link><h1>New product</h1>
    <p className="admin-muted">Set the product details and base price. Add purchasable size/color variants after saving.</p>
    <ProductForm categories={categoryRows} />
  </div>;
}
