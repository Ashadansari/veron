"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "@/db";
import { products } from "@/db/schema";
import type { AdminActionResult } from "@/lib/admin/action-result";
import {
  removeAdminImage,
  saveAdminCategory,
  saveAdminColor,
  saveAdminImage,
  saveAdminUploadedImage,
  saveAdminProduct,
  saveAdminSize,
  saveAdminVariant,
  setAdminCategoryActive,
  setAdminProductActive,
  updateAdminInventory,
} from "@/lib/admin/catalog-service";
import { requireAdmin } from "@/lib/authz";
import { updateAdminOrderStatus } from "@/lib/commerce/order-management";
import { saveAdminStoreSettings } from "@/lib/admin/settings-service";
import { removeNewProductImage, removeOwnedProductImageUrl, storeProductImage, validateProductImage } from "@/lib/admin/product-image-upload";
import { deactivateAdminCustomer } from "@/lib/admin/customer-service";

const field = (data: FormData, name: string) => String(data.get(name) ?? "");
const checkbox = (data: FormData, name: string) => data.get(name) === "on";
const number = (data: FormData, name: string) => Number(data.get(name) ?? "");
const actor = async () => ({ userId: (await requireAdmin()).userId, role: "ADMIN" });
const refreshCatalog = () => {
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/admin/products/[id]/edit", "page");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/inventory");
  revalidatePath("/shop");
  revalidatePath("/shop/[slug]", "page");
  revalidatePath("/products/[slug]", "page");
};

async function perform(operation: () => Promise<string | void>, success: string): Promise<AdminActionResult> {
  try {
    const resourceId = await operation();
    refreshCatalog();
    return { status: "success", message: success, ...(typeof resourceId === "string" ? { resourceId } : {}) };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return { status: "error", message: "A record with that slug, SKU, name, or variant combination already exists." };
    }
    return { status: "error", message: error instanceof Error ? error.message : "The change could not be saved." };
  }
}

export async function saveProductAdminAction(_previous: AdminActionResult, data: FormData) {
  return perform(async () => saveAdminProduct(await actor(), {
    id: field(data, "id") || undefined,
    name: field(data, "name"),
    slug: field(data, "slug"),
    description: field(data, "description"),
    categoryId: field(data, "categoryId"),
    sku: field(data, "sku"),
    priceNpr: field(data, "priceNpr"),
    compareAtPriceNpr: field(data, "compareAtPriceNpr"),
    active: checkbox(data, "active"),
  }), "Product saved.");
}

export async function setProductActiveAdminAction(_previous: AdminActionResult, data: FormData) {
  const active = field(data, "active") === "true";
  return perform(async () => setAdminProductActive(await actor(), field(data, "id"), active), active ? "Product reactivated." : "Product archived.");
}

export async function saveCategoryAdminAction(_previous: AdminActionResult, data: FormData) {
  return perform(async () => saveAdminCategory(await actor(), {
    id: field(data, "id") || undefined,
    name: field(data, "name"),
    slug: field(data, "slug"),
    description: field(data, "description"),
    active: checkbox(data, "active"),
  }), "Category saved.");
}

export async function setCategoryActiveAdminAction(_previous: AdminActionResult, data: FormData) {
  const active = field(data, "active") === "true";
  return perform(async () => setAdminCategoryActive(await actor(), field(data, "id"), active), active ? "Category reactivated." : "Category deactivated.");
}

export async function saveVariantAdminAction(_previous: AdminActionResult, data: FormData) {
  return perform(async () => {
    await saveAdminVariant(await actor(), {
      id: field(data, "id") || undefined,
      productId: field(data, "productId"),
      sizeId: field(data, "sizeId"),
      colorId: field(data, "colorId"),
      sku: field(data, "sku"),
      priceNpr: field(data, "priceNpr"),
      salePriceNpr: field(data, "salePriceNpr"),
      active: checkbox(data, "active"),
      initialStock: field(data, "id") ? undefined : number(data, "initialStock"),
    });
  }, "Variant saved.");
}

export async function saveImageAdminAction(_previous: AdminActionResult, data: FormData) {
  return perform(async () => saveAdminImage(await actor(), {
    id: field(data, "id") || undefined,
    productId: field(data, "productId"),
    url: field(data, "url"),
    altText: field(data, "altText"),
    sortOrder: number(data, "sortOrder"),
    isPrimary: checkbox(data, "isPrimary"),
  }), "Image details saved.");
}

