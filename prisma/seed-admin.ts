import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";

export async function getDevelopmentSeedAdmin(prisma: Pick<PrismaClient, "user">, configuredEmail: string) {
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (existingAdmin) return existingAdmin;

  const email = configuredEmail.trim().toLowerCase();
  return prisma.user.upsert({
    where: { email },
    // Preserve role and other account fields if the configured placeholder email already belongs to a user.
    update: { name: "Development admin placeholder" },
    create: {
      id: randomUUID(),
      name: "Development admin placeholder",
      email,
      emailVerified: false,
      role: "ADMIN",
    },
  });
}
