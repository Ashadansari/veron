import "server-only";

import { z } from "zod";
import { nepalPhoneSchema } from "@/lib/commerce/nepal-phone";

export { nepalPhoneSchema } from "@/lib/commerce/nepal-phone";

export const nepalProvinces = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
] as const;

export const nepalAddressSchema = z.object({
  fullName: z.string().trim().min(2).max(140),
  phoneNumber: nepalPhoneSchema,
  province: z.enum(nepalProvinces),
  district: z.string().trim().min(2).max(80),
  municipality: z.string().trim().min(2).max(120),
  wardNumber: z.coerce.number().int().min(1).max(35),
  toleArea: z.string().trim().min(2).max(120),
  streetAddress: z.string().trim().min(2).max(240),
  postalCode: z.string().trim().max(15).optional().or(z.literal("")),
  isDefault: z.boolean().optional().default(false),
});
