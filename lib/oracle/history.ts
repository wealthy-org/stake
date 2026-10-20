const BINANCE_BASE = process.env.BINANCE_API_BASE ?? "https://api.binance.com";

export interface PricePoint {
  t: number;
  p: number;
}

export type Timeframe = "24H" | "7D" | "1M" | "ALL";

const TF_MAP: Record<Timeframe, { interval: string; limit: number }> = {
  "24H": { interval: "15m", limit: 96 },
  "7D": { interval: "1h", limit: 168 },
  "1M": { interval: "4h", limit: 186 },
  "ALL": { interval: "1d", limit: 365 },
};

export function isTimeframe(v: string | null): v is Timeframe {
  return v === "24H" || v === "7D" || v === "1M" || v === "ALL";
}

/** Binance public klines — real trade tape, no key required. */
export async function getBinanceHistory(symbol: string, tf: Timeframe): Promise<PricePoint[]> {
  const clean = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{5,20}$/.test(clean)) throw new Error("invalid symbol");
  const { interval, limit } = TF_MAP[tf];
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${encodeURIComponent(clean)}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance klines failed for ${clean}: ${res.status}`);
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("empty klines response");
  const points: PricePoint[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const openTime = Number(row[0]);
    const close = Number(row[4]);
    if (Number.isFinite(openTime) && Number.isFinite(close) && close > 0) points.push({ t: openTime, p: close });
  }
  if (points.length < 2) throw new Error("not enough kline data");
  return points;
}

/**
 * Nasdaq intraday chart series for Stock Tokens preview. The endpoint shape
 * has drifted over time, so this parses defensively and throws whenever
 * nothing parseable comes back — the caller (and then the client) falls back
 * to the illustrative series.
 */
export async function getNasdaqHistory(symbol: string): Promise<PricePoint[]> {
  const clean = symbol.trim().toUpperCase();
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(clean)}/chart?assetclass=stocks`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://www.nasdaq.com",
    },
  });
  if (!res.ok) throw new Error(`Nasdaq chart failed for ${clean}: ${res.status}`);
  const json = (await res.json()) as any;
  const chart = json?.data?.chart;
  if (!Array.isArray(chart) || chart.length === 0) throw new Error("empty chart response");

  const points: PricePoint[] = [];
  for (const item of chart) {
    const z = item?.z ?? item?.y ?? item ?? {};
    const price = parseFloat(String(z.value ?? z.price ?? item.value ?? item.price ?? "").replace(/[^0-9.]/g, ""));
    const tsRaw = z.timestamp ?? item.x ?? item.timestamp ?? item.dateTime ?? z.dateTime;
    const t = typeof tsRaw === "number" ? tsRaw : Date.parse(String(tsRaw ?? ""));
    if (Number.isFinite(price) && price > 0 && Number.isFinite(t)) points.push({ t, p: price });
  }
  if (points.length < 2) throw new Error("not enough chart data");
  return points;
}
