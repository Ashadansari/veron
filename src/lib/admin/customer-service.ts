import "server-only";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import { orders, user } from "@/db/schema";
import { assertRole, requireAdmin } from "@/lib/authz";
import { anonymizeCustomerAccount } from "@/lib/account-service";

const customerIdSchema = z.string().min(1).max(128);

export async function deactivateAdminCustomer(actor: { userId: string; role: string }, input: unknown) {
  assertRole(actor.role, "ADMIN");
  const parsedId = customerIdSchema.safeParse(input);
  if (!parsedId.success) throw new Error("Customer account not found.");
  await anonymizeCustomerAccount(parsedId.data);
}

export async function getAdminCustomers(query?: string) {
  await requireAdmin();
  const term = query?.trim().slice(0, 120) ?? "";
  const search = term
    ? or(ilike(user.name, `%${term}%`), ilike(user.email, `%${term}%`), ilike(user.phone, `%${term}%`))
    : undefined;
  const rows = await getDatabase().select({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
    orderCount: sql<number>`count(${orders.id})::int`,
  }).from(user).leftJoin(orders, eq(orders.userId, user.id))
    .where(and(eq(user.role, "CUSTOMER"), search))
    .groupBy(user.id)
    .orderBy(desc(user.createdAt))
    .limit(100);
  const latestOrders = rows.length ? await getDatabase().select({
    userId: orders.userId,
    orderNumber: orders.orderNumber,
    status: orders.status,
    placedAt: orders.placedAt,
  }).from(orders).where(inArray(orders.userId, rows.map((row) => row.id))).orderBy(desc(orders.placedAt)) : [];
  const latestByCustomer = new Map<string, (typeof latestOrders)[number]>();
  for (const order of latestOrders) if (order.userId && !latestByCustomer.has(order.userId)) latestByCustomer.set(order.userId, order);
  return rows.map((row) => ({ ...row, latestOrder: latestByCustomer.get(row.id) ?? null }));
}

export async function getAdminCustomerDetails(input: string) {
  await requireAdmin();
  const parsedId = customerIdSchema.safeParse(input);
  if (!parsedId.success) return null;
  const db = getDatabase();
  const [customer] = await db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
  }).from(user).where(and(eq(user.id, parsedId.data), eq(user.role, "CUSTOMER"))).limit(1);
  if (!customer) return null;

  const customerOrders = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    status: orders.status,
    paymentStatus: orders.paymentStatus,
    paymentMethod: orders.paymentMethod,
    totalPaisa: orders.totalPaisa,
    placedAt: orders.placedAt,
  }).from(orders).where(eq(orders.userId, customer.id)).orderBy(desc(orders.placedAt)).limit(100);

  return { customer, orders: customerOrders };
}
