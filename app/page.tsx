"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStats, getPaperSummary } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd } from "@/lib/client/format";
import { previewSettle } from "@/lib/client/estimate";
import type { ProtocolStats, PaperSummary } from "@/lib/client/types";
import { CountUp } from "@/components/CountUp";

/**
 * Illustrative-only hero simulator — no live market data, no wallet, no
 * bet is ever placed from here. Mirrors the brief's own §6 example question
 * so a first-time visitor sees a concrete YES/NO price question before ever
 * launching the app. The real, data-backed simulator lives at /app.
 */
const TOTE_ROWS = [
  { side: "ETH > $5,000", pool: "$100,000", shr: "60%", pays: "1.65" },
  { side: "BTC > $150,000", pool: "$100,000", shr: "45%", pays: "2.20" },
  { side: "SOL > $300", pool: "$100,000", shr: "52%", pays: "1.90" },
] as const;

function ToteBoard() {
  return (
    <div className="tboard">
      <div className="tboard-strip">
        <span>
          <span className="tboard-lamp"></span>Stake tote · example pools
        </span>
        <span>1 / 3</span>
      </div>
      <div className="tboard-cols">
        <span>SIDE</span>
        <span>POOL</span>
        <span>SHR</span>
        <span>PAYS/$1</span>
      </div>
      {TOTE_ROWS.map((row) => (
        <div className="tboard-row" key={row.side}>
          <span className="tboard-cell gold">{row.side}</span>
          <span className="tboard-cell dim">{row.pool}</span>
          <span className="tboard-cell dim">{row.shr}</span>
          <span className="tboard-cell">{row.pays}</span>
        </div>
      ))}
      <div className="tboard-strip" style={{ marginTop: 6 }}>
        <span>Pays incl. stake · 2% example fee</span>
        <span>No live bets</span>
      </div>
    </div>
  );
}

function IllustrativeSim() {
  const [side, setSide] = useState<"yes" | "no" | "both">("yes");
  const [wins, setWins] = useState<"yes" | "no">("no");
  const [amt, setAmt] = useState(100);

  const yesPool = 60_000;
  const noPool = 40_000;
  const ys = side === "yes" || side === "both" ? amt : 0;
  const ns = side === "no" || side === "both" ? amt : 0;
  const r = previewSettle(yesPool + ys, noPool + ns, ys, ns, wins, 200, 18.4);
  const won = r.pnl > 0.005;
  const lost = r.loss > 0.005;

  return (
    <>
      <div className="ticket-wrap">
        <div className="ticket">
          <div className="t-head">
            <span>Stake · pool ticket</span>
            <span>Example</span>
          </div>
          <div className="t-row">
            <span>Pool</span>
            <i></i>
            <b>ETH/USD</b>
          </div>
          <div className="t-row">
            <span>Question</span>
            <i></i>
            <b>Above $5,000?</b>
          </div>
          <div className="t-side">
            <strong>{side === "both" ? "Y/N" : side.toUpperCase()}</strong>
            <span>Your view</span>
          </div>
          <div className="t-row">
            <span>{side === "both" ? "Stake each" : "Stake"}</span>
            <i></i>
            <b>{usd(amt, 2)}</b>
          </div>
          <div className="t-row">
            <span>Market</span>
            <i></i>
            <b>{wins.toUpperCase()} wins</b>
          </div>
          <div className="t-sep"></div>
          {won ? (
            <div className="t-row">
              <span>Payout</span>
              <i></i>
              <b>{usd(r.payout)}</b>
            </div>
          ) : lost ? (
            <div className="t-row">
              <span>Net loss</span>
              <i></i>
              <b>{usd(r.loss)}</b>
            </div>
          ) : (
            <div className="t-row">
              <span>Payout</span>
              <i></i>
              <b>{usd(r.payout)}</b>
            </div>
          )}
          <div className="barcode"></div>
          <div className="t-foot">Illustrative example · not a bet</div>
          {won && <span className="stamp won">Paid</span>}
          {lost && <span className="stamp lost">Net loss</span>}
        </div>
      </div>
      <p className="why" style={{ margin: "14px 0", fontSize: 13, color: "var(--ink2)" }}>
        {won
          ? `Your ${usd(r.total, 0)} stake back plus ${usd(r.profit)} from the losing pool. You claim money.`
          : lost
            ? "Your verified net loss sets the STAKE you can claim."
            : "No net loss, so no STAKE is created."}
      </p>
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
      <p className="note">Illustrative $60,000/$40,000 example pool with a 2% fee. No wallet, no real stake.</p>
    </>
  );
}

