import assert from "node:assert/strict";
import { test } from "node:test";
import { customerSignupFormSchema } from "@/lib/auth-validation";

test("customer registration requires complete data and matching passwords", () => {
  const registration = {
    name: "Test Customer",
    email: "Customer@Example.com",
    password: "StrongTestPass123",
    passwordConfirmation: "StrongTestPass123",
  };

  const parsed = customerSignupFormSchema.safeParse(registration);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.email, "customer@example.com");
  }

  assert.equal(customerSignupFormSchema.safeParse({
    ...registration,
    passwordConfirmation: "DifferentPassword456",
  }).success, false);
  for (const email of ["customer", "customer@", "@example.com"]) {
    assert.equal(customerSignupFormSchema.safeParse({ ...registration, email }).success, false);
  }
  assert.equal(customerSignupFormSchema.safeParse({
    email: registration.email,
    password: registration.password,
    passwordConfirmation: registration.password,
  }).success, false);
});
