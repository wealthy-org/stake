"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStats, listMarkets } from "@/lib/client/api";
import StatusPill from "@/components/StatusPill";
import { SkelStats } from "@/components/Skeleton";
import { CountUp } from "@/components/CountUp";
import { collateralToNumber, paperToNumber, short, usd } from "@/lib/client/format";
import type { ProtocolStats, MarketRow } from "@/lib/client/types";

export default function StatsPage() {
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [markets, setMarkets] = useState<MarketRow[]>([]);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    listMarkets().then(setMarkets).catch(() => {});
  }, []);

  if (!stats)
    return (
      <>
        <div className="sec" style={{ marginTop: 0 }}>
          <h2>The ledger</h2>
        </div>
        <SkelStats />
      </>
    );

  const largest = [...markets]
    .sort((a, b) => Number(b.yes_pool) + Number(b.no_pool) - (Number(a.yes_pool) + Number(a.no_pool)))
    .slice(0, 8);

  return (
    <>
      <div className="sec" style={{ marginTop: 0 }}>
        <h2>The ledger</h2>
      </div>
      <div className="facts lg" style={{ marginTop: 22 }}>
        <div>
          <b>
            <CountUp value={collateralToNumber(stats.totalWagered)} prefix="$" duration={1200} />
          </b>
          <small>Total wagered</small>
        </div>
        <div>
          <b>
            <CountUp value={collateralToNumber(stats.realizedNetLosses)} prefix="$" duration={1200} />
          </b>
          <small>Realized net losses</small>
        </div>
        <div>
          <b className="gd">
            <CountUp value={paperToNumber(stats.paperCreated)} duration={1400} />
          </b>
          <small>PAPER created</small>
        </div>
        <div>
          <b>
            <CountUp value={stats.uniqueBettors} duration={1000} />
          </b>
          <small>Bettors</small>
        </div>
        <div>
          <b>
            <CountUp value={collateralToNumber(stats.protocolFees)} prefix="$" duration={1000} />
          </b>
          <small>Protocol fees</small>
        </div>
      </div>

      <div className="blk" style={{ marginTop: 44 }}>
        <h3>Markets</h3>
        <div className="zeros" style={{ marginTop: 10 }}>
          <div>
            <small>Total markets</small>
            <b>{stats.totalMarkets}</b>
          </div>
          <div>
            <small>Active</small>
            <b>{stats.activeMarkets}</b>
          </div>
          <div>
            <small>Resolved</small>
            <b>{stats.resolvedMarkets}</b>
          </div>
          <div>
            <small>Avg. pool</small>
            <b>{stats.totalMarkets ? short(collateralToNumber(stats.totalWagered) / stats.totalMarkets) : "$0"}</b>
          </div>
        </div>
      </div>

      <div className="blk scroll">
        <h3>Largest markets</h3>
        <table>
          <thead>
            <tr>
              <th>Market</th>
              <th>Pool</th>
              <th>Bettors</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {largest.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/market/${m.id}`}>{m.question}</Link>
                </td>
                <td>{short(collateralToNumber(m.yes_pool) + collateralToNumber(m.no_pool))}</td>
                <td>{m.bettor_count ?? 0}</td>
                <td>
                  <StatusPill market={m} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
