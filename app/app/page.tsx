"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listMarkets, getStats, getPaperSummary } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd, num } from "@/lib/client/format";
import { previewSettle } from "@/lib/client/estimate";
import type { MarketRow, ProtocolStats, PaperSummary } from "@/lib/client/types";
import MarketRow_ from "@/components/MarketRow";
import { SkelHero, SkelFacts, SkelBoard } from "@/components/Skeleton";
import { CountUp } from "@/components/CountUp";



function HeroSim({ market, emissionRate }: { market: MarketRow | null; emissionRate: number }) {
  const [side, setSide] = useState<"yes" | "no" | "both">("yes");
  const [wins, setWins] = useState<"yes" | "no">("no");
  const [amt, setAmt] = useState(100);

  if (!market) {
    return (
      <div className="slip">
        <div className="slip-h">
          <b>Bet slip</b>
        </div>
        <p style={{ padding: "16px 0", color: "var(--ink2)" }}>No open market yet to preview against.</p>
      </div>
    );
  }

  const yesPool = collateralToNumber(market.yes_pool);
  const noPool = collateralToNumber(market.no_pool);
  const ys = side === "yes" || side === "both" ? amt : 0;
  const ns = side === "no" || side === "both" ? amt : 0;
  const r = previewSettle(yesPool + ys, noPool + ns, ys, ns, wins, market.protocol_fee_bps, emissionRate);
  const won = r.pnl > 0.005;
  const lost = r.loss > 0.005;

  return (
    <>
      <div className="slip" data-side={side === "both" ? "" : side}>
        <div className="slip-h">
          <b>Bet slip</b>
          <span className="no">No. {market.id.slice(-4)}</span>
        </div>
        <div className="slip-q">{market.question}</div>
        <div className="fl">
          <span>Your pick</span>
          <span className="fill">{side === "both" ? "YES and NO" : side.toUpperCase()}</span>
        </div>
        <div className="fl">
          <span>{side === "both" ? "Stake each" : "Stake"}</span>
          <span className="fill">{usd(amt, 2)}</span>
        </div>
        <div className="fl">
          <span>Result</span>
          <span className="fill">{wins.toUpperCase()} wins</span>
        </div>
        <div className="perf"></div>
        <div className="stubzone">
          <div className="stub">
            {won ? (
              <>
                <small>To collect</small>
                <div className="amt">{usd(r.payout)}</div>
                <div className="why">
                  Your {usd(r.total, 0)} stake back plus {usd(r.profit)} from the losing pool. You claim money.
                </div>
              </>
            ) : lost ? (
              <>
                <small>Net loss</small>
                <div className="amt zero">{usd(r.loss)}</div>
                <div className="why">
                  {side === "both"
                    ? `Issued on a net loss of ${usd(r.loss)} after both sides settle.`
                    : `Your verified net loss sets the STAKE you can claim: ${num(r.paper)} STAKE.`}
                </div>
              </>
            ) : (
              <>
                <small>To collect</small>
                <div className="amt zero">{usd(r.payout)}</div>
                <div className="why">No net loss, so no STAKE is created.</div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="ctl">
        <div>
          <label>Your pick</label>
          <div className="seg">
            {(["yes", "no", "both"] as const).map((k) => (
              <button
                key={k}
                className={(side === k ? "on " : "") + (k === "yes" ? "y" : k === "no" ? "n" : "")}
                onClick={() => setSide(k)}
              >
                {k === "both" ? "Both sides" : k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label>Market resolves</label>
          <div className="seg">
            <button className={wins === "yes" ? "on y" : ""} onClick={() => setWins("yes")}>
              YES wins
            </button>
            <button className={wins === "no" ? "on n" : ""} onClick={() => setWins("no")}>
              NO wins
            </button>
          </div>
        </div>
        <div className="full">
          <label>{side === "both" ? "Stake on each side" : "Stake"}</label>
          <div className="amtrow">
            <input type="range" min={10} max={1000} step={10} value={amt} onChange={(e) => setAmt(Number(e.target.value))} />
            <output>{usd(amt, 0)}</output>
          </div>
        </div>
      </div>
      <p className="note">
        Uses the live pools of this market with its {(market.protocol_fee_bps / 100).toFixed(1)}% fee on the losing
        pool. Your stake is added to the pool first.
      </p>
    </>
  );
}

export default function Home() {
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [paper, setPaper] = useState<PaperSummary | null>(null);


  useEffect(() => {
    listMarkets().then(setMarkets).catch(() => setMarkets([]));
    getStats().then(setStats).catch(() => {});
    getPaperSummary().then(setPaper).catch(() => {});
  }, []);

  const heroMarket = useMemo(
    () =>
      (markets ?? [])
        .filter((m) => m.status === "open")
        .sort((a, b) => Number(b.yes_pool) + Number(b.no_pool) - (Number(a.yes_pool) + Number(a.no_pool)))[0] ?? null,
    [markets]
  );

  const emissionRate = paper?.currentEmissionRatePerDollar ?? 0;

  if (markets === null) {
    return (
      <>
        <SkelHero />
        <SkelFacts />
        <div className="sec">
          <h2>The board</h2>
        </div>
        <SkelBoard />
      </>
    );
  }

  return (
    <>
      <section className="hero">
        <div>
          <span className="hero-kicker">
            <i></i>Live on Robinhood Chain Testnet
          </span>
          <h1>
            <span>Win the bet.</span>
            <span>Lose into ownership.</span>
          </h1>
          <p className="lede">
            A prediction market where realized losses create protocol ownership. Bet YES or NO on price
            questions, settled on Robinhood Chain testnet.
          </p>
          <p className="note" style={{ marginTop: -14, marginBottom: 20 }}>
            A loss stays a loss. STAKE isn&rsquo;t a refund.
          </p>
          <div className="cta">
            {heroMarket && (
              <Link className="btn big" href={`/app/market/${heroMarket.id}`}>
                Trade {heroMarket.asset_symbol} Market
              </Link>
            )}
            <a className="btn big paper" href="#board">
              Browse All Markets ↓
            </a>
            <Link className="btn big ghost" href="/app/paper">
              How STAKE Works
            </Link>
          </div>
        </div>
        <div className="slipcol">
          <div className="sim-card">
            <div className="sim-badge">
              <span className="dot-pulse"></span>
              <span>INTERACTIVE SIMULATOR</span>
            </div>
            <HeroSim market={heroMarket} emissionRate={emissionRate} />
          </div>
        </div>
      </section>

      {stats ? (
        <div className="facts">
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
            <small>STAKE created</small>
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
      ) : (
        <SkelFacts />
      )}

      <section className="ledger">
        <div className="lcol w">
          <h3>If you win</h3>
          <div className="stmt">You claim money.</div>
          <p>Your stake comes back, plus your share of the losing pool. The protocol is never the counterparty.</p>
        </div>
        <div className="lcol l">
          <h3>If you lose</h3>
          <div className="stmt">You claim STAKE.</div>
          <p>You lose the bet. Your verified net loss, not your gross stake, decides how much STAKE you can claim.</p>
        </div>
      </section>

      {/* --- HOW IT WORKS 3-STEP PILLARS --- */}
      <section className="steps-showcase">
        <div className="step-card">
          <div className="step-num">01</div>
          <h4>Deposit Collateral</h4>
          <p>Commit approved stablecoins directly into objective binary prediction pools. No counterparty risk, no protocol LP.</p>
        </div>
        <div className="step-card">
          <div className="step-num">02</div>
          <h4>Decentralized Resolution</h4>
          <p>Price outcomes resolve deterministically via signed Chainlink oracles at immutable timestamps. Results cannot be modified.</p>
        </div>
        <div className="step-card">
          <div className="step-num">03</div>
          <h4>Loss Into Ownership</h4>
          <p>Winners claim losing pool profits pro-rata. Net realized losers claim immutable protocol ownership via $STAKE tokens.</p>
        </div>
      </section>

      <div className="hedge-box">
        <div className="hedge-badge">ANTI-FARMING INVARIANT</div>
        <p>
          <b>Betting both sides?</b> Allowed. Your total payout is compared against your total stake, and STAKE is strictly minted on <i>net realized loss</i>. Hedging cannot farm protocol ownership.
        </p>
      </div>

      <div id="board" className="sec">
        <div>
          <h2>The board</h2>
          <p style={{ color: "var(--ink2)", fontSize: 14, marginTop: 4 }}>
            Live markets open for betting right now
          </p>
        </div>
        <Link href="/app/markets" className="btn ghost sm">
          Browse all markets ↗
        </Link>
      </div>
      {markets === null ? (
        <SkelBoard rows={3} />
      ) : (() => {
        const featured = (markets ?? [])
          .filter((m) => m.status === "open")
          .sort((a, b) => Number(b.yes_pool) + Number(b.no_pool) - (Number(a.yes_pool) + Number(a.no_pool)))
          .slice(0, 5);
        const totalOpen = (markets ?? []).filter((m) => m.status === "open").length;
        return featured.length > 0 ? (
          <>
            <div className="board">
              {featured.map((m) => (
                <MarketRow_ key={m.id} market={m} />
              ))}
            </div>
            {totalOpen > 5 && (
              <div className="board-more">
                <Link href="/app/markets" className="btn ghost sm">
                  +{totalOpen - 5} more open markets →
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
        );
      })()}
    </>
  );
}
