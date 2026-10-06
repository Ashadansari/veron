import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

const AUTH_EMAIL_SIGNUP_PATH = "/api/auth/sign-up/email";

export const GET = (request: Request) => toNextJsHandler(getAuth()).GET(request);
export const POST = (request: Request) => {
  const { pathname } = new URL(request.url);
  if (pathname === AUTH_EMAIL_SIGNUP_PATH || pathname === `${AUTH_EMAIL_SIGNUP_PATH}/`) {
    // Public account creation must pass through /api/register's server validation
    // and case-insensitive duplicate check. The wrapper calls Better Auth directly.
    return Response.json({ error: "Registration request is invalid." }, { status: 404 });
  }
  return toNextJsHandler(getAuth()).POST(request);
};
