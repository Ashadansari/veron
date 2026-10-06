export function isSameConfiguredOrigin(
  request: Request,
  configuredOrigins: readonly (string | undefined)[] = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
  ],
): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return false;
  }
  const requestHost = request.headers.get("host") ?? requestUrl.host;
  let requestOrigin: string;
  try {
    requestOrigin = new URL(`${requestUrl.protocol}//${requestHost}`).origin;
  } catch {
    return false;
  }

  return configuredOrigins.some((configuredOrigin) => {
    if (!configuredOrigin) return false;
    try {
      const allowed = new URL(configuredOrigin);
      return origin === requestOrigin && allowed.origin === requestOrigin && requestHost.toLowerCase() === allowed.host.toLowerCase();
    } catch {
      return false;
    }
  });
}
