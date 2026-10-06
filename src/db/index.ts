import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

type Database = PostgresJsDatabase<typeof schema>;
type DatabaseGlobal = typeof globalThis & {
  najFancyPostgres?: ReturnType<typeof postgres>;
  najFancyDatabase?: Database;
};

/**
 * Prisma's PostgreSQL URLs commonly include `schema=public`. postgres-js treats
 * query parameters as PostgreSQL startup parameters, where `schema` is not a
 * valid server setting. The app uses postgres-js directly, so remove this
 * Prisma-only option; PostgreSQL's default search path already includes public.
 */
export function normalizePostgresJsConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete("schema");
  return url.toString();
}

export function getDatabase(): Database {
  const globalForDatabase = globalThis as DatabaseGlobal;
  if (globalForDatabase.najFancyDatabase) return globalForDatabase.najFancyDatabase;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured before using store data.");
  }

  const client = postgres(normalizePostgresJsConnectionString(connectionString), {
    max: process.env.NODE_ENV === "development" ? 5 : 20,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  globalForDatabase.najFancyPostgres = client;
  globalForDatabase.najFancyDatabase = drizzle(client, { schema });
  return globalForDatabase.najFancyDatabase;
}
