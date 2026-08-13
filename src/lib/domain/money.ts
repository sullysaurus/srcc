export function dollarsToCents(input: string | number): number {
  const raw = typeof input === "number" ? String(input) : input;
  const normalized = raw.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Invalid currency value");
  const [whole, fraction = ""] = normalized.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  return sign * (Math.abs(Number.parseInt(whole, 10)) * 100 + Number.parseInt(fraction.padEnd(2, "0") || "0", 10));
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
