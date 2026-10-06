import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type PrismaGlobal = typeof globalThis & { najFancyPrisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Configure it in .env.local before querying PostgreSQL.");
  }

  const globalForPrisma = globalThis as PrismaGlobal;
  if (!globalForPrisma.najFancyPrisma) {
    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.najFancyPrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.najFancyPrisma;
}
