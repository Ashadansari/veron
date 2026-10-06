import { sql } from "drizzle-orm";
import { customerSignupFormSchema } from "@/lib/auth-validation";
import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/db";
import { user } from "@/db/schema";
import { isSameConfiguredOrigin } from "@/lib/http/same-origin";

function authRequestHeaders(request: Request, origin: string): Headers {
  const headers = new Headers({ origin, "content-type": "application/json" });
  for (const name of ["x-forwarded-for", "x-real-ip", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function registrationError(status: number, code?: string) {
  if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return Response.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
  }
  if (code === "INVALID_REGISTRATION" || code === "INVALID_EMAIL" || code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
    return Response.json({ error: "Check your name, email, and password requirements." }, { status: 400 });
  }
  return Response.json({ error: "We could not create your account. Please try again." }, { status: status >= 400 && status < 500 ? status : 503 });
}

export async function POST(request: Request) {
  if (!isSameConfiguredOrigin(request)) {
    return Response.json({ error: "Request could not be completed." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Enter valid registration details." }, { status: 400 }); }
  const parsed = customerSignupFormSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter valid registration details." }, { status: 400 });
  }

  const origin = request.headers.get("origin");
  if (!origin) return Response.json({ error: "Request could not be completed." }, { status: 403 });
  const target = new URL("/api/auth/sign-up/email", origin);
  try {
    return await getDatabase().transaction(async (tx) => {
      const email = parsed.data.email;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`public-registration:${email}`}, 0))`);
      const [existing] = await tx.select({ id: user.id }).from(user)
        .where(sql`lower(${user.email}) = ${email}`)
        .limit(1);
      if (existing) {
        return Response.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
      }
      const authResponse = await getAuth().handler(new Request(target, {
        method: "POST",
        headers: authRequestHeaders(request, origin),
        body: JSON.stringify({
          name: parsed.data.name,
          email,
          password: parsed.data.password,
        }),
      }));

      if (!authResponse.ok) {
        let code: string | undefined;
        try {
          const result = await authResponse.json() as { code?: unknown };
          if (typeof result.code === "string") code = result.code;
        } catch { /* Keep the public error generic when Better Auth returns an unknown response. */ }
        if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
          return Response.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
        }
        return registrationError(authResponse.status, code);
      }

      const response = Response.json({ success: true });
      for (const cookie of authResponse.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
      return response;
    });
  } catch {
    return Response.json({ error: "We could not create your account. Please try again." }, { status: 503 });
  }
}
