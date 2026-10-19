// Fixed-point helpers. Collateral uses 1e6 base units (mirrors a 6-decimal
// stablecoin). PAPER uses 1e18 base units (mirrors a standard ERC-20).
export const COLLATERAL_DECIMALS = 6;
export const PAPER_DECIMALS = 18;
export const SHARE_PRECISION = 10n ** 18n; // same scaling brief §33 uses for rewardPerWinningShare

export function toBaseUnits(amount: number | string, decimals: number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const wholeDigits = whole.replace("-", "") || "0";
  return sign * (BigInt(wholeDigits) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0"));
}

export function fromBaseUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const frac = (abs % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  const str = frac.length ? `${whole}.${frac}` : `${whole}`;
  return negative ? `-${str}` : str;
}

// Postgres NUMERIC comes back as a decimal string with no fractional part
// for our integer-base-unit columns, so a direct BigInt() parse is exact.
export function toBigInt(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value);
}
