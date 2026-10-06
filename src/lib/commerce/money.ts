import "server-only";

const NPR_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export function parseNprToPaisa(input: string): bigint {
  const normalized = input.trim();
  if (!NPR_AMOUNT_PATTERN.test(normalized)) {
    throw new Error("Enter a valid NPR amount with at most two decimal places.");
  }
  const [rupeesPart, paisaPart = ""] = normalized.split(".");
  return BigInt(rupeesPart) * 100n + BigInt(paisaPart.padEnd(2, "0") || "0");
}

export function formatPaisa(amount: bigint): string {
  if (amount < 0n) throw new Error("Amounts cannot be negative.");
  const rupees = new Intl.NumberFormat("en-NP").format(amount / 100n);
  const paisa = amount % 100n;
  return "NPR " + rupees + (paisa === 0n ? "" : "." + paisa.toString().padStart(2, "0"));
}

export function formatPaisaInput(amount: bigint): string {
  if (amount < 0n) throw new Error("Amounts cannot be negative.");
  return (amount / 100n).toString() + "." + (amount % 100n).toString().padStart(2, "0");
}
