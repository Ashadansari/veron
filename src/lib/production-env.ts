import { getTrustedProxyCidrs } from "@/lib/auth-rate-limit";
import { findUnsafePublicEnvironmentNames } from "@/lib/public-env";

const REQUIRED_PRODUCTION_VARIABLES = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "KHALTI_ENVIRONMENT",
] as const;

type Environment = Record<string, string | undefined>;

export function getProductionEnvironmentIssues(environment: Environment): string[] {
  const issues: string[] = [];
  for (const name of findUnsafePublicEnvironmentNames(environment)) {
    issues.push(`${name} is not an approved public environment variable.`);
  }
  for (const name of REQUIRED_PRODUCTION_VARIABLES) {
    if (!environment[name]?.trim()) issues.push(`${name} is required.`);
  }

  const databaseUrl = parseUrl(environment.DATABASE_URL);
  if (environment.DATABASE_URL?.trim() && (!databaseUrl || !["postgres:", "postgresql:"].includes(databaseUrl.protocol))) {
    issues.push("DATABASE_URL must be a valid PostgreSQL URL.");
  } else if (databaseUrl && isLoopbackHost(databaseUrl.hostname)) {
    issues.push("DATABASE_URL must not use a loopback host in production.");
  }

  const authUrl = parseUrl(environment.BETTER_AUTH_URL);
  if (environment.BETTER_AUTH_URL?.trim() && !isHttpsOrigin(authUrl)) {
    issues.push("BETTER_AUTH_URL must be an HTTPS origin without embedded credentials.");
  }

  const appUrl = parseUrl(environment.NEXT_PUBLIC_APP_URL);
  if (environment.NEXT_PUBLIC_APP_URL?.trim() && !isHttpsOrigin(appUrl)) {
    issues.push("NEXT_PUBLIC_APP_URL must be an HTTPS origin without embedded credentials.");
  }
  if (isHttpsOrigin(authUrl) && isHttpsOrigin(appUrl) && authUrl.origin !== appUrl.origin) {
    issues.push("BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL must use the same canonical origin.");
  }

  const authSecret = environment.BETTER_AUTH_SECRET?.trim();
  if (authSecret && authSecret.length < 32) {
    issues.push("BETTER_AUTH_SECRET must contain at least 32 characters.");
  } else if (authSecret?.startsWith("replace-with-a-random-secret")) {
    issues.push("BETTER_AUTH_SECRET must replace the example placeholder with a unique random secret.");
  }

  if (Boolean(environment.GOOGLE_CLIENT_ID?.trim()) !== Boolean(environment.GOOGLE_CLIENT_SECRET?.trim())) {
    issues.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.");
  }

  const khaltiEnvironment = environment.KHALTI_ENVIRONMENT?.trim();
  if (khaltiEnvironment && !["sandbox", "production"].includes(khaltiEnvironment)) {
    issues.push("KHALTI_ENVIRONMENT must be sandbox or production.");
  }
  if (khaltiEnvironment === "production" && !environment.KHALTI_SECRET_KEY?.trim()) {
    issues.push("KHALTI_SECRET_KEY is required when KHALTI_ENVIRONMENT is production.");
  }

  if (environment.TEST_DATABASE_URL?.trim()) issues.push("TEST_DATABASE_URL must not be set in production.");
  if (environment.SEED_ADMIN_EMAIL?.trim()) issues.push("SEED_ADMIN_EMAIL must not be set in production.");

  try {
    getTrustedProxyCidrs(environment.TRUSTED_PROXY_CIDRS);
  } catch {
    issues.push("TRUSTED_PROXY_CIDRS must contain valid IP addresses or CIDR ranges.");
  }

  return issues;
}

export function assertProductionEnvironment(environment: Environment): void {
  const issues = getProductionEnvironmentIssues(environment);
  if (issues.length) {
    throw new Error(`Production environment is invalid:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
}

function parseUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try { return new URL(value); } catch { return null; }
}

function isHttpsOrigin(url: URL | null): url is URL {
  return Boolean(url && url.protocol === "https:" && url.hostname && url.pathname === "/" &&
    !url.search && !url.hash && !url.username && !url.password);
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1";
}