export async function uploadProductImageAdminAction(_previous: AdminActionResult, data: FormData): Promise<AdminActionResult> {
  return perform(async () => {
    const admin = await actor();
    if (process.env.NODE_ENV === "production") throw new Error("Device uploads are enabled only in local and staging environments.");

    const parsedProductId = z.string().uuid().safeParse(field(data, "productId"));
    if (!parsedProductId.success) throw new Error("Product not found.");
    const [product] = await getDatabase().select({ id: products.id }).from(products).where(eq(products.id, parsedProductId.data)).limit(1);
    if (!product) throw new Error("Product not found.");

    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose an image to upload.");
    const fields = z.object({
      altText: z.string().trim().min(2, "Alt text must be at least 2 characters.").max(240),
      sortOrder: z.number().int().min(0).max(10000),
      isPrimary: z.boolean(),
    }).safeParse({
      altText: field(data, "altText"),
      sortOrder: number(data, "sortOrder"),
      isPrimary: checkbox(data, "isPrimary"),
    });
    if (!fields.success) throw new Error(fields.error.issues[0]?.message ?? "Image details are invalid.");

    const validated = await validateProductImage(file);
    const stored = await storeProductImage(validated.bytes, validated.extension);
    try {
      await saveAdminUploadedImage(admin, {
        productId: product.id,
        url: stored.url,
        ...fields.data,
      });
    } catch (error) {
      try {
        await removeNewProductImage(stored.filePath);
      } catch {
        throw new Error("The image could not be added to the product and its temporary file could not be cleaned up. Contact support.");
      }
      throw error;
    }
  }, "Product image uploaded.");
}

export async function removeImageAdminAction(_previous: AdminActionResult, data: FormData) {
  return perform(async () => {
    const url = await removeAdminImage(await actor(), field(data, "id"));
    try {
      await removeOwnedProductImageUrl(url);
    } catch {
      throw new Error("The image record was removed, but its local upload could not be cleaned up. Contact support.");
    }
  }, "Image removed.");
}

export async function updateInventoryAdminAction(_previous: AdminActionResult, data: FormData) {
  return perform(async () => updateAdminInventory(await actor(), {
    variantId: field(data, "variantId"),
    onHand: number(data, "onHand"),
  }), "Inventory updated.");
}

export async function saveSizeAdminAction(_previous: AdminActionResult, data: FormData) {
  return perform(async () => saveAdminSize(await actor(), {
    id: field(data, "id") || undefined,
    label: field(data, "label"),
    sortOrder: number(data, "sortOrder"),
    active: checkbox(data, "active"),
  }), "Size option saved.");
}

export async function saveColorAdminAction(_previous: AdminActionResult, data: FormData) {
  return perform(async () => saveAdminColor(await actor(), {
    id: field(data, "id") || undefined,
    name: field(data, "name"),
    hex: field(data, "hex"),
    active: checkbox(data, "active"),
  }), "Color option saved.");
}

export async function saveStoreSettingsAdminAction(_previous: AdminActionResult, data: FormData): Promise<AdminActionResult> {
  return perform(async () => {
    await saveAdminStoreSettings(await actor(), {
      storeName: field(data, "storeName"),
      contactEmail: field(data, "contactEmail"),
      contactPhone: field(data, "contactPhone"),
      shippingChargeNpr: field(data, "shippingChargeNpr"),
      freeShippingThresholdNpr: field(data, "freeShippingThresholdNpr"),
      codEnabled: checkbox(data, "codEnabled"),
      storeActive: checkbox(data, "storeActive"),
    });
  }, "Store settings saved.");
}

export async function updateOrderStatusAdminAction(_previous: AdminActionResult, data: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const input = { orderId: field(data, "orderId"), status: field(data, "status"), note: field(data, "note") };
  try {
    await updateAdminOrderStatus({ userId: admin.userId, role: "ADMIN" }, input);
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${input.orderId}`);
    revalidatePath("/account/orders");
    return { status: "success", message: "Order status updated." };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      return { status: "error", message: "Order status could not be saved due to a database error." };
    }
    return { status: "error", message: error instanceof Error ? error.message : "Order status could not be updated." };
  }
}

export async function deactivateAdminCustomerAction(customerId: string, confirmation: string) {
  const admin = await requireAdmin();
  if (confirmation !== "DELETE") return { status: "error" as const, message: "Confirm customer deactivation before continuing." };
  try {
    await deactivateAdminCustomer({ userId: admin.userId, role: "ADMIN" }, customerId);
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${encodeURIComponent(customerId)}`);
    return { status: "success" as const, message: "Customer account deactivated. Historical order records were preserved." };
  } catch (error) {
    return { status: "error" as const, message: error instanceof Error ? error.message : "Customer account could not be deactivated." };
  }
}
