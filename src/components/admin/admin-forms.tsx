"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  removeImageAdminAction,
  saveCategoryAdminAction,
  saveColorAdminAction,
  saveImageAdminAction,
  saveProductAdminAction,
  saveSizeAdminAction,
  saveVariantAdminAction,
  setCategoryActiveAdminAction,
  setProductActiveAdminAction,
  updateInventoryAdminAction,
  uploadProductImageAdminAction,
} from "@/app/actions/admin";
import { idleAdminAction, type AdminActionResult } from "@/lib/admin/action-result";

type CategoryOption = { id: string; name: string; slug: string; description: string | null; active: boolean };
type SizeOption = { id: string; label: string; active: boolean };
type ColorOption = { id: string; name: string; hex: string | null; active: boolean };
type ProductValue = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  sku: string | null;
  basePricePaisa: bigint;
  compareAtPricePaisa: bigint | null;
  active: boolean;
};
type VariantValue = {
  id: string;
  sizeId: string | null;
  colorId: string | null;
  sku: string;
  pricePaisa: bigint;
  salePricePaisa: bigint | null;
  active: boolean;
  stock: number;
};
type ImageValue = { id: string; url: string; altText: string; sortOrder: number; isPrimary: boolean };

function Feedback({ state }: { state: AdminActionResult }) {
  if (!state.message) return null;
  return <p className={state.status === "error" ? "admin-message admin-error" : "admin-message admin-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}

export function ProductForm({ product, categories }: { product?: ProductValue; categories: CategoryOption[] }) {
  const router = useRouter();
  const [categoryQuery, setCategoryQuery] = useState("");
  const filteredCategories = categories.filter((category) =>
    (category.active || category.id === product?.categoryId)
    && (category.id === product?.categoryId || !categoryQuery || category.name.toLowerCase().includes(categoryQuery.toLowerCase()) || category.slug.includes(categoryQuery.toLowerCase())),
  );
  const [state, action, pending] = useActionState(saveProductAdminAction, idleAdminAction);
  useEffect(() => {
    if (state.status !== "success" || !state.resourceId) return;
    router.replace(`/admin/products/${state.resourceId}/edit`);
    router.refresh();
  }, [router, state]);

  return <form action={action} className="admin-form">
    {product && <input type="hidden" name="id" value={product.id} />}
    <div className="admin-form-grid">
      <label>Product name<input name="name" defaultValue={product?.name} required minLength={2} maxLength={180} /></label>
      <label>URL slug<input name="slug" defaultValue={product?.slug} placeholder="e.g. linen-everyday-shirt" required maxLength={200} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
      <label>Find category<input type="search" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Search categories" /></label>
      <label>Category<select key={`${product?.id ?? "new"}:${product?.categoryId ?? ""}`} name="categoryId" defaultValue={product?.categoryId ?? ""}><option value="">Uncategorized</option>{filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active ? "" : " (inactive)"}</option>)}</select></label>
      <label>Product SKU (optional)<input name="sku" defaultValue={product?.sku ?? ""} maxLength={80} /></label>
      <label>Current price (NPR)<input name="priceNpr" type="number" min="0" step="0.01" defaultValue={product ? paisaToNpr(product.basePricePaisa) : "0.00"} required /></label>
      <label>Original price (NPR, optional)<input name="compareAtPriceNpr" type="number" min="0" step="0.01" defaultValue={product?.compareAtPricePaisa ? paisaToNpr(product.compareAtPricePaisa) : ""} /></label>
    </div>
    <label>Description<textarea name="description" defaultValue={product?.description} rows={6} maxLength={12000} /></label>
    <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={product?.active ?? false} /> Product is active and visible in the shop</label>
    <Feedback state={state} />
    <button className="button button-dark" disabled={pending}>{pending ? "Saving…" : product ? "Save product" : "Create product"}</button>
  </form>;
}

export function ProductArchiveForm({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setProductActiveAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-inline-form" onSubmit={(event) => {
    if (active && !window.confirm("Archive this product? Existing order records will remain unchanged.")) event.preventDefault();
  }}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!active)} />
    <button className="button button-outline" disabled={pending}>{pending ? "Saving…" : active ? "Archive" : "Reactivate"}</button><Feedback state={state} />
  </form>;
}

