"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/authz";
import { createCustomerOrder } from "@/lib/commerce/checkout";

export async function placeOrder(input: unknown) {
  const customer = await requireCustomer();
  const result = await createCustomerOrder({ userId: customer.userId, role: "CUSTOMER" }, input);
  revalidatePath("/cart");
  revalidatePath("/account/orders");
  return result;
}
