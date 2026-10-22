"use client";

import { useEffect, useMemo, useState } from "react";
import { usd } from "@/lib/client/format";
import type { MarketRow } from "@/lib/client/types";

const TFS = ["24H", "7D", "1M", "ALL"] as const;

interface PricePoint {
  t: number;
  p: number;
}

/** Deterministic seeded walk used only when the real tape is unavailable (Stock Tokens preview). */
function seededSeries(seedId: string, strike: number): PricePoint[] {
  let s = 0;
  for (let i = 0; i < seedId.length; i++) s = (s * 31 + seedId.charCodeAt(i)) % 233280;
  const now = Date.now();
  const span = 7 * 86_400_000;
  const n = 96;
  const out: PricePoint[] = [];
  let v = strike;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    v += ((s / 233280 - 0.5) * strike) / 22;
    out.push({ t: now - span + (i / (n - 1)) * span, p: Math.max(strike * 0.5, v) });
  }
  return out;
}

const W = 760;
const H = 260;
const PL = 52;
const PR = 16;
const PB = 30;
const PT = 14;

export default function MarketChart({ market }: { market: MarketRow }) {
  const [tf, setTf] = useState<(typeof TFS)[number]>("7D");
  const [live, setLive] = useState<PricePoint[] | null>(null);
  const [state, setState] = useState<"loading" | "live" | "illustrative" | "error">("loading");
  const [hover, setHover] = useState<number | null>(null);

  const sourceParts = market.oracle_source.split(":");
  const isStock = market.oracle_source.startsWith("stock:");
  const isPolymarket = market.oracle_source.startsWith("polymarket:");
  // Polymarket's feed id for price-history is the Yes CLOB token (3rd
  // segment), not the conditionId (2nd segment) resolution itself uses.
  const feed = isPolymarket ? sourceParts[2] ?? sourceParts[1] : sourceParts[1] ?? market.oracle_source;
  const strike = isPolymarket ? 50 : Number(market.strike_price); // 50 = midline on a 0-100% probability axis, not a real strike

  useEffect(() => {
    let active = true;
    setState("loading");
    const source = isPolymarket ? "polymarket" : isStock ? "stock" : "binance";
    const url = `/api/price-history?source=${source}&feed=${encodeURIComponent(feed)}&tf=${tf}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: PricePoint[]) => {
        if (!active) return;
        if (Array.isArray(data) && data.length > 1) {
          setLive(data);
          setState("live");
        } else {
          setLive(null);
          setState("illustrative");
        }
      })
      .catch(() => {
        if (active) {
          setLive(null);
          setState("illustrative");
        }
      });
    return () => {
      active = false;
    };
  }, [feed, tf, isStock, isPolymarket, market.id]);

  const points = useMemo(() => live ?? seededSeries(`${market.id}-${tf}`, strike), [live, market.id, tf, strike]);

  // y-scale spans the data plus the strike so the strike line always reads on the chart
  const lo = Math.min(...points.map((d) => d.p), strike) * 0.995;
  const hi = Math.max(...points.map((d) => d.p), strike) * 1.005;
  const xi = (i: number) => PL + (i / Math.max(1, points.length - 1)) * (W - PL - PR);
  const yv = (v: number) => PT + ((hi - v) / (hi - lo)) * (H - PT - PB);

  const path = points.map((d, i) => `${i ? "L" : "M"}${xi(i).toFixed(1)} ${yv(d.p).toFixed(1)}`).join(" ");
  const area = `${path} L${xi(points.length - 1).toFixed(1)} ${H - PB} L${xi(0).toFixed(1)} ${H - PB} Z`;
  const strikeY = yv(strike);
  const last = points[points.length - 1];

  // gridlines: ~4 nice steps between lo and hi
  const steps = 4;
  const grid = Array.from({ length: steps + 1 }, (_, i) => lo + ((hi - lo) * i) / steps);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const rel = (px - PL) / (W - PL - PR);
    const idx = Math.round(rel * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, idx)));
  }
  function onLeave() {
    setHover(null);
  }

  const hov = hover !== null ? points[hover] : null;
  const tipLeft = hover !== null ? Math.min(92, Math.max(8, (xi(hover) / W) * 100)) : 0;
  const tipFlip = hover !== null && hover > points.length * 0.62;

  const fmtPrice = (v: number) =>
    isPolymarket ? `${v.toFixed(1)}%` : v >= 1000 ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${v.toFixed(2)}`;
  const fmtTime = (t: number) => {
    const d = new Date(t);
    const short =
      tf === "24H"
        ? d.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return `${short} UTC`;
  };

  return (
    <div>
      <div className="mchd">
        <div className="charttag">
          <i />
          {isPolymarket ? "Live odds · Polymarket" : isStock ? `${feed} tape · Nasdaq` : `${feed} tape · Binance`}
          {state === "illustrative" && !isPolymarket && <em>illustrative</em>}
        </div>
        <div className="mctf" role="tablist" aria-label="Chart timeframe">
          {TFS.map((t) => (
            <button key={t} role="tab" aria-selected={tf === t} className={tf === t ? "on" : ""} onClick={() => setTf(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mcwrap">
        <svg
          className="mchart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={isPolymarket ? "Polymarket Yes-odds history" : `${feed} price against the ${usd(strike, 0)} strike`}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          <defs>
            <linearGradient id="mcfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--yes)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--yes)" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {grid.map((g) => (
            <g key={g}>
              <line x1={PL} x2={W - PR} y1={yv(g)} y2={yv(g)} stroke="var(--line)" strokeDasharray={!isPolymarket && Math.abs(g - strike) < 1e-9 ? undefined : "2 4"} />
              <text x={PL - 6} y={yv(g) + 4} textAnchor="end" className="mclabel">
                {isPolymarket ? `${g.toFixed(0)}%` : g >= 1000 ? `$${(g / 1000).toFixed(1)}k` : `$${g.toFixed(g < 10 ? 2 : 1)}`}
              </text>
            </g>
          ))}

          {/* strike marker — a real strike line only makes sense for price-threshold markets, not a Yes/No probability */}
          {!isPolymarket && (
            <line x1={PL} x2={W - PR} y1={strikeY} y2={strikeY} stroke="var(--gold-d)" strokeWidth="1.6" strokeDasharray="6 4" />
          )}

          {/* bottom time labels */}
          {[0, 0.5, 1].map((f) => {
            const i = Math.round(f * (points.length - 1));
            return (
              <text key={f} x={xi(i)} y={H - 9} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} className="mclabel">
                {fmtTime(points[i].t)}
              </text>
            );
          })}

          <path d={area} fill="url(#mcfill)" />
          <path d={path} fill="none" stroke="var(--yes)" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

          {/* last point */}
          <circle cx={xi(points.length - 1)} cy={yv(last.p)} r="4" fill="var(--yes)" stroke="var(--sheet)" strokeWidth="1.5" />

          {/* hover crosshair */}
          {hov && (
            <g>
              <line x1={xi(hover!)} x2={xi(hover!)} y1={PT} y2={H - PB} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              <circle cx={xi(hover!)} cy={yv(hov.p)} r="4.5" fill="var(--ink)" />
            </g>
          )}

          {/* strike chip — not applicable to a Yes/No probability chart */}
          {!isPolymarket && (
            <>
              <rect x={W - PR - 78} y={strikeY - 21} width="78" height="16" rx="3" fill="var(--gold)" stroke="var(--gold-d)" strokeWidth="1" />
              <text x={W - PR - 7} y={strikeY - 9} textAnchor="end" className="mcbadge">
                Strike {strike >= 1000 ? `$${strike.toLocaleString("en-US")}` : `$${strike.toFixed(0)}`}
              </text>
            </>
          )}
        </svg>

        {hov && (
          <div
            className="mctip"
            style={{ left: `${Math.min(88, Math.max(12, tipLeft))}%`, top: 8, transform: tipFlip ? "translateX(-100%)" : "translateX(0)" }}
          >
            <b>{fmtPrice(hov.p)}</b>
            <span>
              {fmtTime(hov.t)}
              {!isPolymarket && <> · {hov.p > strike ? "above" : hov.p < strike ? "below" : "at"} {usd(strike, 0)}</>}
            </span>
          </div>
        )}
      </div>

      <p className="mchint">
        {state === "live" && isPolymarket && <>Real Polymarket Yes-odds history.</>}
        {state === "live" && !isPolymarket && (
          <>
            Real {isStock ? "Nasdaq" : "Binance"} {tf === "24H" ? "15-minute" : tf === "7D" ? "hourly" : tf === "1M" ? "4-hour" : "daily"} closes. Hover the
            chart to inspect any point against the {usd(strike, 0)} strike.
          </>
        )}
        {state !== "live" && isPolymarket && <>Odds history for this market.</>}
        {state !== "live" && !isPolymarket && (
          <>Illustrative preview for this oracle feed — resolution still reads the verified price at settlement time.</>
        )}
      </p>
    </div>
  );
}
