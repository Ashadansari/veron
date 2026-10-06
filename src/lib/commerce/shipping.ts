import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { shippingRules, storeSettings } from "@/db/schema";

export async function quoteShipping(input: {
  province: string;
  district: string;
  subtotalPaisa: bigint;
}) {
  const db = getDatabase();
  const rules = await db
    .select()
    .from(shippingRules)
    .where(eq(shippingRules.active, true))
    .orderBy(desc(shippingRules.priority), desc(shippingRules.updatedAt));
  const rule = rules.filter((candidate) => candidate.province !== null || candidate.district !== null).sort((left, right) => {
    const priority = right.priority - left.priority;
    if (priority) return priority;
    const specificity = (candidate: typeof left) => Number(candidate.province !== null) + Number(candidate.district !== null);
    const specificityDifference = specificity(right) - specificity(left);
    if (specificityDifference) return specificityDifference;
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  }).find(
    (candidate) =>
      (candidate.province === null || candidate.province === input.province) &&
      (candidate.district === null || candidate.district === input.district),
  );
  if (rule) {
    const free = rule.freeShippingThresholdPaisa !== null && input.subtotalPaisa >= rule.freeShippingThresholdPaisa;
    const [settings] = await db.select({ codEnabled: storeSettings.codEnabled }).from(storeSettings).limit(1);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      chargePaisa: free ? 0n : rule.chargePaisa,
      codEnabled: (settings?.codEnabled ?? true) && rule.codEnabled,
    };
  }

  const [settings] = await db.select().from(storeSettings).limit(1);
  if (!settings) throw new Error("Shipping is not available for this address.");

  const free = settings.freeShippingThresholdPaisa !== null && input.subtotalPaisa >= settings.freeShippingThresholdPaisa;
  return {
    ruleId: null,
    ruleName: "Standard delivery",
    chargePaisa: free ? 0n : settings.shippingChargePaisa,
    codEnabled: settings.codEnabled,
  };
}
