import "server-only";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 = 401,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getCurrentSession() {
  const current = await getAuth().api.getSession({ headers: await headers() });
  if (!current || current.user.deletedAt) return null;
  return current;
}

export async function requireCustomer() {
  const current = await getCurrentSession();
  assertRole(current?.user.role, "CUSTOMER");
  if (!current) throw new AuthorizationError("Sign in is required.", 401);
  return { userId: current.user.id };
}

export async function requireAdmin() {
  const current = await getCurrentSession();
  assertRole(current?.user.role, "ADMIN");
  if (!current) throw new AuthorizationError("Sign in is required.", 401);
  return { userId: current.user.id };
}

export function assertRole(role: unknown, expected: "CUSTOMER" | "ADMIN") {
  if (!role) throw new AuthorizationError("Sign in is required.", 401);
  if (role !== expected) {
    throw new AuthorizationError(expected === "ADMIN" ? "Administrator access is required." : "Customer access is required.", 403);
  }
}
