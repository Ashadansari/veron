import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { sql } from "drizzle-orm";
import { getGoogleOAuthConfig } from "@/lib/auth/google-oauth";
import { account, rateLimit, session, user, verification } from "@/db/schema";
import { getDatabase } from "@/db";
import { customerPasswordSchema, customerSignupSchema } from "@/lib/auth-validation";
import { getAuthRateLimitOptions, getTrustedProxyCidrs } from "@/lib/auth-rate-limit";
import { nepalPhoneSchema } from "@/lib/commerce/nepal-address";

function createAuth(secret: string, baseURL: string) {
  const secureCookies = process.env.NODE_ENV === "production";
  const googleOAuth = getGoogleOAuthConfig();
  const trustedOrigins = [...new Set([baseURL, process.env.NEXT_PUBLIC_APP_URL].filter((origin): origin is string => Boolean(origin)))];
  return betterAuth({
    appName: "VÉRON",
    baseURL,
    secret,
    trustedOrigins,
    database: drizzleAdapter(getDatabase(), {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit },
    }),
    ...(googleOAuth ? { socialProviders: { google: googleOAuth } } : {}),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        phone: {
          type: "string",
          required: false,
          input: true,
          validator: { input: nepalPhoneSchema },
        },
        role: {
          type: "string",
          required: false,
          defaultValue: "CUSTOMER",
          input: false,
        },
        deletedAt: {
          type: "date",
          required: false,
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => {
            const normalizedEmail = newUser.email.trim().toLowerCase();
            const [existing] = await getDatabase().select({ id: user.id }).from(user)
              .where(sql`lower(${user.email}) = ${normalizedEmail}`)
              .limit(1);
            if (existing) {
              throw APIError.from("CONFLICT", {
                code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
                message: "An account with this email already exists.",
              });
            }
            return {
              data: {
                ...newUser,
                email: normalizedEmail,
                phone: typeof newUser.phone === "string" ? nepalPhoneSchema.parse(newUser.phone) : null,
                role: "CUSTOMER",
              },
            };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") {
          const input = customerSignupSchema.safeParse(ctx.body);
          if (!input.success) {
            throw APIError.from("BAD_REQUEST", {
              code: "INVALID_REGISTRATION",
              message: "Enter a valid name, email, and password that meets the requirements.",
            });
          }
        }
        if (["/change-password", "/reset-password", "/set-password"].includes(ctx.path)) {
          const input = customerPasswordSchema.safeParse(ctx.body.newPassword);
          if (!input.success) {
            throw APIError.from("BAD_REQUEST", {
              code: "WEAK_PASSWORD",
              message: "Use at least 12 characters with a letter and a number.",
            });
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (!["/sign-up/email", "/sign-in/email"].includes(ctx.path)) return;
        const response = ctx.context.returned;
        if (!response || typeof response !== "object" || !("token" in response)) return;
        return { ...response, token: null };
      }),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: getAuthRateLimitOptions(),
    advanced: {
      useSecureCookies: secureCookies,
      ipAddress: { trustedProxies: getTrustedProxyCidrs() },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies,
        path: "/",
      },
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (authInstance) return authInstance;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  const baseURL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000";
  if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_URL) {
    throw new Error("BETTER_AUTH_URL must be configured in production.");
  }
  authInstance = createAuth(secret, baseURL);
  return authInstance;
}
