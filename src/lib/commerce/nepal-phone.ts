import { z } from "zod";

const nepalPhoneInputSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\+977[- ]?)?(?:0?9[678]\d{8}|0?[1-9]\d{6,8})$/,
    "Enter a valid Nepal phone number.",
  );

export const nepalPhoneSchema = nepalPhoneInputSchema.transform((value) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("977") ? digits.slice(3) : digits;
  const local = national.startsWith("0") ? national.slice(1) : national;
  return `+977${local}`;
});
