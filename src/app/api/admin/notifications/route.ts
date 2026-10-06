import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { AuthorizationError, assertRole } from "@/lib/authz";
import { isSameConfiguredOrigin } from "@/lib/http/same-origin";
import { listAdminOrderAlerts, markAdminOrderAlertRead, markAllAdminOrderAlertsRead } from "@/lib/admin/order-alerts";

export const dynamic = "force-dynamic";

const readRequestSchema = z.union([
  z.object({ notificationId: z.uuid() }).strict(),
  z.object({ markAll: z.literal(true) }).strict(),
]);

async function authorize(request: Request): Promise<{ userId: string; role: string } | Response> {
  try {
    const current = await getAuth().api.getSession({ headers: request.headers });
    if (!current || current.user.deletedAt) {
      return Response.json({ error: "Sign in is required." }, { status: 401, headers: { "cache-control": "private, no-store" } });
    }
    assertRole(current.user.role, "ADMIN");
    return { userId: current.user.id, role: "ADMIN" };
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 503;
    const message = status === 401 ? "Sign in is required." : status === 403 ? "Administrator access is required." : "Notifications are temporarily unavailable.";
    return Response.json({ error: message }, { status, headers: { "cache-control": "private, no-store" } });
  }
}

export async function GET(request: Request) {
  const actor = await authorize(request);
  if (actor instanceof Response) return actor;
  try {
    return Response.json(await listAdminOrderAlerts(actor), { headers: { "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Notifications are temporarily unavailable." }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
}

export async function PATCH(request: Request) {
  if (!isSameConfiguredOrigin(request)) {
    return Response.json({ error: "Request could not be completed." }, { status: 403, headers: { "cache-control": "private, no-store" } });
  }
  const actor = await authorize(request);
  if (actor instanceof Response) return actor;

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid notification request." }, { status: 400, headers: { "cache-control": "private, no-store" } }); }
  const parsed = readRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid notification request." }, { status: 400, headers: { "cache-control": "private, no-store" } });

  try {
    if ("markAll" in parsed.data) {
      const markedRead = await markAllAdminOrderAlertsRead(actor);
      return Response.json({ success: true, markedRead }, { headers: { "cache-control": "private, no-store" } });
    }
    const found = await markAdminOrderAlertRead(actor, parsed.data.notificationId);
    if (!found) return Response.json({ error: "Notification not found." }, { status: 404, headers: { "cache-control": "private, no-store" } });
    return Response.json({ success: true }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Notifications are temporarily unavailable." }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
}
