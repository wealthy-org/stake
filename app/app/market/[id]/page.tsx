"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Coin from "@/components/Coin";
import Countdown from "@/components/Countdown";
import MarketChart from "@/components/Chart";
import TradePanel from "@/components/TradePanel";
import ResultSlip from "@/components/ResultSlip";
import { SkelDetail } from "@/components/Skeleton";
import { useWallet } from "@/components/providers";
import { getMarket, getPaperSummary } from "@/lib/client/api";
import { collateralToNumber, pct, short, usd } from "@/lib/client/format";
import type { MarketRow, PositionRow, BetRow } from "@/lib/client/types";

const COMPARISON_LABEL: Record<string, string> = {
  gt: "greater than (strictly above)",
  gte: "greater than or equal to",
  lt: "less than (strictly below)",
  lte: "less than or equal to",
};

interface PolymarketInfo {
  question: string;
  slug: string;
  image: string | null;
  description: string | null;
  active: boolean;
  closed: boolean;
  yesPrice: number | null;
  noPrice: number | null;
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate: string | null;
  polymarketUrl: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  oneDayPriceChange: number | null;
  resolutionSource: string | null;
}

function shortAddr(a: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { address } = useWallet();

  const [market, setMarket] = useState<MarketRow | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [emissionRate, setEmissionRate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"positions" | "bets">("positions");
  const [polymarketInfo, setPolymarketInfo] = useState<PolymarketInfo | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMarket(params.id);
      setMarket(data.market);
      setPositions(data.positions ?? []);
      setBets(data.bets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market");
    }
  }, [params.id]);

  useEffect(() => {
    load();
    getPaperSummary().then((p) => setEmissionRate(p.currentEmissionRatePerDollar)).catch(() => {});
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [load]);

  // Live enrichment straight from Polymarket's own API — real current
  // odds, volume, and a link back to the original market — refreshed
  // independently of our own market row, so it stays accurate as the
  // real Polymarket market keeps trading.
  useEffect(() => {
    if (!market || !isPolymarketSource(market.oracle_source)) {
      setPolymarketInfo(null);
      return;
    }
    const conditionId = market.oracle_source.split(":")[1];
    if (!conditionId) return;
    let active = true;
    const fetchInfo = () =>
      fetch(`/api/polymarket/${conditionId}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: PolymarketInfo) => {
          if (active) setPolymarketInfo(data);
        })
        .catch(() => {
          if (active) setPolymarketInfo(null);
        });
    fetchInfo();
    const timer = setInterval(fetchInfo, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [market?.id, market?.oracle_source]);

  const derived = useMemo(() => {
    if (!market) return null;
    const yes = collateralToNumber(market.yes_pool);
    const no = collateralToNumber(market.no_pool);
    const total = yes + no;
    const p = pct(yes, no);
    const paysYes = yes > 0 ? 1 + (no * 0.98) / yes : 1;
    const paysNo = no > 0 ? 1 + (yes * 0.98) / no : 1;
    return { yes, no, total, p, paysYes, paysNo, open: market.status === "open" };
  }, [market]);

  const initialSide = search.get("side") === "no" ? "no" : "yes";
  const [selSide, setSelSide] = useState<"yes" | "no">(initialSide);
  useEffect(() => {
    setSelSide(initialSide);
  }, [initialSide]);

  if (error) return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  if (!market || !derived) return <SkelDetail />;

  const { yes, no, p, paysYes, paysNo, open } = derived;
  const myPosition = positions.find((pos) => pos.address === address) ?? null;
  const openCount = positions.filter((pos) => collateralToNumber(pos.yes_stake) + collateralToNumber(pos.no_stake) > 0).length;

  function pickSide(side: "yes" | "no") {
    setSelSide(side);
    router.replace(`/app/market/${market!.id}?side=${side}`, { scroll: false });
    document.getElementById("trade-slip")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const rules: ReactNode = (
    <div className="rules">
      <p>
        <b>Question.</b> {market.question}
      </p>
      <p>
        <b>Comparison.</b> {COMPARISON_LABEL[market.comparison]} the strike {usd(Number(market.strike_price), 2)}.
        {(market.comparison === "gt" || market.comparison === "lt") &&
          " An exact match at the strike resolves the opposite side wins."}
      </p>
      <p>
        <b>Settlement.</b> After {new Date(market.resolution_timestamp).toUTCString()}, the verified Binance spot
        price for {market.asset_symbol} is read within a {market.resolution_window_sec}s window and the result is
        final — no admin can change it.
      </p>
      <p>
        <b>Payout.</b> Winners split the losing pool after a {(market.protocol_fee_bps / 100).toFixed(1)}% fee, in
        proportion to their stake. If the market can&rsquo;t be resolved safely (e.g. an empty side), every stake
        is refunded with no fee.
      </p>
    </div>
  );

  const meta = (
    <div className="mtable">
      <div>
        <span>Market ID</span>
        <b className="mono">{market.id}</b>
      </div>
      <div>
        <span>Oracle feed</span>
        <b>{market.oracle_source}</b>
      </div>
      <div>
        <span>Protocol fee</span>
        <b>{(market.protocol_fee_bps / 100).toFixed(1)}% of losing pool</b>
      </div>
      <div>
        <span>Bet bounds</span>
        <b>
          {usd(collateralToNumber(market.min_bet), 0)}–{usd(collateralToNumber(market.max_bet), 0)}
        </b>
      </div>
      <div>
        <span>Betting closes</span>
        <b>{new Date(market.betting_closes_at).toUTCString()}</b>
      </div>
      <div>
        <span>Resolution window</span>
        <b>{market.resolution_window_sec}s after {new Date(market.resolution_timestamp).toUTCString()}</b>
      </div>
      <div>
        <span>Created</span>
        <b>{new Date(market.created_at).toUTCString()}</b>
      </div>
    </div>
  );

  const betsList = (
    <div className="betlog">
      {bets.length === 0 ? (
        <p className="note">No bets recorded yet.</p>
      ) : (
        <>
          {bets
            .slice()
            .reverse()
            .slice(0, 50)
            .map((b) => (
              <div className="bl-row" key={b.id}>
                <span className="bl-time">{new Date(b.created_at).toLocaleTimeString("en-GB", { timeZone: "UTC" })}</span>
                <span className="bl-addr mono">{shortAddr(b.address)}</span>
                <span className={"bl-side " + b.side}>{b.side.toUpperCase()}</span>
                <b className="bl-amt">{usd(collateralToNumber(b.amount), 0)}</b>
              </div>
            ))}
          {bets.length > 50 && <p className="note">+{bets.length - 50} older bets…</p>}
        </>
      )}
    </div>
  );

  const positionsList = (
    <table className="pstable">
      <thead>
        <tr>
          <th>Bettor</th>
          <th>YES</th>
          <th>NO</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {openCount === 0 ? (
          <tr>
            <td colSpan={4}>No positions yet — be the first.</td>
          </tr>
        ) : (
          positions.map((pos) => {
            const y = collateralToNumber(pos.yes_stake);
            const n = collateralToNumber(pos.no_stake);
            if (y + n <= 0) return null;
            const mine = pos.address === address;
            return (
              <tr key={pos.address} style={mine ? { background: "rgba(31,43,163,.06)" } : undefined}>
                <td>
                  <span className="mono">{shortAddr(pos.address)}</span>
                  {mine && <span className="status open" style={{ marginLeft: 8 }}>You</span>}
                </td>
                <td style={{ color: y ? "var(--yes)" : undefined }}>{y ? usd(y, 0) : "—"}</td>
                <td style={{ color: n ? "var(--no)" : undefined }}>{n ? usd(n, 0) : "—"}</td>
                <td>{usd(y + n, 0)}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  let side2: ReactNode;
  if (open) {
    side2 = (
      <aside className="trade">
        <div className="slip" data-side={selSide} id="trade-slip">
          <TradePanel market={market} myPosition={myPosition} emissionRate={emissionRate} initialSide={selSide} onSideChange={setSelSide} onChanged={load} />
        </div>
      </aside>
    );
  } else if (market.status === "resolved") {
    side2 = (
      <aside className="trade">
        {address && myPosition && <ResultSlip market={market} position={myPosition} onChanged={load} />}
        <div className="blk" style={{ marginTop: address && myPosition ? 28 : 0 }}>
          <h3>{market.yes_won ? "YES" : "NO"} won</h3>
          <div className="ld">
            <span>Verified price</span>
            <i></i>
            <b>{usd(Number(market.resolved_price), 2)}</b>
          </div>
          <div className="ld">
            <span>Strike</span>
            <i></i>
            <b>{usd(Number(market.strike_price), 0)}</b>
          </div>
          <Link className="btn ghost block" style={{ marginTop: 14 }} href={`/app/proof/${market.id}`}>
            View the settlement record
          </Link>
        </div>
      </aside>
    );
  } else if (market.status === "cancelled") {
    side2 = (
      <aside className="trade">
        {address && myPosition && <ResultSlip market={market} position={myPosition} onChanged={load} />}
      </aside>
    );
  } else {
    side2 = (
      <aside className="trade">
        <div className="blk">
          <h3>Betting is closed</h3>
          <p>
            The pool is locked. Stake is waiting for a verified price at{" "}
            {new Date(market.resolution_timestamp).toUTCString()}.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <>
      <div className="crumb">
        <Link href="/app/markets">← Board</Link>
        <span>/</span>
        <span>No. {market.id.slice(-4)}</span>
      </div>
      <div className="detail">
        <div>
          <div className="dh">
            <Coin symbol={market.asset_symbol} />
            <div>
              <h1>{market.question}</h1>
              <div className="meta">
                <span>
                  Status <b>{open ? "Open" : market.status === "resolved" ? "Resolved" : market.status === "cancelled" ? "Cancelled" : "Awaiting oracle"}</b>
                </span>
                {isPolymarketSource(market.oracle_source) ? (
                  <span>
                    Oracle <b>Polymarket settlement</b>
                  </span>
                ) : (
                  <>
                    <span>
                      Strike <b>{usd(Number(market.strike_price), 0)}</b>
                    </span>
                    <span>
                      Oracle <b>{isStockSource(market.oracle_source) ? "Nasdaq tape" : "Binance spot price"}</b>
                    </span>
                  </>
                )}
                {open && (
                  <span>
                    Closes in <Countdown to={market.betting_closes_at} />
                  </span>
                )}
              </div>
            </div>
          </div>

          {open && (
            <div className="oh">
              <a
                href="#trade-slip"
                className={"oh-y" + (selSide === "yes" ? " on" : "")}
                onClick={(e) => {
                  e.preventDefault();
                  pickSide("yes");
                }}
              >
                <span>
                  <span className="side">YES {p}%</span>
                  <span className="pays">{usd(yes, 0)} in the pool</span>
                </span>
                <span className="paysnum">
                  pays <b>{paysYes.toFixed(2)}</b>
                </span>
              </a>
              <a
                href="#trade-slip"
                className={"oh-n" + (selSide === "no" ? " on" : "")}
                onClick={(e) => {
                  e.preventDefault();
                  pickSide("no");
                }}
              >
                <span>
                  <span className="side">NO {100 - p}%</span>
                  <span className="pays">{usd(no, 0)} in the pool</span>
                </span>
                <span className="paysnum">
                  pays <b>{paysNo.toFixed(2)}</b>
                </span>
              </a>
            </div>
          )}

          <div className="blk">
            <MarketChart market={market} />

            {isPolymarketSource(market.oracle_source) && polymarketInfo && (
              <>
                <div className="zeros" style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <div>
                    <small>Live odds</small>
                    <b>
                      {polymarketInfo.yesPrice !== null ? `${Math.round(polymarketInfo.yesPrice * 100)}% YES` : "—"}
                      {polymarketInfo.oneDayPriceChange !== null && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            marginLeft: 6,
                            color: polymarketInfo.oneDayPriceChange >= 0 ? "var(--yes)" : "var(--no)",
                          }}
                        >
                          {polymarketInfo.oneDayPriceChange >= 0 ? "+" : ""}
                          {(polymarketInfo.oneDayPriceChange * 100).toFixed(1)}pp · 24h
                        </span>
                      )}
                    </b>
                  </div>
                  <div>
                    <small>Total volume</small>
                    <b>{usd(polymarketInfo.volume, 0)}</b>
                  </div>
                  <div>
                    <small>24h volume</small>
                    <b>{usd(polymarketInfo.volume24hr, 0)}</b>
                  </div>
                  <div>
                    <small>Liquidity</small>
                    <b>{usd(polymarketInfo.liquidity, 0)}</b>
                  </div>
                  {polymarketInfo.bestBid !== null && polymarketInfo.bestAsk !== null && (
                    <div>
                      <small>Best bid / ask</small>
                      <b>
                        {(polymarketInfo.bestBid * 100).toFixed(1)}¢ / {(polymarketInfo.bestAsk * 100).toFixed(1)}¢
                      </b>
                    </div>
                  )}
                  {polymarketInfo.spread !== null && (
                    <div>
                      <small>Spread</small>
                      <b>{(polymarketInfo.spread * 100).toFixed(1)}¢</b>
                    </div>
                  )}
                </div>

                {polymarketInfo.description && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                    <small style={{ display: "block", marginBottom: 6, color: "var(--ink2)" }}>Resolution criteria</small>
                    <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink2)", whiteSpace: "pre-line" }}>
                      {polymarketInfo.description}
                    </p>
                    {polymarketInfo.resolutionSource && (
                      <a
                        href={polymarketInfo.resolutionSource}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12.5, display: "inline-block", marginTop: 8 }}
                      >
                        Resolution source ↗
                      </a>
                    )}
                  </div>
                )}
              </>
            )}

          </div>

          <div className="blk">
            <h3>Who is in this pool</h3>
            <div className="dtabs" role="tablist" aria-label="Market participants">
              <button role="tab" aria-selected={tab === "positions"} className={tab === "positions" ? "on" : ""} onClick={() => setTab("positions")}>
                Positions <span className="tab-count">{openCount}</span>
              </button>
              <button role="tab" aria-selected={tab === "bets"} className={tab === "bets" ? "on" : ""} onClick={() => setTab("bets")}>
                Bet log <span className="tab-count">{bets.length}</span>
              </button>
            </div>
            {tab === "positions" ? positionsList : betsList}
          </div>

          <div className="blk">
            <h3>Market facts</h3>
            {meta}
          </div>

          <div className="blk">
            <h3>Rules</h3>
            {rules}
          </div>
        </div>
        {side2}
      </div>
    </>
  );
}

function isStockSource(source: string): boolean {
  return source.startsWith("stock:");
}

function isPolymarketSource(source: string): boolean {
  return source.startsWith("polymarket:");
}
