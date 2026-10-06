export function formatNpr(paisa: string) {
  const amount = BigInt(paisa);
  const rupees = new Intl.NumberFormat("en-NP").format(amount / 100n);
  const remainder = amount % 100n;
  return "NPR " + rupees + (remainder === 0n ? "" : "." + remainder.toString().padStart(2, "0"));
}

export function parseNprToPaisa(input: string): bigint | null {
  const value = input.trim();
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value)) return null;
  const [rupees, paisa = ""] = value.split(".");
  return BigInt(rupees) * 100n + BigInt(paisa.padEnd(2, "0") || "0");
}
