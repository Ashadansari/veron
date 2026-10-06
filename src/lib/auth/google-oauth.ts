type GoogleOAuthEnvironment = Record<string, string | undefined>;

export function getGoogleOAuthConfig(environment: GoogleOAuthEnvironment = process.env) {
  const clientId = environment.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, requireEmailVerification: true };
}

export function isGoogleOAuthConfigured(environment: GoogleOAuthEnvironment = process.env): boolean {
  return getGoogleOAuthConfig(environment) !== null;
}
