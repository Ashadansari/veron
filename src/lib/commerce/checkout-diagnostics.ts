const SAFE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/;
const SAFE_ERROR_CODE = /^[A-Za-z0-9_-]{1,32}$/;

/** Return only diagnostic metadata; never forward exception messages, SQL, values, or credentials. */
export function getSafeCheckoutFailureMetadata(error: unknown) {
  if (typeof error !== "object" || error === null) return { errorType: "UnknownError" };

  const value = error as Record<string, unknown>;
  const metadata: Record<string, string> = {
    errorType: error instanceof Error && SAFE_IDENTIFIER.test(error.name) ? error.name : "UnknownError",
  };
  if (typeof value.code === "string" && SAFE_ERROR_CODE.test(value.code)) metadata.databaseCode = value.code;
  for (const key of ["constraint", "table", "column"] as const) {
    const item = value[key];
    if (typeof item === "string" && SAFE_IDENTIFIER.test(item)) metadata[key] = item;
  }
  return metadata;
}