export function CategoryForm({ category }: { category?: CategoryOption }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveCategoryAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-form admin-form-compact">
    {category && <input type="hidden" name="id" value={category.id} />}
    <h3>{category ? "Edit category" : "New category"}</h3>
    <label>Name<input name="name" defaultValue={category?.name} required minLength={2} maxLength={100} /></label>
    <label>Slug<input name="slug" defaultValue={category?.slug} required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
    <label>Description<textarea name="description" defaultValue={category?.description ?? ""} maxLength={1000} rows={3} /></label>
    <label className="admin-checkbox"><input type="checkbox" name="active" defaultChecked={category?.active ?? true} /> Active</label>
    <Feedback state={state} /><button className="button button-dark" disabled={pending}>{pending ? "Saving…" : "Save category"}</button>
  </form>;
}

export function CategoryActiveForm({ category }: { category: CategoryOption }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setCategoryActiveAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-inline-form" onSubmit={(event) => {
    if (category.active && !window.confirm("Deactivate this category? Its products will be hidden until you reactivate it.")) event.preventDefault();
  }}>
    <input type="hidden" name="id" value={category.id} /><input type="hidden" name="active" value={String(!category.active)} />
    <button className="button button-outline" disabled={pending}>{category.active ? "Deactivate" : "Reactivate"}</button><Feedback state={state} />
  </form>;
}

export function VariantForm({ productId, sizes, colors, variant }: { productId: string; sizes: SizeOption[]; colors: ColorOption[]; variant?: VariantValue }) {
  const router = useRouter();
  const [sizeQuery, setSizeQuery] = useState("");
  const [colorQuery, setColorQuery] = useState("");
  const availableSizes = sizes.filter((size) => (size.active || size.id === variant?.sizeId) && (size.id === variant?.sizeId || size.label.toLowerCase().includes(sizeQuery.toLowerCase())));
  const availableColors = colors.filter((color) => (color.active || color.id === variant?.colorId) && (color.id === variant?.colorId || color.name.toLowerCase().includes(colorQuery.toLowerCase())));
  const [state, action, pending] = useActionState(saveVariantAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-form admin-form-compact">
    <input type="hidden" name="productId" value={productId} />{variant && <input type="hidden" name="id" value={variant.id} />}
    <h3>{variant ? `Edit ${variant.sku}` : "Add variant"}</h3>
    <div className="admin-form-grid">
      <label>Find size<input type="search" value={sizeQuery} onChange={(event) => setSizeQuery(event.target.value)} placeholder="XS, M, 3XL, 42" /></label>
      <label>Size<select name="sizeId" defaultValue={variant?.sizeId ?? ""}><option value="">One size</option>{availableSizes.map((size) => <option key={size.id} value={size.id}>{size.label}{size.active ? "" : " (inactive)"}</option>)}</select></label>
      <label>Find color<input type="search" value={colorQuery} onChange={(event) => setColorQuery(event.target.value)} placeholder="White, Navy Blue, Wine" /></label>
      <label>Color<select name="colorId" defaultValue={variant?.colorId ?? ""}><option value="">Default color</option>{availableColors.map((color) => <option key={color.id} value={color.id}>{color.name}{color.active ? "" : " (inactive)"}</option>)}</select></label>
      <label>Variant SKU<input name="sku" defaultValue={variant?.sku} required minLength={2} maxLength={80} /></label>
      <label>Regular price (NPR)<input name="priceNpr" type="number" min="0" step="0.01" defaultValue={variant ? paisaToNpr(variant.pricePaisa) : "0.00"} required /></label>
      <label>Sale price (optional)<input name="salePriceNpr" type="number" min="0" step="0.01" defaultValue={variant?.salePricePaisa ? paisaToNpr(variant.salePricePaisa) : ""} /></label>
      {!variant && <label>Initial stock<input name="initialStock" type="number" min="0" max="100000" step="1" defaultValue="0" required /></label>}
    </div>
    <label className="admin-checkbox"><input type="checkbox" name="active" defaultChecked={variant?.active ?? true} /> Variant is active</label>
    {variant && <p className="admin-muted">Stock on hand: {variant.stock}. Adjust stock on the Inventory page.</p>}
    <Feedback state={state} /><button className="button button-dark" disabled={pending}>{pending ? "Saving…" : "Save variant"}</button>
  </form>;
}

export function ImageForm({ productId, image }: { productId: string; image?: ImageValue }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveImageAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-form admin-form-compact">
    <input type="hidden" name="productId" value={productId} />{image && <input type="hidden" name="id" value={image.id} />}
    <div className="admin-form-grid">
      <label>HTTPS image URL<input name="url" type="url" defaultValue={image?.url} required maxLength={2048} placeholder="https://…" /></label>
      <label>Alt text<input name="altText" defaultValue={image?.altText} required minLength={2} maxLength={240} /></label>
      <label>Display order<input name="sortOrder" type="number" defaultValue={image?.sortOrder ?? 0} min="0" max="10000" step="1" required /></label>
    </div>
    <label className="admin-checkbox"><input name="isPrimary" type="checkbox" defaultChecked={image?.isPrimary ?? false} /> Primary image</label>
    <Feedback state={state} /><button className="button button-outline" disabled={pending}>{pending ? "Saving…" : image ? "Save image" : "Add image"}</button>
  </form>;
}

export function ProductImageUploadForm({ productId }: { productId: string }) {
  const router = useRouter();
  const previewUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState("");
  const [state, action, pending] = useActionState(uploadProductImageAdminAction, idleAdminAction);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
  }, [router, state]);

  return <form action={action} className="admin-form admin-form-compact admin-image-upload-form">
    <input type="hidden" name="productId" value={productId} />
    <h3>Upload image from device</h3>
    <label>Image file<input
      name="file"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      required
      onChange={(event) => {
        const selected = event.currentTarget.files?.[0] ?? null;
        setFile(selected);
        setClientError("");
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = selected && ["image/jpeg", "image/png", "image/webp"].includes(selected.type)
          ? URL.createObjectURL(selected)
          : null;
        setPreviewUrl(previewUrlRef.current);
        if (selected && !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
          setClientError("Choose a JPEG, PNG, or WebP image.");
        } else if (selected && selected.size > 5 * 1024 * 1024) {
          setClientError("Image must be 5 MB or smaller.");
        }
      }}
    /></label>
    {file && <p className="admin-muted" aria-live="polite">Selected: {file.name}</p>}
    {previewUrl && <div className="admin-image-upload-preview"><Image src={previewUrl} alt="Selected image preview" fill unoptimized sizes="240px" /></div>}
    <div className="admin-form-grid">
      <label>Alt text<input name="altText" required minLength={2} maxLength={240} /></label>
      <label>Display order<input name="sortOrder" type="number" defaultValue="0" min="0" max="10000" step="1" required /></label>
    </div>
    <label className="admin-checkbox"><input name="isPrimary" type="checkbox" /> Primary image</label>
    {clientError && <p className="admin-message admin-error" role="alert">{clientError}</p>}
    <Feedback state={state} />
    <button className="button button-outline" disabled={pending || Boolean(clientError)}>{pending ? "Uploading…" : "Upload image"}</button>
  </form>;
}

