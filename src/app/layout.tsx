import type { Metadata } from "next";
import { CartProvider } from "@/components/storefront/cart-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Naj Fancy Store | Clothing for Nepal",
    template: "%s | Naj Fancy Store",
  },
  description:
    "Easy, expressive clothing for every version of you. Discover everyday and occasion wear at Naj Fancy Store, serving customers across Nepal.",
  applicationName: "Naj Fancy Store",
  openGraph: {
    title: "Naj Fancy Store | Clothing for Nepal",
    description: "Clothes that feel like you. Made for all the moments in between.",
    siteName: "Naj Fancy Store",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
