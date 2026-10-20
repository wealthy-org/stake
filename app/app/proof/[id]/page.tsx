"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getMarket } from "@/lib/client/api";
import { collateralToNumber, usd } from "@/lib/client/format";
import { SkelProof } from "@/components/Skeleton";
import type { MarketRow } from "@/lib/client/types";

const COMPARISON_LABEL: Record<string, string> = {
  gt: "greater than",
  gte: "greater than or equal to",
  lt: "less than",
  lte: "less than or equal to",
};

export default function ProofPage() {
  const params = useParams<{ id: string }>();
  const [market, setMarket] = useState<MarketRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMarket(params.id)
      .then((d) => setMarket(d.market))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [params.id]);

  if (error) return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  if (!market) return <SkelProof />;

  if (market.status !== "resolved") {
    return (
      <>
        <div className="crumb">
          <Link href="/app">Board</Link>
          <span>/</span>
          <Link href={`/app/market/${market.id}`}>No. {market.id.slice(-4)}</Link>
          <span>/</span>
          <span>Settlement record</span>
        </div>
        <p style={{ color: "var(--ink2)" }}>
          This market is {market.status === "cancelled" ? "cancelled" : "not resolved yet"} — there is no
          settlement record to show.
        </p>
      </>
    );
  }

  const win = collateralToNumber(market.yes_won ? market.yes_pool : market.no_pool);
  const losing = collateralToNumber(market.yes_won ? market.no_pool : market.yes_pool);
  const fee = collateralToNumber(market.protocol_fee);
  const net = collateralToNumber(market.net_losing_pool);

  return (
    <>
      <div className="crumb">
        <Link href="/app">Board</Link>
        <span>/</span>
        <Link href={`/app/market/${market.id}`}>No. {market.id.slice(-4)}</Link>
        <span>/</span>
        <span>Settlement record</span>
      </div>
      <div className="record">
        <div className="slip">
          <div className="slip-h">
            <b style={{ fontSize: 34 }}>Settlement record</b>
            <span className="no">No. {market.id.slice(-4)}</span>
          </div>
          <p className="slip-q" style={{ fontSize: 20, margin: "10px 0 14px" }}>
            {market.question}
          </p>

          <div className="ld">
            <span>Comparison</span>
            <i></i>
            <b>{COMPARISON_LABEL[market.comparison]}</b>
          </div>
          <div className="ld">
            <span>Strike</span>
            <i></i>
            <b>{usd(Number(market.strike_price), 2)}</b>
          </div>
          <div className="ld">
            <span>Oracle feed</span>
            <i></i>
            <b>{market.oracle_source}</b>
          </div>
          <div className="ld">
            <span>Resolution due</span>
            <i></i>
            <b>{new Date(market.resolution_timestamp).toUTCString()}</b>
          </div>
          <div className="ld">
            <span>Report observed</span>
            <i></i>
            <b>{market.report_timestamp ? new Date(market.report_timestamp).toUTCString() : "—"}</b>
          </div>
          <div className="ld">
            <span>Verified price</span>
            <i></i>
            <b>{usd(Number(market.resolved_price), 2)}</b>
          </div>
          <div className="ld">
            <span>Winning side</span>
            <i></i>
            <b>{market.yes_won ? "YES" : "NO"}</b>
          </div>

          <div style={{ height: 12 }}></div>

          <div className="ld">
            <span>YES pool</span>
            <i></i>
            <b>{usd(collateralToNumber(market.yes_pool), 0)}</b>
          </div>
          <div className="ld">
            <span>NO pool</span>
            <i></i>
            <b>{usd(collateralToNumber(market.no_pool), 0)}</b>
          </div>
          <div className="ld">
            <span>Protocol fee ({(market.protocol_fee_bps / 100).toFixed(1)}% of losing pool)</span>
            <i></i>
            <b>{usd(fee, 0)}</b>
          </div>
          <div className="ld">
            <span>Net distributed to winners</span>
            <i></i>
            <b>{usd(net, 0)}</b>
          </div>
          <div className="ld">
            <span>Winning pool</span>
            <i></i>
            <b>{usd(win, 0)}</b>
          </div>

          <span className="stamp acc">Verified</span>

          <div className="perf"></div>
          <div style={{ padding: "22px 0 26px" }}>
            <div className="verified" style={{ marginBottom: 14 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Resolved from a verified Binance spot observation. Final, cannot be changed.
            </div>
            <ol className="calc">
              <li>
                The market closed for bets and waited for the resolution time, <b>{new Date(market.resolution_timestamp).toUTCString()}</b>.
              </li>
              <li>
                A spot price for <b>{market.asset_symbol}/USD</b> was read inside the {market.resolution_window_sec}s
                resolution window.
              </li>
              <li>
                The verified price <b>{usd(Number(market.resolved_price), 2)}</b> is {market.yes_won ? "" : "not "}
                {COMPARISON_LABEL[market.comparison]} the strike <b>{usd(Number(market.strike_price), 2)}</b>, so{" "}
                <b>{market.yes_won ? "YES" : "NO"}</b> wins.
              </li>
              <li>
                Losers&rsquo; {usd(losing, 0)} minus the {usd(fee, 0)} fee is shared by winners in proportion to
                their stake.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
