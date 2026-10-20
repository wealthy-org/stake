"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listMarkets, getStats } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd } from "@/lib/client/format";
import type { MarketRow, ProtocolStats } from "@/lib/client/types";
import MarketRow_ from "@/components/MarketRow";
import { SkelFacts, SkelBoard } from "@/components/Skeleton";
import { CountUp } from "@/components/CountUp";
import { useWallet } from "@/components/providers";

const QUICK_LINKS = [
  { href: "/app/portfolio", label: "Portfolio", desc: "Your open bets and claims" },
  { href: "/app/paper", label: "STAKE supply", desc: "Genesis, emission rate" },
  { href: "/app/activity", label: "Activity", desc: "Live protocol events" },
  { href: "/app/stats", label: "Ledger", desc: "Global protocol stats" },
] as const;

/**
 * This is the app-shell home — a functional dashboard for a connected
 * session, not a second pitch. The "win the bet / lose into ownership"
 * explainer, the 3-step walkthrough, and the anti-farming notice already
 * live on the public landing page (app/page.tsx); repeating them here for
 * every returning user was pure redundancy.
 */
export default function Dashboard() {
  const { address, summary } = useWallet();
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [stats, setStats] = useState<ProtocolStats | null>(null);

  useEffect(() => {
    listMarkets().then(setMarkets).catch(() => setMarkets([]));
    getStats().then(setStats).catch(() => {});
  }, []);

  const topMarkets = useMemo(
    () =>
      (markets ?? [])
        .filter((m) => m.status === "open")
        .sort((a, b) => Number(b.yes_pool) + Number(b.no_pool) - (Number(a.yes_pool) + Number(a.no_pool)))
        .slice(0, 5),
    [markets]
  );
  const totalOpen = (markets ?? []).filter((m) => m.status === "open").length;

  const openPositions = (summary?.positions ?? []).filter((p) => p.status !== "resolved" && p.status !== "cancelled");
  const claimable = (summary?.positions ?? []).filter(
    (p) => (p.status === "resolved" || p.status === "cancelled") && !p.payout_claimed
  ).length;

  return (
    <>
      <div className="sec" style={{ marginTop: 0 }}>
        <div>
          <h2>Dashboard</h2>
          <p style={{ color: "var(--ink2)", fontSize: 14, marginTop: 4 }}>Live markets and your account at a glance.</p>
        </div>
      </div>

      {address ? (
        summary ? (
          <div className="facts">
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
          <SkelFacts />
        )
      ) : (
        <div className="empty" style={{ marginTop: 24 }}>
          <h3>No wallet connected</h3>
          <p>Connect a wallet to see your balance, open positions, and claimable slips here.</p>
        </div>
      )}

      <div className="sec">
        <div>
          <h2>Top markets</h2>
          <p style={{ color: "var(--ink2)", fontSize: 14, marginTop: 4 }}>
            {stats ? `${stats.activeMarkets} open · ${stats.totalMarkets} total` : "By pool size, open for betting"}
          </p>
        </div>
        <Link href="/app/markets" className="btn ghost sm">
          Browse all markets ↗
        </Link>
      </div>
      {markets === null ? (
        <SkelBoard rows={3} />
      ) : topMarkets.length > 0 ? (
        <>
          <div className="board">
            {topMarkets.map((m) => (
              <MarketRow_ key={m.id} market={m} />
            ))}
          </div>
          {totalOpen > topMarkets.length && (
            <div className="board-more">
              <Link href="/app/markets" className="btn ghost sm">
                +{totalOpen - topMarkets.length} more open markets →
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="empty">
          <h3>No open markets right now</h3>
          <p>Check back soon — new markets open regularly.</p>
          <Link className="btn sm" href="/app/markets" style={{ marginTop: 20, display: "inline-flex" }}>
            View all markets
          </Link>
        </div>
      )}

      <div className="sec">
        <h2>Quick links</h2>
      </div>
      <div className="steps-showcase" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {QUICK_LINKS.map((q) => (
          <Link key={q.href} href={q.href} className="step-card" style={{ textDecoration: "none" }}>
            <h4>{q.label}</h4>
            <p>{q.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
