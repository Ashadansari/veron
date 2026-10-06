import { z } from "zod";
import { nepalPhoneSchema } from "@/lib/commerce/nepal-phone";

export const customerPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const customerRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().max(254).transform((email) => email.toLowerCase()),
});

export const customerSignupSchema = customerRegistrationSchema.extend({
  password: customerPasswordSchema,
});

export const customerSignupFormSchema = customerSignupSchema
  .extend({ passwordConfirmation: z.string().min(1) })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match.",
  });

export const customerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: nepalPhoneSchema,
});
