import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

const passwordSchema = z.string().min(12).max(128).regex(/[A-Za-z]/).regex(/[0-9]/);
const inputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().max(254).transform((value) => value.toLowerCase()),
  password: passwordSchema,
});

/** Prisma URLs may include schema=public, but postgres-js treats unknown URL
 * query options as PostgreSQL startup parameters. The store client removes it
 * for the same reason. */
export function normalizeBootstrapConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete("schema");
  return url.toString();
}

function normalizeAdminEmail(email: string): string {
  const normalized = z.email().trim().max(254).parse(email).toLowerCase();
  return normalized;
}

function createBootstrapClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  try {
    return postgres(normalizeBootstrapConnectionString(connectionString), { max: 1, prepare: false });
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
  }
}

function safeDatabaseError(error: unknown): Error {
  const rawMessage = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "";
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : typeof error === "object" && error !== null && "cause" in error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause && typeof error.cause.code === "string"
      ? error.cause.code
      : undefined;
  const messages: Record<string, string> = {
    ECONNREFUSED: "Could not connect to PostgreSQL (connection refused). Start the configured database and verify DATABASE_URL host and port.",
    ETIMEDOUT: "Could not connect to PostgreSQL (connection timed out). Verify database availability and network access.",
    ENOTFOUND: "Could not resolve the PostgreSQL host in DATABASE_URL.",
    EHOSTUNREACH: "The PostgreSQL host in DATABASE_URL is unreachable.",
    "28P01": "PostgreSQL rejected the configured database credentials. Verify DATABASE_URL without sharing it.",
    "3D000": "The configured PostgreSQL database does not exist. Verify DATABASE_URL database name.",
    "42P01": "Required auth tables are missing. Apply the project migrations to this database first.",
    "42704": "PostgreSQL reported an undefined database object. Verify the migration state for this database.",
    "23505": "A database uniqueness constraint blocked account creation. Check the target database state and migration/index consistency.",
    "08P01": "PostgreSQL rejected the connection startup parameters. Verify the DATABASE_URL options.",
  };
  if (code === "42704" && /unrecognized configuration parameter ["']schema["']/i.test(rawMessage)) {
    return new Error("PostgreSQL rejected the Prisma-only schema URL option. The CLI now removes schema= before connecting.");
  }
  const reason = code && messages[code]
    ? messages[code]
    : "Database operation failed before the administrator account could be committed. Check PostgreSQL availability and migrations; sensitive connection details are omitted.";
  return new Error(code ? `${reason} (PostgreSQL SQLSTATE ${code}).` : reason);
}

export async function createFirstAdmin(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Administrator details are invalid.");
  // Use Better Auth's own password hash format; plaintext is only held in process memory during setup.
  const passwordHash = await hashPassword(parsed.data.password);
  const userId = randomUUID();
  const accountId = randomUUID();
  const client = createBootstrapClient();
  try {
    await client.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(781432105991::bigint)`;
      const existingAdmins = await tx`select id from "user" where role = 'ADMIN'::user_role limit 1`;
      if (existingAdmins.length) throw new Error("An administrator already exists. First-admin setup made no changes.");
      const existingUsers = await tx`select id from "user" where lower(email) = ${parsed.data.email} limit 1`;
      if (existingUsers.length) throw new Error("An account with this email already exists. First-admin setup will not modify existing accounts.");
      await tx`
        insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
        values (${userId}, ${parsed.data.name}, ${parsed.data.email}, false, 'ADMIN'::user_role, now(), now())
      `;
      await tx`
        insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
        values (${accountId}, ${userId}, 'credential', ${userId}, ${passwordHash}, now(), now())
      `;
    });
  } catch (error) {
    if (error instanceof Error && /administrator already exists|account with this email already exists/.test(error.message)) throw error;
    throw safeDatabaseError(error);
  } finally {
    await client.end().catch(() => undefined);
  }
  return { id: userId, email: parsed.data.email };
}

/** Inspect an email before the interactive create-admin command requests a password. */
export async function inspectAdminEmail(email: string): Promise<{
  exists: boolean;
  role?: "CUSTOMER" | "ADMIN";
  deleted?: boolean;
}> {
  const normalizedEmail = normalizeAdminEmail(email);
  const client = createBootstrapClient();
  try {
    const matches = await client`
      select id, role, deleted_at
      from "user"
      where lower(email) = ${normalizedEmail}
      order by created_at asc
      limit 2
    `;
    if (matches.length > 1) {
      throw new Error("Multiple accounts match this normalized email. No changes were made; resolve the duplicate staging data first.");
    }
    const match = matches[0];
    if (!match) return { exists: false };
    if (match.role !== "ADMIN" && match.role !== "CUSTOMER") {
      throw new Error("The matching account has an unsupported role. No changes were made.");
    }
    return { exists: true, role: match.role, deleted: match.deleted_at !== null };
  } catch (error) {
    if (error instanceof Error && /Multiple accounts match|unsupported role/.test(error.message)) throw error;
    throw safeDatabaseError(error);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Explicit staging/owner recovery for an existing CUSTOMER identity. This keeps
 * the original user row, installs a Better Auth-compatible credential, promotes
 * that same row, and invalidates its prior sessions in one transaction.
 */
export async function recoverCustomerAsFirstAdmin(input: { email: string; password: string }) {
  const normalizedEmail = normalizeAdminEmail(input.email);
  const password = passwordSchema.parse(input.password);
  const passwordHash = await hashPassword(password);
  const client = createBootstrapClient();
  try {
    const recovered = await client.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(781432105991::bigint)`;
      const matches = await tx`
        select id, email, role, deleted_at
        from "user"
        where lower(email) = ${normalizedEmail}
        for update
      `;
      if (matches.length > 1) {
        throw new Error("Multiple accounts match this normalized email. No changes were made; resolve the duplicate staging data first.");
      }
      const existing = matches[0];
      if (!existing) throw new Error("No existing account matches this email. Use normal first-admin setup instead.");
      if (existing.role === "ADMIN") throw new Error("This account is already an administrator. Its credential was not changed.");
      if (existing.role !== "CUSTOMER") throw new Error("The matching account has an unsupported role. No changes were made.");
      if (existing.deleted_at !== null) throw new Error("The matching customer account is deactivated. No changes were made.");

      const otherAdmins = await tx`
        select id from "user" where role = 'ADMIN'::user_role and id <> ${existing.id} limit 1
      `;
      if (otherAdmins.length) throw new Error("An administrator already exists. Recovery made no changes.");

      const credentials = await tx`
        select id from account
        where user_id = ${existing.id} and provider_id = 'credential'
        order by created_at asc
        for update
      `;
      if (credentials.length > 1) {
        throw new Error("This account has multiple credential records. No changes were made; resolve them before recovery.");
      }
      if (credentials.length === 1) {
        await tx`
          update account set password = ${passwordHash}, updated_at = now()
          where id = ${credentials[0].id}
        `;
      } else {
        await tx`
          insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
          values (${randomUUID()}, ${existing.id}, 'credential', ${existing.id}, ${passwordHash}, now(), now())
        `;
      }
      await tx`delete from session where user_id = ${existing.id}`;
      await tx`
        update "user"
        set email = ${normalizedEmail}, role = 'ADMIN'::user_role, updated_at = now()
        where id = ${existing.id}
      `;
      return { id: existing.id as string, email: normalizedEmail };
    });
    return recovered;
  } catch (error) {
    if (error instanceof Error && /Multiple accounts match|already an administrator|No existing account|unsupported role|deactivated|administrator already exists|multiple credential records/.test(error.message)) throw error;
    throw safeDatabaseError(error);
  } finally {
    await client.end().catch(() => undefined);
  }
}