function PublicNav() {
  return (
    <>
      <header className="wrap deskbar">
        <Link className="brand" href="/" aria-label="Stake home">
          <i className="mark"></i>Stake
        </Link>
        <span className="pill net" title="Robinhood Chain Testnet, chain ID 46630">
          <i></i>Testnet 46630
        </span>
        <Link className="btn conn paper" href="/app">
          Launch App
        </Link>
      </header>
      <div className="wrap">
        <nav className="folder" aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#genesis">Genesis</a>
          <Link href="/app/markets">Markets</Link>
        </nav>
      </div>
    </>
  );
}

export default function LandingPage() {
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [paper, setPaper] = useState<PaperSummary | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    getPaperSummary().then(setPaper).catch(() => {});
  }, []);

  return (
    <>
      <PublicNav />
      <div className="wrap">
        <main className="sheet">
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
                <Link className="btn big" href="/app">
                  Launch App →
                </Link>
                <a className="btn big ghost" href="#how">
                  How it works
                </a>
              </div>
            </div>
            <div className="slipcol">
              <ToteBoard />
              <div className="sim-card">
                <div className="sim-badge">
                  <span className="dot-pulse"></span>
                  <span>ILLUSTRATIVE EXAMPLE</span>
                </div>
                <IllustrativeSim />
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
                  <CountUp value={paper ? paperToNumber(paper.supply) : 0} duration={1400} />
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
          ) : null}

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

          <section id="how" className="steps-showcase">
            <div className="step-card">
              <div className="step-num">01</div>
              <h4>Deposit Collateral</h4>
              <p>Commit approved stablecoins directly into objective binary prediction pools. No counterparty risk, no protocol LP.</p>
            </div>
            <div className="step-card">
              <div className="step-num">02</div>
              <h4>Decentralized Resolution</h4>
              <p>Price outcomes resolve deterministically via a verified oracle price at immutable timestamps. Results cannot be modified.</p>
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
              <b>Betting both sides?</b> Allowed. Your total payout is compared against your total stake, and STAKE
              is strictly minted on <i>net realized loss</i>. Hedging cannot farm protocol ownership.
            </p>
          </div>

          <section id="genesis" className="certbig" style={{ marginTop: 56 }}>
            <div className="k">Certificate of ownership</div>
            <h1>{paper ? Math.round(paperToNumber(paper.supply)).toLocaleString("en-US") : "0"}</h1>
            <p>
              STAKE exists only because bettors lost real money. No premint, no team allocation, no admin who can
              mint — supply enters only through verified realized losses.
            </p>
            <span className="serial">Supply today</span>
            <span className="stamp gold">{paper?.transfersEnabled ? "Transfers enabled" : "Transfers locked"}</span>
          </section>

          <div className="page-foot">
            <span>Concept preview. No real money. Interactive examples only.</span>
            <Link className="next" href="/app">
              Launch the app →
            </Link>
          </div>
        </main>
      </div>
      <footer>
        <div className="wrap">
          <p>
            Stake is a backend-logic preview on Robinhood Chain Testnet. Every balance here is a virtual testnet
            balance — no real funds move yet. You can lose your entire stake, and pool share is not a probability.
          </p>
          <p>Settlement price comes from Binance spot data for this phase. Payouts come only from the losing pool.</p>
        </div>
      </footer>
    </>
  );
}
