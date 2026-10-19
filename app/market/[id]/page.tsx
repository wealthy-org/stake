"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Coin from "@/components/Coin";
import Countdown from "@/components/Countdown";
import { ChartSVG } from "@/components/Chart";
import TradePanel from "@/components/TradePanel";
import ResultSlip from "@/components/ResultSlip";
import { SkelDetail } from "@/components/Skeleton";
import { useWallet } from "@/components/providers";
import { getMarket, getPaperSummary } from "@/lib/client/api";
import { collateralToNumber, pct, short, usd } from "@/lib/client/format";
import type { MarketRow, PositionRow } from "@/lib/client/types";

const COMPARISON_LABEL: Record<string, string> = {
  gt: "greater than (strictly above)",
  gte: "greater than or equal to",
  lt: "less than (strictly below)",
  lte: "less than or equal to",
};

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { address } = useWallet();

  const [market, setMarket] = useState<MarketRow | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [emissionRate, setEmissionRate] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getMarket(params.id);
      setMarket(data.market);
      setPositions(data.positions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market");
    }
  }, [params.id]);

  useEffect(() => {
    load();
    getPaperSummary().then((p) => setEmissionRate(p.currentEmissionRatePerDollar)).catch(() => {});
  }, [load]);

  if (error) return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  if (!market) return <SkelDetail />;

  const myPosition = positions.find((p) => p.address === address) ?? null;
  const yes = collateralToNumber(market.yes_pool);
  const no = collateralToNumber(market.no_pool);
  const p = pct(yes, no);
  const open = market.status === "open";
  const initialSide = search.get("side") === "no" ? "no" : "yes";

  const rules = (
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

  let side2: ReactNode;
  if (open) {
    side2 = (
      <aside className="trade">
        <div className="slip" data-side={initialSide}>
          <TradePanel market={market} myPosition={myPosition} emissionRate={emissionRate} initialSide={initialSide} onChanged={load} />
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
          <Link className="btn ghost block" style={{ marginTop: 14 }} href={`/proof/${market.id}`}>
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
            The pool is locked. Paper Bet is waiting for a verified price at{" "}
            {new Date(market.resolution_timestamp).toUTCString()}.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <>
      <div className="crumb">
        <Link href="/">Board</Link>
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
                  Status <b>{market.status === "open" ? "Open" : market.status === "resolved" ? "Resolved" : market.status === "cancelled" ? "Cancelled" : "Awaiting oracle"}</b>
                </span>
                <span>
                  Strike <b>{usd(Number(market.strike_price), 0)}</b>
                </span>
                <span>
                  Oracle <b>Binance spot price</b>
                </span>
                {open && (
                  <span>
                    Closes in <Countdown to={market.betting_closes_at} />
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="blk">
            <h3>Where the money sits</h3>
            <div className="big-share">
              <div className="y">
                <b>{short(yes)}</b>
                <small>YES, {p}% of the pool</small>
              </div>
              <div className="n">
                <b>{short(no)}</b>
                <small>NO, {100 - p}% of the pool</small>
              </div>
            </div>
            <div className="poolbar lg">
              <i style={{ width: `${p}%` }}></i>
            </div>
            <ChartSVG marketId={market.id} yesPct={p} />
            <p className="note">Pool share shows where money sits. It is not a calibrated probability.</p>
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
