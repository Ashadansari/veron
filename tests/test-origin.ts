const configuredUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

export const testOrigin = new URL(configuredUrl).origin;
export const testHost = new URL(configuredUrl).host;
