"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listMarkets, getStats } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd } from "@/lib/client/format";
import type { MarketRow, ProtocolStats } from "@/lib/client/types";
import MarketRow_ from "@/components/MarketRow";
import Coin from "@/components/Coin";
import Countdown from "@/components/Countdown";
import TapeStrip from "@/components/TapeStrip";
import { Flame, TrendUp, ArrowUpRight } from "@/components/icons";
import { SkelFacts, SkelBoard, SkelPolyHero, SkelMarketGrid } from "@/components/Skeleton";
import { useWallet } from "@/components/providers";

// Legacy per-asset tickers from the old price-threshold generator — folded
// into whichever Polymarket launch category they actually belong to
// (CRYPTO for coins, FINANCE for single-stock price questions — that's
// how Polymarket itself buckets equities, not under Tech), same grouping
// as the Markets page.
const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL"]);
const STOCK_TICKERS = new Set(["AAPL", "NVDA", "GOOGL", "TSLA"]);
function assetGroup(symbol: string): string {
  if (CRYPTO_TICKERS.has(symbol)) return "CRYPTO";
  if (STOCK_TICKERS.has(symbol)) return "FINANCE";
  return symbol;
}

function calculatePays(own: number, other: number): string {
  if (own <= 0) return "1.00";
  return (1 + (other * 0.98) / own).toFixed(2);
}

const QUICK_LINKS = [
  { href: "/app/portfolio", label: "Your slips", desc: "Open bets, winnings, claimable STAKE" },
  { href: "/app/paper", label: "STAKE supply", desc: "Genesis progress and emission curve" },
  { href: "/app/activity", label: "Activity", desc: "The live tape of protocol events" },
  { href: "/app/stats", label: "Ledger", desc: "Wagered, net losses, fees" },
] as const;

