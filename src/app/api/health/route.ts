import { sql } from "drizzle-orm";
import { getDatabase } from "@/db";

export async function GET() {
  try {
    await getDatabase().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    // Keep infrastructure details out of a public probe response and logs.
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
