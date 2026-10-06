import type { ReactNode } from "react";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";

export function StorefrontFrame({ children }: { children: ReactNode }) {
  return <><SiteHeader />{children}<SiteFooter /></>;
}
