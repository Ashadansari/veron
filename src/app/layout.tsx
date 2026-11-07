import type { Metadata } from "next";
import { CartProvider } from "@/components/storefront/cart-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://najfancystore-staging.netlify.app/"),
  title: {
    default: "VÉRON | Fashion. Style. You.",
    template: "%s | VÉRON",
  },
  description: "Discover elevated fashion for men and women at VÉRON. Timeless everyday and occasion wear, delivered across Nepal.",
  applicationName: "VÉRON",
  openGraph: {
    title: "VÉRON | Fashion. Style. You.",
    description: "Elegant everyday and occasion fashion for men and women, delivered across Nepal.",
    siteName: "VÉRON",
    type: "website",
    images: [{ url: "/veron-social.png", width: 1200, height: 630, alt: "VÉRON — Fashion. Style. You." }],
  },
  twitter: { card: "summary_large_image", title: "VÉRON | Fashion. Style. You.", description: "Elegant fashion for men and women, delivered across Nepal.", images: ["/veron-social.png"] },
  icons: { icon: "/icon.svg", shortcut: "/favicon.ico" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
