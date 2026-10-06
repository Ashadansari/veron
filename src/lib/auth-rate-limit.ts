import { isIP } from "node:net";

export function getAuthRateLimitOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    enabled: nodeEnv !== "test",
    storage: "database" as const,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
    },
  };
}

export function getTrustedProxyCidrs(value = process.env.TRUSTED_PROXY_CIDRS) {
  if (!value?.trim()) return [];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [address, prefixText, ...extra] = entry.split("/");
    const addressFamily = address ? isIP(address) : 0;
    const prefix = prefixText === undefined ? undefined : Number(prefixText);
    const maxPrefix = addressFamily === 4 ? 32 : 128;
    if (!addressFamily || extra.length > 0 || (prefixText !== undefined &&
      (!/^\d+$/.test(prefixText) || !Number.isInteger(prefix) || prefix! < 0 || prefix! > maxPrefix))) {
      throw new Error("TRUSTED_PROXY_CIDRS must contain valid IP addresses or CIDR ranges.");
    }
    return entry;
  });
}
