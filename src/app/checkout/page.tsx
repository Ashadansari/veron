import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import { CheckoutReview } from "@/components/storefront/checkout-review";
import { getCurrentSession } from "@/lib/authz";
import { getCheckoutReview } from "@/lib/commerce/customer-queries";
export const metadata: Metadata = { title: "Checkout | VÉRON" };
export const dynamic = "force-dynamic";
export default async function CheckoutPage() {
  const current = await getCurrentSession();
  if (!current) redirect("/login?next=/checkout");
  if (current.user.role !== "CUSTOMER") redirect("/admin");
  const review = await getCheckoutReview(current.user.id);
  return <StorefrontFrame><CheckoutReview review={review} /></StorefrontFrame>;
}
