export function getCanonicalAppUrl(path: string, appUrl = process.env.NEXT_PUBLIC_APP_URL): URL | null {
  if (!appUrl || !path.startsWith("/") || path.startsWith("//")) return null;

  try {
    const base = new URL(appUrl);
    const secureProtocol = base.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && base.protocol === "http:");
    if (!secureProtocol || base.username || base.password || base.pathname !== "/" || base.search || base.hash) return null;
    const target = new URL(path, base.origin);
    return target.origin === base.origin ? target : null;
  } catch {
    return null;
  }
}
