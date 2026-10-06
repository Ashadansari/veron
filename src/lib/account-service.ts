import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/db";
import { account, addresses, carts, orders, session, user, verification } from "@/db/schema";
import { customerProfileSchema } from "@/lib/auth-validation";
import { nepalAddressSchema } from "@/lib/commerce/nepal-address";

export async function saveCustomerProfile(userId: string, input: unknown) {
  const parsed = customerProfileSchema.safeParse(input);
  if (!parsed.success) throw new Error("Enter a valid name and Nepal phone number.");
  try {
    const updated = await getDatabase().update(user).set({
      name: parsed.data.name,
      phone: parsed.data.phone,
      updatedAt: new Date(),
    }).where(and(eq(user.id, userId), eq(user.role, "CUSTOMER"))).returning({ id: user.id });
    if (!updated.length) throw new Error("Account not found.");
  } catch (error) {
    if (isPhoneUniqueViolation(error)) throw new Error("That phone number is already in use.");
    throw error;
  }
}

export async function saveCustomerAddress(userId: string, input: unknown) {
  const parsed = nepalAddressSchema.safeParse(input);
  if (!parsed.success) throw new Error("Please check the address details.");
  const db = getDatabase();
  const addressId = (input as Record<string, unknown>).addressId;
  const values = {
    ...parsed.data,
    postalCode: parsed.data.postalCode || null,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    if (values.isDefault) {
      await tx.update(addresses).set({ isDefault: false, updatedAt: new Date() }).where(eq(addresses.userId, userId));
    }
    if (typeof addressId === "string" && addressId) {
      const updated = await tx.update(addresses).set(values)
        .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
        .returning({ id: addresses.id });
      if (!updated.length) throw new Error("Address not found.");
    } else {
      await tx.insert(addresses).values({ ...values, userId });
    }
  });
}

export async function deleteCustomerAddress(userId: string, addressId: string) {
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const [removed] = await tx.delete(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .returning({ id: addresses.id, isDefault: addresses.isDefault });
    if (removed?.isDefault) {
      const [next] = await tx.select({ id: addresses.id }).from(addresses)
        .where(eq(addresses.userId, userId)).orderBy(asc(addresses.createdAt)).limit(1);
      if (next) await tx.update(addresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(addresses.id, next.id));
    }
  });
}

export async function anonymizeCustomerAccount(userId: string) {
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const [customer] = await tx.select({ email: user.email, role: user.role, deletedAt: user.deletedAt }).from(user)
      .where(eq(user.id, userId)).for("update").limit(1);
    if (!customer) throw new Error("Account not found.");
    if (customer.role !== "CUSTOMER") throw new Error("Only customer accounts can be removed through this workflow.");
    if (customer.deletedAt) throw new Error("This customer account is already deactivated.");

    const previousOrders = await tx.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
    for (const order of previousOrders) {
      await tx.update(orders).set({
        userId: null,
        customerName: "Deleted Customer",
        customerPhone: "",
        shippingAddressSnapshot: {
          fullName: "Deleted Customer",
          phoneNumber: null,
          province: null,
          district: null,
          municipality: null,
          wardNumber: null,
          toleArea: null,
          streetAddress: null,
          postalCode: null,
        },
        updatedAt: new Date(),
      }).where(eq(orders.id, order.id));
    }

    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));
    await tx.delete(verification).where(eq(verification.identifier, customer.email));
    await tx.delete(addresses).where(eq(addresses.userId, userId));
    await tx.delete(carts).where(eq(carts.userId, userId));
    await tx.update(user).set({
      name: "Deleted Customer",
      email: `deleted+${randomUUID()}@deleted.invalid`,
      emailVerified: false,
      phone: null,
      image: null,
      role: "CUSTOMER",
      deletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(user.id, userId));
  });
}

function isPhoneUniqueViolation(error: unknown): boolean {
  const seen = new Set<object>();
  let current: unknown = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?: unknown; constraint?: unknown; constraint_name?: unknown; cause?: unknown };
    if (candidate.code === "23505" &&
      (candidate.constraint_name === "user_phone_unique" || candidate.constraint === "user_phone_unique")) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}
