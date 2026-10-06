import { asc, ilike, or } from "drizzle-orm";
import { CategoryActiveForm, CategoryForm, ColorForm, SizeForm } from "@/components/admin/admin-forms";
import { getDatabase } from "@/db";
import { categories, colors, sizes } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ category?: string; size?: string; color?: string }> }) {
  const params = await searchParams;
  const db = getDatabase();
  const categoryQuery = params.category?.trim().slice(0, 100) ?? "";
  const sizeQuery = params.size?.trim().slice(0, 40) ?? "";
  const colorQuery = params.color?.trim().slice(0, 60) ?? "";
  const [categoryRows, sizeRows, colorRows] = await Promise.all([
    db.select().from(categories).where(categoryQuery ? or(ilike(categories.name, `%${categoryQuery}%`), ilike(categories.slug, `%${categoryQuery}%`)) : undefined).orderBy(asc(categories.name)).limit(100),
    db.select().from(sizes).where(sizeQuery ? ilike(sizes.label, `%${sizeQuery}%`) : undefined).orderBy(asc(sizes.sortOrder)).limit(100),
    db.select().from(colors).where(colorQuery ? ilike(colors.name, `%${colorQuery}%`) : undefined).orderBy(asc(colors.name)).limit(100),
  ]);
  return <div className="admin-content">
    <div className="admin-page-heading"><div><p className="eyebrow">CATALOG</p><h1>Categories</h1><p className="admin-muted">Manage product groupings and the size/color options used by variants.</p></div></div>
    <section className="admin-panel"><h2>Create category</h2><CategoryForm /></section>
    <section className="admin-panel"><h2>Existing categories</h2><form method="get" className="admin-filter-bar"><label>Search categories<input name="category" defaultValue={params.category} placeholder="Category name or slug" maxLength={100} /></label><button className="button button-outline">Search</button></form>{categoryRows.length === 0 ? <div className="admin-empty"><p>No matching categories.</p></div> : <div className="admin-record-grid">{categoryRows.map((category) => <article className="admin-record-card" key={category.id}><div className="admin-record-meta"><span className={category.active ? "admin-status is-active" : "admin-status"}>{category.active ? "Active" : "Inactive"}</span><CategoryActiveForm category={category} /></div><CategoryForm category={category} /></article>)}</div>}</section>
    <div className="admin-columns">
      <section className="admin-panel"><h2>Sizes</h2><SizeForm /><form method="get" className="admin-filter-bar"><label>Search sizes<input name="size" defaultValue={params.size} placeholder="XS, M, 3XL, 42" maxLength={40} /></label><button className="button button-outline">Search</button></form>{sizeRows.length > 0 && <div className="admin-option-list">{sizeRows.map((size) => <SizeForm key={size.id} size={size} />)}</div>}{sizeRows.length === 0 && <p className="admin-muted">No matching sizes.</p>}</section>
      <section className="admin-panel"><h2>Colors</h2><ColorForm /><form method="get" className="admin-filter-bar"><label>Search colors<input name="color" defaultValue={params.color} placeholder="White, Navy Blue, Wine" maxLength={60} /></label><button className="button button-outline">Search</button></form>{colorRows.length > 0 && <div className="admin-option-list">{colorRows.map((color) => <ColorForm key={color.id} color={color} />)}</div>}{colorRows.length === 0 && <p className="admin-muted">No matching colors.</p>}</section>
    </div>
  </div>;
}
