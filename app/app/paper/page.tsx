"use client";

import { useEffect, useState } from "react";
import { SkelPaper } from "@/components/Skeleton";
import { getPaperSummary, getStats, listMarkets } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd } from "@/lib/client/format";
import type { PaperSummary, MarketRow, ProtocolStats } from "@/lib/client/types";

const MILESTONES = (totalWagered: number, cumulativeLoss: number, bettors: number, marketsCreated: number, transfersEnabled: boolean) => [
  ["First market", marketsCreated > 0 ? 1 : 0],
  ["First $10K wagered", totalWagered >= 10_000 ? 1 : 0],
  ["First STAKE mint", cumulativeLoss > 0 ? 1 : 0],
  ["First $100K realized loss", cumulativeLoss >= 100_000 ? 1 : 0],
  ["First 1,000 bettors", bettors >= 1000 ? 1 : 0],
  ["Genesis complete", transfersEnabled ? 1 : 0],
  ["Transfers enabled", transfersEnabled ? 1 : 0],
] as const;

function EmissionCurve({ cumulativeLoss, rate }: { cumulativeLoss: number; rate: number }) {
  const W = 640, H = 240, pl = 40, pb = 26, max = Math.max(3_000_000, cumulativeLoss * 1.5);
  // Illustrative only — mirrors the shape of lib/engine/emission.ts's testnet
  // tiers (steep early, flattening out), not a literal re-plot of the
  // piecewise function. The real tiers are shown as text under the chart.
  const R0 = 100;
  const K = 100_000;
  const x = (c: number) => pl + (c / max) * (W - pl - 10);
  const y = (r: number) => 10 + (1 - r / R0) * (H - 10 - pb);
  let d = "";
  for (let c = 0; c <= max; c += max / 60) {
    d += `${c ? "L" : "M"}${x(c).toFixed(1)} ${y(R0 / (1 + c / K)).toFixed(1)} `;
  }
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Illustrative emission rate falling as cumulative realized losses grow">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - 10} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={0} y={y(v) + 4}>{v}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--gold-d)" strokeWidth={2.6} />
      <line x1={x(cumulativeLoss)} x2={x(cumulativeLoss)} y1={10} y2={H - pb} stroke="var(--ink)" strokeDasharray="3 4" />
      <circle cx={x(cumulativeLoss)} cy={y(Math.min(rate, R0))} r={5} fill="var(--gold-d)" />
      <text x={x(cumulativeLoss) + 10} y={y(Math.min(rate, R0)) - 10} style={{ fontWeight: 700, fill: "var(--ink)" }}>
        Now: {rate} STAKE per $1
      </text>
      <text x={pl} y={H - 6}>$0 realized losses</text>
      <text x={W - 10} y={H - 6} textAnchor="end">${(max / 1e6).toFixed(1)}M</text>
    </svg>
  );
}

export default function PaperPage() {
  const [paper, setPaper] = useState<PaperSummary | null>(null);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [stats, setStats] = useState<ProtocolStats | null>(null);

  useEffect(() => {
    getPaperSummary().then(setPaper).catch(() => {});
    listMarkets().then(setMarkets).catch(() => {});
    getStats().then(setStats).catch(() => {});
  }, []);

  if (!paper) return <SkelPaper />;

  const supply = paperToNumber(paper.supply);
  const cumulativeLoss = collateralToNumber(paper.cumulativeRealizedLoss);
  const totalWagered = stats ? collateralToNumber(stats.totalWagered) : 0;
  const uniqueBettors = stats?.uniqueBettors ?? 0;

  return (
    <>
      <div className="certbig">
        <div className="k">Certificate of ownership</div>
        <h1>{Math.round(supply).toLocaleString("en-US")}</h1>
        <p>
          STAKE exists only because bettors lost real money. It enters supply through verified realized losses,
          with no team allocation, no premint and no admin who can mint.
        </p>
        <span className="serial">Supply today</span>
        <span className="stamp gold">{paper.transfersEnabled ? "Transfers enabled" : "Transfers locked"}</span>
      </div>

      <div className="zeros">
        <div>
          <small>Genesis supply</small>
          <b>0</b>
        </div>
        <div>
          <small>Team allocation</small>
          <b>0</b>
        </div>
        <div>
          <small>VC allocation</small>
          <b>0</b>
        </div>
        <div>
          <small>Airdrop</small>
          <b>0</b>
        </div>
      </div>

      <div className="two">
        <div className="blk">
          <h3>Emission rate</h3>
          <p style={{ fontSize: 14 }}>
            Cumulative realized losses so far are {usd(cumulativeLoss, 0)}. The rate for each dollar of net loss
            falls as that total grows.
          </p>
          <EmissionCurve cumulativeLoss={cumulativeLoss} rate={paper.currentEmissionRatePerDollar} />
          <p className="note">
            Illustrative curve shape. Real tiers (testnet-only, not approved mainnet tokenomics — brief §16):
            100 STAKE/$ up to $100K, 40/$ to $1M, 10/$ to $10M, 3/$ beyond.
          </p>
        </div>
        <div className="blk">
          <h3>Genesis progress</h3>
          <ul className="tl">
            {MILESTONES(totalWagered, cumulativeLoss, uniqueBettors, markets.length, paper.transfersEnabled).map(([label, done]) => (
              <li key={label} className={done ? "done" : ""}>
                <i></i>
                <b>{label}</b>
                <small>{done ? "Reached" : "Not yet"}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
