import { fromBaseUnits, toBaseUnits } from "@/lib/engine/units";

export function usd(n: number, d = 2): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function short(n: number): string {
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return "$" + Math.round(n);
}

export function num(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function pct(a: number, b: number): number {
  if (a + b <= 0) return 50;
  return Math.round((a / (a + b)) * 100);
}

export function fmtLeft(ms: number): string {
  if (ms <= 0) return "Closed";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  const p = (v: number) => String(v).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(x)}`;
}

/** DB collateral amounts are strings of 1e6 base units; display as a JS number of dollars. */
export function collateralToNumber(baseUnits: string | null | undefined): number {
  if (!baseUnits) return 0;
  return Number(fromBaseUnits(BigInt(baseUnits), 6));
}

/** DB PAPER amounts are strings of 1e18 base units; display as a whole-token number. */
export function paperToNumber(baseUnits: string | null | undefined): number {
  if (!baseUnits) return 0;
  return Number(fromBaseUnits(BigInt(baseUnits), 18));
}

/** Convert a dollar amount typed by the user into the 1e6-base-unit string the API expects. */
export function dollarsToBaseUnits(amount: number | string): string {
  return toBaseUnits(amount, 6).toString();
}
