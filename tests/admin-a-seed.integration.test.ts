import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { user } from "@/db/schema";
import { getPrismaClient } from "@/lib/prisma";
import { getDevelopmentSeedAdmin } from "../prisma/seed-admin";

const db = getDatabase();
const prisma = getPrismaClient();
const id = randomUUID();
const email = `seed-admin-collision-${randomUUID()}@example.test`;

after(async () => {
  await db.delete(user).where(eq(user.id, id));
});

test("development seed preserves CUSTOMER role when its admin email already belongs to a customer", async () => {
  await db.insert(user).values({ id, name: "Existing customer", email, role: "CUSTOMER" });

  const seeded = await getDevelopmentSeedAdmin(prisma, email);

  assert.equal(seeded.id, id);
  const [saved] = await db.select({ role: user.role }).from(user).where(eq(user.id, id)).limit(1);
  assert.equal(saved.role, "CUSTOMER");
});