export function RemoveImageForm({ id }: { id: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(removeImageAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Remove this image record from the product?")) event.preventDefault(); }}>
    <input type="hidden" name="id" value={id} /><button className="text-link" disabled={pending}>{pending ? "Removing…" : "Remove image"}</button><Feedback state={state} />
  </form>;
}

export function InventoryForm({ variantId, onHand }: { variantId: string; onHand: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateInventoryAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-inline-form">
    <input type="hidden" name="variantId" value={variantId} /><label className="admin-stock-input">On hand<input name="onHand" type="number" min="0" max="100000" step="1" defaultValue={onHand} required /></label>
    <button className="button button-outline" disabled={pending}>{pending ? "Saving…" : "Update"}</button><Feedback state={state} />
  </form>;
}

export function SizeForm({ size }: { size?: { id: string; label: string; sortOrder: number; active: boolean } }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveSizeAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-inline-form">
    {size && <input type="hidden" name="id" value={size.id} />}<label>Size<input name="label" defaultValue={size?.label} required maxLength={40} /></label>
    <label>Order<input name="sortOrder" type="number" min="0" max="10000" defaultValue={size?.sortOrder ?? 0} /></label>
    <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={size?.active ?? true} /> Active</label>
    <button className="button button-outline" disabled={pending}>{pending ? "Saving…" : "Save size"}</button><Feedback state={state} />
  </form>;
}

export function ColorForm({ color }: { color?: ColorOption }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveColorAdminAction, idleAdminAction);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state]);
  return <form action={action} className="admin-inline-form">
    {color && <input type="hidden" name="id" value={color.id} />}<label>Color<input name="name" defaultValue={color?.name} required maxLength={60} /></label>
    <label>Hex<input name="hex" defaultValue={color?.hex ?? ""} pattern="#[0-9a-fA-F]{6}" placeholder="#000000" /></label>
    <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={color?.active ?? true} /> Active</label>
    <button className="button button-outline" disabled={pending}>{pending ? "Saving…" : "Save color"}</button><Feedback state={state} />
  </form>;
}

function paisaToNpr(value: bigint) {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}