export default function Dashboard() {
  const { address, summary, connectInjected, connectTestAddress } = useWallet();
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    let active = true;
    const fetchMarkets = () => {
      listMarkets()
        .then((data) => {
          if (active) setMarkets(data);
        })
        .catch(() => {
          if (active && markets === null) setMarkets([]);
        });
    };
    fetchMarkets();
    getStats().then(setStats).catch(() => {});
    const interval = setInterval(fetchMarkets, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Top open markets — Polymarket-sourced markets surface first (leader's
  // priority call: push Polymarket content to the top without touching the
  // lifecycle of any already-created legacy market), then by pool volume
  // within each group.
  const openMarkets = useMemo(
    () =>
      (markets ?? [])
        .filter((m) => m.status === "open")
        .sort((a, b) => {
          const aPm = a.oracle_source.startsWith("polymarket:");
          const bPm = b.oracle_source.startsWith("polymarket:");
          if (aPm !== bPm) return aPm ? -1 : 1;
          return Number(b.yes_pool) + Number(b.no_pool) - (Number(a.yes_pool) + Number(a.no_pool));
        }),
    [markets]
  );

  // Markets for the featured carousel (top 5)
  const spotlightMarkets = useMemo(() => openMarkets.slice(0, 5), [openMarkets]);

  // Featured market details
  const activeFeatured = spotlightMarkets[featuredIdx % (spotlightMarkets.length || 1)] || null;

  const featuredYes = activeFeatured ? collateralToNumber(activeFeatured.yes_pool) : 50000;
  const featuredNo = activeFeatured ? collateralToNumber(activeFeatured.no_pool) : 50000;
  const featuredTotal = featuredYes + featuredNo;
  const featuredYesPct = featuredTotal > 0 ? Math.round((featuredYes / featuredTotal) * 100) : 50;
  const featuredNoPct = 100 - featuredYesPct;
  const featuredPaysYes = calculatePays(featuredYes, featuredNo);
  const featuredPaysNo = calculatePays(featuredNo, featuredYes);

  // Real Polymarket probability history for the featured chart, when the
  // featured market actually has one — the Yes-token id is carried as the
  // 3rd ":"-separated segment of oracle_source (see lib/engine/autoMarket.ts).
  const [realHistory, setRealHistory] = useState<number[] | null>(null);
  useEffect(() => {
    const source = activeFeatured?.oracle_source ?? "";
    const tokenId = source.startsWith("polymarket:") ? source.split(":")[2] : null;
    if (!tokenId) {
      setRealHistory(null);
      return;
    }
    let active = true;
    fetch(`/api/price-history?source=polymarket&feed=${encodeURIComponent(tokenId)}&tf=7D`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { t: number; p: number }[]) => {
        if (!active) return;
        setRealHistory(Array.isArray(data) && data.length > 1 ? data.map((d) => d.p) : null);
      })
      .catch(() => {
        if (active) setRealHistory(null);
      });
    return () => {
      active = false;
    };
  }, [activeFeatured?.id, activeFeatured?.oracle_source]);

  // Seeded probability walk for the featured chart — deterministic per market,
  // pinned to the real pool split at the last point. Used only as a fallback
  // for markets with no real history available (e.g. legacy price-threshold
  // markets, or a Polymarket market too new to have one yet).
  const chartSeries = useMemo(() => {
    if (realHistory && realHistory.length > 1) return realHistory;
    if (!activeFeatured) return null;
    let s = 0;
    for (let i = 0; i < activeFeatured.id.length; i++) s = (s * 31 + activeFeatured.id.charCodeAt(i)) % 233280;
    const rnd = Array.from({ length: 97 }, () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    });
    const pts: number[] = [];
    let v = Math.min(72, Math.max(28, featuredYesPct + (rnd[0] - 0.5) * 20));
    for (let i = 0; i < 86; i++) {
      v = Math.min(90, Math.max(10, v + (rnd[i + 1] - 0.5) * 6.5));
      pts.push(Math.round(v * 10) / 10);
    }
    // last stretch converges onto the real pool split
    const anchor = Math.min(88, Math.max(12, v + (rnd[87] - 0.5) * 5));
    for (let i = 0; i < 11; i++) {
      pts.push(Math.round((anchor + (featuredYesPct - anchor) * (i / 10)) * 10) / 10);
    }
    return pts;
  }, [activeFeatured?.id, featuredYesPct, realHistory]);

  const CW = 600;
  const CH = 180;
  const TOP = 12;
  const BOT = 22;
  const pMin = chartSeries ? Math.max(5, Math.floor((Math.min(...chartSeries) - 6) / 5) * 5) : 0;
  const pMax = chartSeries ? Math.min(95, Math.ceil((Math.max(...chartSeries) + 6) / 5) * 5) : 100;
  const cx = (i: number) => (i / (chartSeries!.length - 1)) * CW;
  const cy = (pct: number) => TOP + ((pMax - pct) / (pMax - pMin)) * (CH - TOP - BOT);

  const yesPath = chartSeries
    ? chartSeries.map((p, i) => (i === 0 ? `M${cx(0).toFixed(1)} ${cy(p).toFixed(1)}` : `L${cx(i).toFixed(1)} ${cy(chartSeries![i - 1]).toFixed(1)} L${cx(i).toFixed(1)} ${cy(p).toFixed(1)}`)).join(" ")
    : "";
  const noPath = chartSeries
    ? chartSeries.map((p, i) => {
        const y = cy(100 - p).toFixed(1);
        return i === 0 ? `M${cx(0).toFixed(1)} ${y}` : `L${cx(i).toFixed(1)} ${cy(100 - chartSeries![i - 1]).toFixed(1)} L${cx(i).toFixed(1)} ${y}`;
      }).join(" ")
    : "";
  const yesArea = yesPath ? `${yesPath} L${CW} ${CH - BOT} L0 ${CH - BOT} Z` : "";

  // Trending leaderboard (Top 5 markets by volume)
  const trendingMarkets = useMemo(() => openMarkets.slice(0, 5), [openMarkets]);

  // Filter chip options — derived from whatever asset_symbol values are
  // actually present, same fix as the Markets page: a hardcoded
  // Stock Tokens/Crypto pair stopped matching once Polymarket categories
  // (CRYPTO/FINANCE/GEOPOLITICS/TECH) replaced the old generator.
  const marketFilterOptions = useMemo(() => {
    const unique = Array.from(new Set(openMarkets.map((m) => assetGroup(m.asset_symbol)))).sort();
    return ["all", ...unique];
  }, [openMarkets]);

  // Filtered markets for the grid section
  const gridMarkets = useMemo(() => {
    return openMarkets.filter((m) => marketFilter === "all" || assetGroup(m.asset_symbol) === marketFilter).slice(0, 16);
  }, [openMarkets, marketFilter]);

  const openPositions = (summary?.positions ?? []).filter((p) => p.status !== "resolved" && p.status !== "cancelled");
  const claimable = (summary?.positions ?? []).filter(
    (p) => (p.status === "resolved" || p.status === "cancelled") && !p.payout_claimed
  ).length;

  return (
    <>
      {/* ── Page Header & Wallet Summary ── */}
      <div className="dash-hd">
        <div>
          <h1>Dashboard</h1>
          <p>Live prediction pools, oracle probability trends, and your account at a glance.</p>
        </div>
      </div>

      {address ? (
        summary ? (
          <div className="facts f4" style={{ marginBottom: 28 }}>
            <div>
              <b>{usd(collateralToNumber(summary.virtualBalance), 0)}</b>
              <small>Virtual balance</small>
            </div>
            <div>
              <b className="gd">{Math.round(paperToNumber(summary.paperBalance)).toLocaleString("en-US")}</b>
              <small>STAKE balance</small>
            </div>
            <div>
              <b>{openPositions.length}</b>
              <small>Open positions</small>
            </div>
            <div>
              <b>{claimable}</b>
              <small>Claimable slips</small>
            </div>
          </div>
        ) : (
          <SkelFacts count={4} />
        )
      ) : (
        <div className="dash-connect" style={{ marginBottom: 28 }}>
          <div>
            <b>No wallet connected</b>
            <p>Connect to view your virtual testnet balance, live claims, and active prediction slips.</p>
          </div>
          <div className="dash-connect-act">
            <button className="btn gold" onClick={() => connectInjected()}>
              Connect wallet
            </button>
            <button className="btn ghost" onClick={connectTestAddress}>
              Use a test address
            </button>
          </div>
        </div>
      )}

      {/* ── POLYMARKET STYLE HERO SECTION (Featured Spotlight + Trending Leaderboard) ── */}
      {markets === null && <SkelPolyHero />}
      {activeFeatured && (
        <div className="poly-hero">
          {/* Main Hero Spotlight Card */}
          <div className="poly-featured-card">
            <div className="poly-featured-header">
              <div className="poly-featured-category">
                <Coin symbol={activeFeatured.asset_symbol} />
                <span className="poly-cat-text">
                  {activeFeatured.oracle_source.startsWith("stock:") ? "Stock Tokens" : assetGroup(activeFeatured.asset_symbol)}
                </span>
                <span className="poly-pool-id">#{activeFeatured.id.slice(-3).toUpperCase()}</span>
              </div>
              <div className="poly-vol-badge">${featuredTotal.toLocaleString("en-US")} Vol</div>
            </div>

            <h2 className="poly-featured-title">
              <Link href={`/app/market/${activeFeatured.id}`}>{activeFeatured.question}</Link>
            </h2>

            {/* Odds Cards (YES / NO) */}
            <div className="poly-odds-row">
              <Link href={`/app/market/${activeFeatured.id}?side=yes`} className="poly-odd-box yes">
                <div className="odd-left">
                  <span className="odd-label">YES</span>
                  <span className="odd-sub">Proportional payout</span>
                </div>
                <div className="odd-right">
                  <span className="odd-pct">{featuredYesPct}%</span>
                  <span className="odd-pays">pays ${featuredPaysYes}</span>
                </div>
              </Link>
              <Link href={`/app/market/${activeFeatured.id}?side=no`} className="poly-odd-box no">
                <div className="odd-left">
                  <span className="odd-label">NO</span>
                  <span className="odd-sub">Proportional payout</span>
                </div>
                <div className="odd-right">
                  <span className="odd-pct">{featuredNoPct}%</span>
                  <span className="odd-pays">pays ${featuredPaysNo}</span>
                </div>
              </Link>
            </div>

            {/* Pool probability chart (stepped, area-fill, axis labels) */}
            <div className="poly-chart-wrap">
              <div className="poly-chart-head">
                <span>{realHistory ? "Polymarket odds · last 7d" : "Pool shift · last 24h"}</span>
                <div className="poly-chart-legend">
                  <span className="leg-yes"><i /> YES <b>{featuredYesPct}%</b></span>
                  <span className="leg-no"><i /> NO <b>{featuredNoPct}%</b></span>
                </div>
              </div>
              <div className="poly-svg-container">
                <svg viewBox={`0 0 ${CW} ${CH}`} className="poly-chart-svg" role="img" aria-label="Pool probability over the last 24 hours">
                  {chartSeries && (
                    <>
                      {[25, 50, 75]
                        .filter((g) => g > pMin && g < pMax)
                        .map((g) => (
                          <g key={g}>
                            <line x1="0" x2={CW} y1={cy(g)} y2={cy(g)} stroke="#B7BAAE" strokeDasharray="2 4" opacity="0.55" />
                            <text x={CW - 4} y={cy(g) - 5} textAnchor="end" className="poly-axis-label">
                              {g}%
                            </text>
                          </g>
                        ))}

                      <path d={yesArea} fill="var(--yes)" opacity="0.07" />
                      <path d={noPath} fill="none" stroke="var(--no)" strokeWidth="1.4" strokeDasharray="7 5" opacity="0.45" vectorEffect="non-scaling-stroke" />
                      <path d={yesPath} fill="none" stroke="var(--yes)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      <circle cx={cx(chartSeries!.length - 1)} cy={cy(chartSeries![chartSeries!.length - 1])} r="3.6" fill="var(--yes)" stroke="var(--slip)" strokeWidth="1.6" />
                    </>
                  )}
                </svg>
              </div>
              <div className="poly-chart-timeline">
                <span>24h ago</span>
                <span>18h</span>
                <span>12h</span>
                <span>6h</span>
                <span>Now</span>
              </div>
            </div>

            <div className="poly-feat-meta">
              <span>
                Ends <b>{new Date(activeFeatured.betting_closes_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</b>
              </span>
              <span>
                Oracle{" "}
                {activeFeatured.oracle_source.startsWith("stock:")
                  ? "Nasdaq tape"
                  : activeFeatured.oracle_source.startsWith("polymarket:")
                  ? "Polymarket settlement"
                  : "Binance spot"}{" "}
                · Fee {(activeFeatured.protocol_fee_bps / 100).toFixed(1)}%
              </span>
            </div>

            {/* Featured Bottom Actions & Carousel Controls */}
            <div className="poly-featured-bottom">
              <div className="poly-featured-bet-btns">
                <Link className="btn yes" href={`/app/market/${activeFeatured.id}?side=yes`}>
                  <span>Take YES</span> <span className="arr">→</span>
                </Link>
                <Link className="btn no" href={`/app/market/${activeFeatured.id}?side=no`}>
                  <span>Take NO</span> <span className="arr">→</span>
                </Link>
              </div>

              <div className="poly-carousel-nav">
                <button
                  type="button"
                  className="carousel-btn"
                  onClick={() => setFeaturedIdx((prev) => (prev > 0 ? prev - 1 : spotlightMarkets.length - 1))}
                  aria-label="Previous market"
                >
                  ← Prev
                </button>
                <div className="carousel-dots">
                  {spotlightMarkets.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`carousel-dot ${featuredIdx % spotlightMarkets.length === i ? "active" : ""}`}
                      onClick={() => setFeaturedIdx(i)}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="carousel-btn"
                  onClick={() => setFeaturedIdx((prev) => (prev + 1) % spotlightMarkets.length)}
                  aria-label="Next market"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          {/* Right Widget Column (Promos + Trending Leaderboard) */}
          <div className="poly-side-widgets">
            {/* Promo 1: Stock Tokens V2 */}
            <div className="poly-promo-card stocks">
              <div className="promo-badge">V2 ROBINHOOD</div>
              <h3>Stock Tokens Live</h3>
              <p>Trade synthetic equities on NVDA, AAPL, TSLA with native Robinhood Chain L1 settlement.</p>
              <Link href="/app/markets" className="btn sm gold"><span>Trade Stocks</span> <ArrowUpRight /></Link>
            </div>

            {/* Promo 2: STAKE Genesis */}
            <div className="poly-promo-card genesis">
              <div className="promo-badge lime">FAIR LAUNCH</div>
              <h3>Loss Into Ownership</h3>
              <p>Zero premint. Verified net losses mint protocol governance and fee claim tokens.</p>
              <Link href="/app/paper" className="btn sm ghost"><span>View Genesis</span> <ArrowUpRight /></Link>
            </div>

            <div className="poly-trending-card">
              <div className="trending-head">
                <h4><TrendUp /> Trending</h4>
                <Link href="/app/markets" className="trending-more">View all →</Link>
              </div>
              <ul className="trending-list">
                {trendingMarkets.map((m, idx) => {
                  const tVol = collateralToNumber(m.yes_pool) + collateralToNumber(m.no_pool);
                  return (
                    <li key={m.id}>
                      <Link href={`/app/market/${m.id}`} className="trending-item">
                        <span className="rank">{idx + 1}</span>
                        <Coin symbol={m.asset_symbol} />
                        <div className="trending-info">
                          <span className="q">{m.question}</span>
                        </div>
                        <span className="v">${tVol.toLocaleString("en-US")} Vol</span>
                        <span className="trend-arrow" aria-hidden="true"><Flame /></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE TAPE STRIP ── */}
      <div style={{ marginTop: 28 }}>
        <TapeStrip />
      </div>

      {/* ── ALL MARKETS SECTION ── */}
      <div className="sec" style={{ marginTop: 44 }}>
        <div>
          <h2>All markets</h2>
          <p style={{ color: "var(--ink2)", fontSize: 14, marginTop: 4 }}>
            {stats ? `${stats.activeMarkets} open · ${stats.totalMarkets} total prediction pools` : "Active prediction pools"}
          </p>
        </div>

        {/* View mode toggle + Link */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div className="view-mode-toggle">
            <button
              type="button"
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => setViewMode("grid")}
            >
              Grid
            </button>
            <button
              type="button"
              className={viewMode === "table" ? "active" : ""}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
          </div>
          <Link href="/app/markets" className="btn ghost sm">Browse all markets <ArrowUpRight /></Link>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="poly-filter-chips-bar">
        <div className="poly-chips">
          {marketFilterOptions.map((k) => (
            <button
              key={k}
              type="button"
              className={`poly-chip ${marketFilter === k ? "active" : ""}`}
              onClick={() => setMarketFilter(k)}
            >
              {k === "all" ? "All" : k}
            </button>
          ))}
        </div>
      </div>

      {/* Content Rendering: Grid vs Table */}
      {markets === null ? (
        viewMode === "grid" ? <SkelMarketGrid count={6} /> : <SkelBoard rows={4} />
      ) : gridMarkets.length > 0 ? (
        viewMode === "grid" ? (
          <div className="poly-market-grid">
            {gridMarkets.map((m) => {
              const yes = collateralToNumber(m.yes_pool);
              const no = collateralToNumber(m.no_pool);
              const total = yes + no;
              const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;
              const noPct = 100 - yesPct;
              const paysYes = calculatePays(yes, no);
              const paysNo = calculatePays(no, yes);

              return (
                <div key={m.id} className="poly-market-card">
                  <div className="card-top">
                    <div className="card-coin">
                      <Coin symbol={m.asset_symbol} />
                      <div>
                        <b>{m.asset_symbol} / USD</b>
                        <small>Pool #{m.id.slice(-3).toUpperCase()}</small>
                      </div>
                    </div>
                    <span className="card-status-badge">LIVE</span>
                  </div>

                  <h3 className="card-question">
                    <Link href={`/app/market/${m.id}`}>{m.question}</Link>
                  </h3>

                  <div className="card-split-section">
                    <div className="card-split-bar">
                      <span className="bar-yes" style={{ width: `${yesPct}%` }} />
                      <span className="bar-no" />
                    </div>
                    <div className="card-split-labels">
                      <span className="lbl-yes">YES <b>{yesPct}%</b></span>
                      <span className="lbl-no">NO <b>{noPct}%</b></span>
                    </div>
                  </div>

                  <div className="card-bet-actions">
                    <Link className="card-btn yes" href={`/app/market/${m.id}?side=yes`}>
                      <span>YES</span>
                      <b>${paysYes}</b>
                    </Link>
                    <Link className="card-btn no" href={`/app/market/${m.id}?side=no`}>
                      <span>NO</span>
                      <b>${paysNo}</b>
                    </Link>
                  </div>

                  <div className="card-foot">
                    <span>${total.toLocaleString("en-US")} Vol</span>
                    <span>Closes in <Countdown to={m.betting_closes_at} /></span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="tote">
            <div className="tote-head" aria-hidden="true">
              <span>Pool</span>
              <span>Question</span>
              <span>Pool split</span>
              <span>Take a side · pays per $1</span>
            </div>
            {gridMarkets.map((m) => (
              <MarketRow_ key={m.id} market={m} />
            ))}
          </div>
        )
      ) : (
        <div className="empty">
          <h3>No open markets found</h3>
          <p>Check back soon — new markets open regularly.</p>
          <Link className="btn sm" href="/app/markets" style={{ marginTop: 20, display: "inline-flex" }}>
            View all markets
          </Link>
        </div>
      )}

      {/* ── QUICK LINKS ── */}
      <div className="sec" style={{ marginTop: 52 }}>
        <h2>Quick links</h2>
      </div>
      <div className="qlinks">
        {QUICK_LINKS.map((q) => (
          <Link key={q.href} href={q.href} className="qlink">
            <span className="qlink-top">
              <b>{q.label}</b>
              <span className="qlink-arr" aria-hidden="true">→</span>
            </span>
            <p>{q.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
