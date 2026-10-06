"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "@/db";
import { cartItems, carts, inventory, productVariants, products } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { customerPasswordSchema } from "@/lib/auth-validation";
import { requireCustomer } from "@/lib/authz";
import { anonymizeCustomerAccount, deleteCustomerAddress, saveCustomerAddress, saveCustomerProfile } from "@/lib/account-service";

export async function saveAddress(formData: FormData) {
  const customer = await requireCustomer();
  const raw = Object.fromEntries(formData.entries());
  await saveCustomerAddress(customer.userId, {
    ...raw,
    wardNumber: raw.wardNumber,
    isDefault: raw.isDefault === "on",
  });
  revalidatePath("/account/addresses");
}

export async function removeAddress(addressId: string) {
  const customer = await requireCustomer();
  const parsed = z.string().uuid().safeParse(addressId);
  if (!parsed.success) throw new Error("Address not found.");
  await deleteCustomerAddress(customer.userId, parsed.data);
  revalidatePath("/account/addresses");
}

export async function addToCart(input: { variantId: string; quantity: number }) {
  const customer = await requireCustomer();
  const parsed = z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(20) }).safeParse(input);
  if (!parsed.success) throw new Error("Choose a valid product quantity.");
  const db = getDatabase();
  const savedQuantity = await db.transaction(async (tx) => {
    const [item] = await tx.select({ active: productVariants.active, productActive: products.active, onHand: inventory.onHand, reserved: inventory.reserved })
      .from(productVariants).innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(eq(productVariants.id, parsed.data.variantId)).limit(1);
    if (!item || !item.active || !item.productActive) throw new Error("This product is unavailable.");
    const [cart] = await tx.insert(carts).values({ userId: customer.userId })
      .onConflictDoUpdate({ target: carts.userId, set: { updatedAt: new Date() } }).returning({ id: carts.id });
    const [existing] = await tx.select({ quantity: cartItems.quantity }).from(cartItems)
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, parsed.data.variantId))).limit(1);
    const nextQuantity = parsed.data.quantity + (existing?.quantity ?? 0);
    if (nextQuantity > 20 || nextQuantity > item.onHand - item.reserved) throw new Error("The requested quantity is not available.");
    await tx.insert(cartItems).values({ cartId: cart.id, variantId: parsed.data.variantId, quantity: parsed.data.quantity })
      .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: nextQuantity, updatedAt: new Date() } });
    return nextQuantity;
  });
  revalidatePath("/cart");
  return savedQuantity;
}

export async function setCartQuantity(input: { variantId: string; quantity: number }) {
  const customer = await requireCustomer();
  const parsed = z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(0).max(20) }).safeParse(input);
  if (!parsed.success) throw new Error("Choose a valid product quantity.");
  const db = getDatabase();
  const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, customer.userId)).limit(1);
  if (!cart) return;
  if (parsed.data.quantity === 0) {
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, parsed.data.variantId)));
  } else {
    const [stock] = await db.select({ onHand: inventory.onHand, reserved: inventory.reserved }).from(inventory).where(eq(inventory.variantId, parsed.data.variantId)).limit(1);
    if (!stock || parsed.data.quantity > stock.onHand - stock.reserved) throw new Error("The requested quantity is not available.");
    await db.update(cartItems).set({ quantity: parsed.data.quantity, updatedAt: new Date() })
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, parsed.data.variantId)));
  }
  revalidatePath("/cart");
}

export async function clearCustomerCart() {
  const customer = await requireCustomer();
  const [cart] = await getDatabase().select({ id: carts.id }).from(carts).where(eq(carts.userId, customer.userId)).limit(1);
  if (cart) await getDatabase().delete(cartItems).where(eq(cartItems.cartId, cart.id));
  revalidatePath("/cart");
}

export async function cancelCustomerOrder(orderId: string) {
  const customer = await requireCustomer();
  const { cancelCustomerOrder: cancel } = await import("@/lib/commerce/order-management");
  try { await cancel({ userId: customer.userId, role: "CUSTOMER" }, orderId); }
  catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) throw new Error("We could not cancel the order right now. Contact customer support.");
    throw error;
  }
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${orderId}`);
}

export async function updateProfile(input: { name: string; phone: string }) {
  const customer = await requireCustomer();
  await saveCustomerProfile(customer.userId, input);
  revalidatePath("/account");
  revalidatePath("/account/profile");
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  await requireCustomer();
  const parsed = z.object({ currentPassword: z.string().min(1), newPassword: customerPasswordSchema }).safeParse(input);
  if (!parsed.success) throw new Error("Use at least 12 characters with a letter and a number.");
  await getAuth().api.changePassword({ body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true }, headers: await headers() });
}

export async function deleteCustomerAccount(input: { password: string; confirmation: string }) {
  const customer = await requireCustomer();
  const parsed = z.object({ password: z.string().min(1).max(128), confirmation: z.literal("DELETE") }).safeParse(input);
  if (!parsed.success) throw new Error("Enter your password and type DELETE to confirm account removal.");
  try {
    await getAuth().api.verifyPassword({ body: { password: parsed.data.password }, headers: await headers() });
  } catch {
    throw new Error("The password could not be verified. No changes were made.");
  }
  await anonymizeCustomerAccount(customer.userId);
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (/^(?:__Secure-|__Host-)?better-auth\./.test(cookie.name)) cookieStore.delete(cookie.name);
  }
  revalidatePath("/");
  revalidatePath("/account");
}
