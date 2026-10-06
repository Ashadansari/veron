import { NextResponse } from "next/server";
import { z } from "zod";
import { sampleProducts } from "@/lib/catalog/sample-data";
import { resolveCartLookupEntries, type CartLookup } from "@/lib/catalog/repository";

const entrySchema = z.union([
  z.object({ productSlug: z.string().min(1).max(200), variantSku: z.string().min(1).max(80), quantity: z.number().int().min(1).max(20) }),
  z.object({ productId: z.string().min(1).max(80), variantId: z.string().min(1).max(80), quantity: z.number().int().min(1).max(20) }),
]);
const payloadSchema = z.object({ entries: z.array(entrySchema).max(50) });

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart entries." }, { status: 400 });

  const entries: CartLookup[] = [];
  for (const entry of parsed.data.entries) {
    if ("productSlug" in entry) {
      entries.push(entry);
      continue;
    }
    // Convert Phase 2's stored mock identifiers without trusting its price or stock fields.
    const product = sampleProducts.find((candidate) => candidate.id === entry.productId);
    const variant = product?.variants.find((candidate) => candidate.id === entry.variantId);
    if (product && variant) entries.push({ productSlug: product.slug, variantSku: variant.sku ?? variant.id, quantity: entry.quantity });
  }

  try {
    const resolved = await resolveCartLookupEntries(entries);
    return NextResponse.json(resolved, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Catalog data is temporarily unavailable." }, { status: 503 });
  }
}
