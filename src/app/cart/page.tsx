import type { Metadata } from "next";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import CartPageContent from "@/components/storefront/cart-page-content";
export const metadata: Metadata = { title: "Your bag | VÉRON" };
export default function CartPage() { return <StorefrontFrame><CartPageContent /></StorefrontFrame>; }
