import "server-only";

import { z } from "zod";
import { getDatabase } from "@/db";
import { storeSettings } from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { parseNprToPaisa } from "@/lib/commerce/money";
import { nepalPhoneSchema } from "@/lib/commerce/nepal-phone";

const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().max(254).optional(),
  contactPhone: z.string().trim().max(20).optional(),
  shippingChargeNpr: z.string().trim(),
  freeShippingThresholdNpr: z.string().trim(),
  codEnabled: z.boolean(),
  storeActive: z.boolean(),
});

export async function saveAdminStoreSettings(actor: { userId: string; role: string }, input: unknown) {
  assertRole(actor.role, "ADMIN");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Store settings are invalid.");
  const { storeName, contactEmail, contactPhone, shippingChargeNpr, freeShippingThresholdNpr, codEnabled, storeActive } = parsed.data;
  const email = contactEmail ? z.string().email().max(254).safeParse(contactEmail) : null;
  if (email && !email.success) throw new Error("Enter a valid contact email address.");
  const phone = contactPhone ? nepalPhoneSchema.safeParse(contactPhone) : null;
  if (phone && !phone.success) throw new Error("Enter a valid Nepal contact phone number.");
  let shippingChargePaisa: bigint;
  let freeShippingThresholdPaisa: bigint | null;
  try {
    shippingChargePaisa = parseNprToPaisa(shippingChargeNpr);
    freeShippingThresholdPaisa = freeShippingThresholdNpr ? parseNprToPaisa(freeShippingThresholdNpr) : null;
  } catch { throw new Error("Shipping amounts must be valid NPR amounts with at most two decimal places."); }

  await getDatabase().insert(storeSettings).values({
    id: 1, storeName, currency: "NPR", locale: "ne-NP", timeZone: "Asia/Kathmandu",
    shippingChargePaisa, freeShippingThresholdPaisa,
    contactEmail: email?.success ? email.data : null,
    contactPhone: phone?.success ? phone.data : null,
    codEnabled, storeActive, updatedBy: actor.userId, updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: storeSettings.id,
    set: {
      storeName, currency: "NPR", locale: "ne-NP", timeZone: "Asia/Kathmandu",
      shippingChargePaisa, freeShippingThresholdPaisa,
      contactEmail: email?.success ? email.data : null,
      contactPhone: phone?.success ? phone.data : null,
      codEnabled, storeActive, updatedBy: actor.userId, updatedAt: new Date(),
    },
  });
}
