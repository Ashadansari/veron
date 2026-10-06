const ALLOWED_PUBLIC_VARIABLES = new Set(["NEXT_PUBLIC_APP_URL"]);

export function findUnsafePublicEnvironmentNames(environment: Record<string, string | undefined>) {
  return Object.keys(environment).filter((name) =>
    name.startsWith("NEXT_PUBLIC_") && !ALLOWED_PUBLIC_VARIABLES.has(name),
  ).sort();
}

export function assertSafePublicEnvironment(environment: Record<string, string | undefined>) {
  const unsafeNames = findUnsafePublicEnvironmentNames(environment);
  if (unsafeNames.length) {
    throw new Error(`Unapproved NEXT_PUBLIC_ variable names: ${unsafeNames.join(", ")}. Only NEXT_PUBLIC_APP_URL is allowed.`);
  }
}
