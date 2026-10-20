"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import "./landing.css";
import { getStats, getPaperSummary, listMarkets } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd } from "@/lib/client/format";
import type { ProtocolStats, PaperSummary, MarketRow } from "@/lib/client/types";

// Split-flap constants
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$% ";
const DIGITS = "0123456789";

function calculatePays(own: number, other: number): string {
  if (own <= 0) return "1.00";
  return (1 + (other * 0.98) / own).toFixed(2);
}

export default function LandingPage() {
  const [activePage, setActivePage] = useState<"home" | "markets" | "how" | "genesis">("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [paper, setPaper] = useState<PaperSummary | null>(null);
  const [markets, setMarkets] = useState<MarketRow[]>([]);

  // Simulation modal state
  const [simMarket, setSimMarket] = useState<{
    id: string;
    question: string;
    asset: string;
    yes: number;
    no: number;
  }>({
    id: "001",
    question: "ETH ABOVE $5,000?",
    asset: "ETH",
    yes: 60000,
    no: 40000,
  });
  const [simSide, setSimSide] = useState<"yes" | "no">("yes");
  const [simWon, setSimWon] = useState(true);
  const [simStake, setSimStake] = useState(100);
  const [marketDialogOpen, setMarketDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);

  // Transition overlay state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("01 / Markets");
  const [transitionWord, setTransitionWord] = useState("MARKETS");

  // Hero Split-Flap board state
  const [boardIndex, setBoardIndex] = useState(0);

  // Fetch real data on mount
  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    getPaperSummary().then(setPaper).catch(() => {});
    listMarkets().then((data) => {
      if (data && data.length > 0) setMarkets(data);
    }).catch(() => {});
  }, []);

  // Sync hash routing if user comes with #markets, #how, #genesis
  useEffect(() => {
    const hash = window.location.hash.slice(1) as any;
    if (["home", "markets", "how", "genesis"].includes(hash)) {
      setActivePage(hash);
    }
    const onHashChange = () => {
      const h = window.location.hash.slice(1) as any;
      if (["home", "markets", "how", "genesis"].includes(h)) {
        setActivePage(h);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Handle smooth page navigation with transition flipover
  const navigateTo = (page: "home" | "markets" | "how" | "genesis") => {
    if (page === activePage) return;
    setMenuOpen(false);

    const labels = {
      home: "00 / Home",
      markets: "01 / Markets",
      how: "02 / How it works",
      genesis: "03 / Genesis",
    };
    const words = {
      home: "STAKE",
      markets: "MARKETS",
      how: "HOW IT WORKS",
      genesis: "GENESIS",
    };

    setTransitionLabel(labels[page]);
    setTransitionWord(words[page]);
    setIsTransitioning(true);

    setTimeout(() => {
      setActivePage(page);
      window.history.pushState(null, "", `#${page}`);
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 400);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 850);
  };

  // Derive pools for tote board & markets table
  // Use real open markets if available, else standard fallback
  const displayMarkets = useMemo(() => {
    if (markets && markets.length > 0) {
      const openOnes = markets.filter((m) => m.status === "open");
      const list = openOnes.length >= 3 ? openOnes : markets;
      return list.slice(0, 4).map((m, idx) => {
        const yesVal = collateralToNumber(m.yes_pool);
        const noVal = collateralToNumber(m.no_pool);
        const yes = yesVal > 0 ? yesVal : 50000;
        const no = noVal > 0 ? noVal : 50000;
        return {
          id: String(idx + 1).padStart(3, "0"),
          marketId: m.id,
          asset: m.asset_symbol,
          question: m.question,
          yes,
          no,
          total: yes + no,
          yesPct: Math.round((yes / (yes + no)) * 100),
          noPct: 100 - Math.round((yes / (yes + no)) * 100),
          paysYes: calculatePays(yes, no),
          paysNo: calculatePays(no, yes),
        };
      });
    }

    return [
      {
        id: "001",
        marketId: "eth",
        asset: "ETH",
        question: "ETH above $5,000?",
        yes: 60000,
        no: 40000,
        total: 100000,
        yesPct: 60,
        noPct: 40,
        paysYes: calculatePays(60000, 40000),
        paysNo: calculatePays(40000, 60000),
      },
      {
        id: "002",
        marketId: "btc",
        asset: "BTC",
        question: "BTC above $150,000?",
        yes: 45000,
        no: 55000,
        total: 100000,
        yesPct: 45,
        noPct: 55,
        paysYes: calculatePays(45000, 55000),
        paysNo: calculatePays(55000, 45000),
      },
      {
        id: "003",
        marketId: "sol",
        asset: "SOL",
        question: "SOL above $300?",
        yes: 52000,
        no: 48000,
        total: 100000,
        yesPct: 52,
        noPct: 48,
        paysYes: calculatePays(52000, 48000),
        paysNo: calculatePays(48000, 52000),
      },
    ];
  }, [markets]);

  // Tote board cycle timer
  useEffect(() => {
    if (activePage !== "home") return;
    const interval = setInterval(() => {
      setBoardIndex((prev) => (prev + 1) % Math.min(displayMarkets.length, 3));
    }, 6500);
    return () => clearInterval(interval);
  }, [activePage, displayMarkets.length]);

  const activeTote = displayMarkets[boardIndex] || displayMarkets[0];

  // Simulator calculations
  const simOwn = simSide === "yes" ? simMarket.yes : simMarket.no;
  const simOther = simSide === "yes" ? simMarket.no : simMarket.yes;
  const simProfit = (simStake / (simOwn + simStake)) * simOther * 0.98;
  const simTotalPayout = simWon ? simStake + simProfit : 0;
  const simEligibleLoss = simWon ? 0 : simStake;

  return (
    <div className="landing-body">
      <a className="skip" href="#content">Skip to content</a>

      {/* ── TOP HEADER ── */}
      <header className="top">
        <div className="top-in">
          <button
            className="logo"
            onClick={() => navigateTo("home")}
            aria-label="Stake home"
            style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }}
          >
            <span className="logo-tag" aria-hidden="true"></span>
            Stake
          </button>

          <nav className={`nav ${menuOpen ? "open" : ""}`} id="navigation" aria-label="Main navigation">
            <button
              onClick={() => navigateTo("markets")}
              aria-current={activePage === "markets" ? "page" : undefined}
            >
              Markets
            </button>
            <button
              onClick={() => navigateTo("how")}
              aria-current={activePage === "how" ? "page" : undefined}
            >
              How it works
            </button>
            <button
              onClick={() => navigateTo("genesis")}
              aria-current={activePage === "genesis" ? "page" : undefined}
            >
              Genesis
            </button>
          </nav>

          <div className="top-end">
            <span className="preview">Robinhood Chain 46630</span>
            <Link className="landing-btn sm" href="/app">
              <span className="btn-label">Launch App</span>
              <span className="arr" aria-hidden="true">→</span>
            </Link>
            <button
              className="menu-toggle"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              aria-controls="navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <i />
              <i />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="landing-main" id="content">
        {/* ── SECTION: HOME ── */}
        {activePage === "home" && (
          <section className="landing-page entered" id="home" aria-label="Stake introduction">
            <div className="kicker">
              <b>A stake in every outcome.</b>
              <span>Robinhood Chain / Live Testnet</span>
            </div>

            <div className="landing-hero">
              <div>
                <h1 className="title" tabIndex={-1}>
                  <span className="ln" style={{ "--i": 0 } as any}>
                    <span>Your call.</span>
                  </span>
                  <span className="ln" style={{ "--i": 1 } as any}>
                    <span>
                      <span className="mark">Your stake.</span>
                    </span>
                  </span>
                </h1>
                <p className="lede rise" style={{ "--d": "260ms" } as any}>
                  Back <b>YES</b> or <b>NO</b>. Winners take the pool. Net losses earn protocol tokens.
                </p>
                <div className="actions rise" style={{ "--d": "340ms" } as any}>
                  <button className="landing-btn" onClick={() => navigateTo("markets")}>
                    <span>Pick your side</span> <span className="arr" aria-hidden="true">→</span>
                  </button>
                  <button className="landing-link" onClick={() => navigateTo("how")}>
                    How it works
                  </button>
                </div>
              </div>

              <div className="rig rise" style={{ "--d": "160ms" } as any}>
                <div className="tboard-wrap" aria-hidden="true">
                  <div className="tboard-in">
                    <div className="strip">
                      <span>Stake tote · live pools</span>
                      <span>
                        <i className="lamp" />
                        <span>{boardIndex + 1} / {Math.min(displayMarkets.length, 3)}</span>
                      </span>
                    </div>

                    {/* Flap Rows */}
                    <div className="flaps">
                      {`POOL ${activeTote.id}   ${activeTote.asset}/USD`.padEnd(20).slice(0, 20).split("").map((ch, idx) => (
                        <span key={idx} className={`cell ${idx < 4 ? "dim" : ""}`}>
                          <span className="t"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                          <span className="b"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                        </span>
                      ))}
                    </div>

                    <div className="flaps">
                      {activeTote.question.toUpperCase().padEnd(20).slice(0, 20).split("").map((ch, idx) => (
                        <span key={idx} className="cell">
                          <span className="t"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                          <span className="b"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                        </span>
                      ))}
                    </div>

                    <div className="cols">
                      <span>SIDE</span>
                      <span>POOL</span>
                      <span>SHR</span>
                      <span>PAYS/$1</span>
                    </div>

                    <div className="flaps">
                      {`YES $${(activeTote.yes).toLocaleString("en-US")} ${activeTote.yesPct}% ${activeTote.paysYes}`.padEnd(20).slice(0, 20).split("").map((ch, idx) => (
                        <span key={idx} className={`cell ${idx < 3 ? "lime" : ""}`}>
                          <span className="t"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                          <span className="b"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                        </span>
                      ))}
                    </div>

                    <div className="flaps">
                      {`NO  $${(activeTote.no).toLocaleString("en-US")} ${activeTote.noPct}% ${activeTote.paysNo}`.padEnd(20).slice(0, 20).split("").map((ch, idx) => (
                        <span key={idx} className="cell">
                          <span className="t"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                          <span className="b"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                        </span>
                      ))}
                    </div>

                    <div className="prog">
                      <span style={{ transform: "scaleX(1)", transition: "transform 6.5s linear" }} />
                    </div>
                    <div className="strip">
                      <span>Pays incl. stake · 2% fee</span>
                      <span className="opt">Deterministic oracle</span>
                    </div>
                  </div>
                </div>

                <div className="lip" aria-hidden="true" />
                <div className="slot" aria-hidden="true">
                  <div className="print">
                    <div className="ticket-wrap">
                      <div className="ticket">
                        <div className="t-head">
                          <span>Stake · pool ticket</span>
                          <span>No. {activeTote.id}</span>
                        </div>
                        <div className="t-row">
                          <span>Pool</span><i /><b>{activeTote.id} {activeTote.asset}/USD</b>
                        </div>
                        <div className="t-row">
                          <span>Question</span><i /><b>{activeTote.question}</b>
                        </div>
                        <div className="t-side">
                          <strong>YES</strong>
                          <span>Your view</span>
                        </div>
                        <div className="t-row">
                          <span>Stake</span><i /><b>$100.00</b>
                        </div>
                        <div className="t-row">
                          <span>Est. payout</span><i /><b>${(100 * parseFloat(activeTote.paysYes)).toFixed(2)}</b>
                        </div>
                        <div className="t-row">
                          <span>Fee</span><i /><b>2% losing pool</b>
                        </div>
                        <div className="barcode" />
                        <div className="t-foot">Live Testnet Protocol · Robinhood Chain</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="band rise" style={{ "--d": "420ms" } as any}>
              <p className="thesis">
                Win the bet.
                <span>Lose into ownership.</span>
              </p>
              <p className="note">A loss stays a loss. Tokens aren&rsquo;t a refund.</p>
            </div>
          </section>
        )}

        {/* ── SECTION: MARKETS ── */}
        {activePage === "markets" && (
          <section className="landing-page entered" id="markets" aria-label="Illustrative markets">
            <div className="kicker">
              <b>Markets</b>
              <span>Active Pools · Robinhood Chain</span>
            </div>
            <div className="head">
              <h1 className="title" tabIndex={-1}>
                <span className="ln" style={{ "--i": 0 } as any}>
                  <span>What&rsquo;s</span>
                </span>
                <span className="ln" style={{ "--i": 1 } as any}>
                  <span>
                    <span className="mark">your view?</span>
                  </span>
                </span>
              </h1>
              <p className="lede rise" style={{ "--d": "220ms" } as any}>
                One question. Two sides. Try an outcome below.
              </p>
            </div>

            <div className="tote">
              <div className="tote-head" aria-hidden="true">
                <span>Pool</span>
                <span>Question</span>
                <span>Pool split</span>
                <span>Take a side · pays per $1</span>
              </div>

              {displayMarkets.map((m, idx) => (
                <article key={m.id} className="landing-row rise" style={{ "--d": `${260 + idx * 70}ms` } as any}>
                  <div className="pno">
                    <b>{m.id}</b>
                    <span>{m.asset} / USD</span>
                  </div>
                  <h2 className="landing-q">{m.question}</h2>
                  <div className="pool">
                    <div className="pool-nums">
                      <span>${m.yes.toLocaleString()}<i>YES</i></span>
                      <span>${m.no.toLocaleString()}<i>NO</i></span>
                    </div>
                    <div className="landing-split">
                      <span className="y" style={{ "--w": `${m.yesPct}%` } as any} />
                      <span className="n" />
                    </div>
                    <div className="pool-pct">
                      <span>{m.yesPct}%</span>
                      <span>{m.noPct}%</span>
                    </div>
                  </div>
                  <div className="take">
                    <button
                      className="pick yes"
                      onClick={() => {
                        setSimMarket({
                          id: m.id,
                          question: m.question,
                          asset: m.asset,
                          yes: m.yes,
                          no: m.no,
                        });
                        setSimSide("yes");
                        setSimWon(true);
                        setMarketDialogOpen(true);
                      }}
                      aria-label={`Simulate YES on ${m.question}`}
                    >
                      <span className="pick-side">YES</span>
                      <span className="pick-pays">pays <b>{m.paysYes}</b></span>
                      <span className="arr" aria-hidden="true">→</span>
                    </button>
                    <button
                      className="pick no"
                      onClick={() => {
                        setSimMarket({
                          id: m.id,
                          question: m.question,
                          asset: m.asset,
                          yes: m.yes,
                          no: m.no,
                        });
                        setSimSide("no");
                        setSimWon(true);
                        setMarketDialogOpen(true);
                      }}
                      aria-label={`Simulate NO on ${m.question}`}
                    >
                      <span className="pick-side">NO</span>
                      <span className="pick-pays">pays <b>{m.paysNo}</b></span>
                      <span className="arr" aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <p className="footnote rise" style={{ "--d": "460ms" } as any}>
              Pool shares are determined by total wagers, not external probabilities. Final payouts depend on the pools at cutoff.
              &ldquo;Pays&rdquo; is the return per $1 at the current pools, stake included, after an example 2% fee on the losing pool.
            </p>

            <div className="page-foot">
              <span>Interactive preview on Robinhood Chain Testnet.</span>
              <button className="next" onClick={() => navigateTo("how")}>
                What happens next <span className="arr" aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}

        {/* ── SECTION: HOW IT WORKS ── */}
        {activePage === "how" && (
          <section className="landing-page entered" id="how" aria-label="How Stake works">
            <div className="kicker">
              <b>How it works</b>
              <span>Predict / Settle / Claim</span>
            </div>
            <div className="head">
              <h1 className="title" tabIndex={-1}>
                <span className="ln" style={{ "--i": 0 } as any}>
                  <span>Two outcomes.</span>
                </span>
                <span className="ln" style={{ "--i": 1 } as any}>
                  <span>
                    <span className="mark">A new stake.</span>
                  </span>
                </span>
              </h1>
              <p className="lede rise" style={{ "--d": "220ms" } as any}>
                The price decides the bet. Your net result decides the claim.
              </p>
            </div>

            <div className="outcomes">
              {/* Winner outcome */}
              <article className="outcome rise" style={{ "--d": "260ms", "--sd": "900ms" } as any}>
                <div className="ticket-wrap" style={{ "--rot": "-1.5deg" } as any} aria-hidden="true">
                  <div className="thud">
                    <div className="ticket">
                      <div className="t-head">
                        <span>Stake · pool ticket</span>
                        <span>No. 001</span>
                      </div>
                      <div className="t-row">
                        <span>Pool</span><i /><b>001 ETH/USD &gt; $5,000</b>
                      </div>
                      <div className="t-side">
                        <strong>YES</strong>
                        <span>Your view</span>
                      </div>
                      <div className="t-row">
                        <span>Stake</span><i /><b>$100.00</b>
                      </div>
                      <div className="t-row">
                        <span>Outcome</span><i /><b>YES</b>
                      </div>
                      <div className="t-sep" />
                      <div className="t-row">
                        <span>Payout</span><i /><b>$165.22</b>
                      </div>
                      <div className="barcode" />
                      <div className="t-foot">Settled by oracle price</div>
                      <div className="landing-stamp win">Paid<small>$165.22</small></div>
                    </div>
                  </div>
                </div>
                <div className="out-copy">
                  <h2>Right call.<span>Real payout.</span></h2>
                  <p>Your stake back, plus your proportional share of the losing pool after protocol fees.</p>
                  <div className="out-foot">Funded directly by the opposing pool</div>
                </div>
              </article>

              {/* Loser outcome */}
              <article className="outcome rise" style={{ "--d": "340ms", "--sd": "1300ms" } as any}>
                <div className="ticket-wrap" style={{ "--rot": "1.5deg" } as any} aria-hidden="true">
                  <div className="thud">
                    <div className="ticket">
                      <div className="t-head">
                        <span>Stake · pool ticket</span>
                        <span>No. 002</span>
                      </div>
                      <div className="t-row">
                        <span>Pool</span><i /><b>001 ETH/USD &gt; $5,000</b>
                      </div>
                      <div className="t-side">
                        <strong>NO</strong>
                        <span>Your view</span>
                      </div>
                      <div className="t-row">
                        <span>Stake</span><i /><b>$100.00</b>
                      </div>
                      <div className="t-row">
                        <span>Outcome</span><i /><b>YES</b>
                      </div>
                      <div className="t-sep" />
                      <div className="t-row">
                        <span>Payout</span><i /><b>$0.00</b>
                      </div>
                      <div className="barcode" />
                      <div className="t-foot">Net loss recorded</div>
                      <div className="landing-stamp loss">Net loss<small>Token eligible</small></div>
                    </div>
                  </div>
                </div>
                <div className="out-copy">
                  <h2>Wrong call.<span>A new stake.</span></h2>
                  <p>Your net loss determines your protocol-token emissions via piecewise non-dilutive minting.</p>
                  <div className="out-foot">Verified net loss → $STAKE token eligibility</div>
                </div>
              </article>
            </div>

            <div className="steps rise" style={{ "--d": "420ms" } as any}>
              <div className="step">
                <b>1</b>
                <strong>Predict</strong>
                <span>Back YES or NO before market cutoff.</span>
              </div>
              <div className="step">
                <b>2</b>
                <strong>Settle</strong>
                <span>A verified oracle price resolves the outcome deterministically.</span>
              </div>
              <div className="step">
                <b>3</b>
                <strong>Claim</strong>
                <span>Payouts and token claims are settled individually via smart contract.</span>
              </div>
            </div>

            <div className="notice rise" style={{ "--d": "480ms" } as any}>
              <p>
                Lost collateral stays lost. Tokens have no guaranteed monetary value. &ldquo;Ownership&rdquo; describes token distribution; holder rights are not finalized.
              </p>
              <button className="landing-link" onClick={() => setNotesDialogOpen(true)}>
                Read the rules
              </button>
            </div>

            <div className="page-foot">
              <span>Verified oracle prices. Individual claims.</span>
              <button className="next" onClick={() => navigateTo("genesis")}>
                Where supply begins <span className="arr" aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}

        {/* ── SECTION: GENESIS ── */}
        {activePage === "genesis" && (
          <section className="landing-page entered" id="genesis" aria-label="Token genesis">
            <div className="kicker">
              <b>Genesis</b>
              <span>Zero-Premint Tokenomics</span>
            </div>
            <div className="gen">
              <div>
                <h1 className="title" tabIndex={-1}>
                  <span className="ln" style={{ "--i": 0 } as any}>
                    <span>Supply starts</span>
                  </span>
                  <span className="ln" style={{ "--i": 1 } as any}>
                    <span>
                      <span className="mark">with you.</span>
                    </span>
                  </span>
                </h1>
                <p className="lede rise" style={{ "--d": "240ms" } as any}>
                  No premint. No insider head start. Verified net losses create new tokens.
                </p>

                <dl className="landing-ledger rise" style={{ "--d": "300ms" } as any}>
                  <div>
                    <dt>Premint</dt><i /><dd>0</dd>
                  </div>
                  <div>
                    <dt>Team allocation</dt><i /><dd>0</dd>
                  </div>
                  <div>
                    <dt>Investor allocation</dt><i /><dd>0</dd>
                  </div>
                  <div>
                    <dt>New supply</dt><i /><dd>Minted against verified losses</dd>
                  </div>
                  {paper && (
                    <div>
                      <dt>Total STAKE minted</dt><i />
                      <dd>{Math.round(paperToNumber(paper.supply)).toLocaleString()} STAKE</dd>
                    </div>
                  )}
                  {stats && (
                    <div>
                      <dt>Protocol net losses</dt><i />
                      <dd>{usd(collateralToNumber(stats.realizedNetLosses))}</dd>
                    </div>
                  )}
                </dl>

                <button
                  className="landing-link rise"
                  style={{ "--d": "360ms" } as any}
                  onClick={() => setNotesDialogOpen(true)}
                >
                  The genesis model
                </button>
              </div>

              <div className="rise" style={{ "--d": "160ms" } as any}>
                <div className="tboard-wrap" aria-hidden="true">
                  <div className="counter-in">
                    <div className="strip">
                      <span>Initial token supply</span>
                      <span><i className="lamp" />Genesis</span>
                    </div>
                    <div className="flaps" id="counter">
                      {"000,000,000".split("").map((ch, idx) => (
                        <span key={idx} className="cell">
                          <span className="t"><b>{ch}</b></span>
                          <span className="b"><b>{ch}</b></span>
                        </span>
                      ))}
                    </div>
                    <div className="strip">
                      <span>Unit · protocol tokens</span>
                      <span>Emission curve open</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="page-foot">
              <span>Emission curve, token rights and transfer rules on Robinhood Chain.</span>
              <button className="next" onClick={() => navigateTo("markets")}>
                Back your view <span className="arr" aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="site-foot">
        <span>STAKE MARKET · ROBINHOOD CHAIN TESTNET (ID: 46630)</span>
        <button onClick={() => setNotesDialogOpen(true)}>Protocol notes ↗</button>
      </footer>

      {/* ── TRANSITION OVERLAY ── */}
      <div
        className="flipover"
        aria-hidden={!isTransitioning}
        style={{
          clipPath: isTransitioning ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)",
          transition: "clip-path .45s cubic-bezier(.7, 0, .2, 1)",
          pointerEvents: isTransitioning ? "all" : "none",
        }}
      >
        <div className="fo-in">
          <div className="fo">
            <div className="strip">
              <span>Now showing</span>
              <span>{transitionLabel}</span>
            </div>
            <div className="flaps">
              {transitionWord.padStart(Math.floor((12 + transitionWord.length) / 2)).padEnd(12).split("").map((ch, i) => (
                <span key={i} className="cell">
                  <span className="t"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                  <span className="b"><b>{ch === " " ? "\u00A0" : ch}</b></span>
                </span>
              ))}
            </div>
            <div className="strip">
              <span>Stake</span>
              <span>Your call. Your stake.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SIMULATOR BET SLIP DIALOG ── */}
      {marketDialogOpen && (
        <dialog
          className="landing-dialog"
          open
          aria-labelledby="market-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMarketDialogOpen(false);
          }}
        >
          <div className="slip-head">
            <span>Bet slip · simulation · no transaction</span>
            <button className="x" onClick={() => setMarketDialogOpen(false)} aria-label="Close simulator">
              ×
            </button>
          </div>
          <div className="slip-body">
            <h2 id="market-title">{simMarket.question}</h2>
            <div className="side-line" data-side={simSide}>
              Your view <b>{simSide.toUpperCase()}</b>
            </div>

            <div className="stake-row">
              <label htmlFor="amount">Your example stake</label>
              <output className="amount-output" id="amount-output">
                ${simStake}
              </output>
            </div>

            <input
              id="amount"
              type="range"
              min="10"
              max="1000"
              step="10"
              value={simStake}
              onChange={(e) => setSimStake(Number(e.target.value))}
              style={{
                "--p": `${((simStake - 10) / (1000 - 10)) * 100}%`,
              } as any}
            />

            <div className="calc-tabs" role="group" aria-label="Simulated outcome">
              <button
                aria-pressed={simWon}
                onClick={() => setSimWon(true)}
              >
                If I win
              </button>
              <button
                aria-pressed={!simWon}
                onClick={() => setSimWon(false)}
              >
                If I lose
              </button>
            </div>

            <div className="calc-result" data-state={simWon ? "win" : "loss"}>
              <span className="lbl">{simWon ? "TOTAL PAYOUT" : "ELIGIBLE NET LOSS"}</span>
              <strong>
                ${simWon ? simTotalPayout.toFixed(2) : simEligibleLoss.toFixed(2)}
              </strong>
              <p>
                {simWon
                  ? "Stake returned + share of the opposing losing pool."
                  : "This loss is the basis for protocol-token eligibility. It is not refunded."}
              </p>
            </div>

            <div className="calc-detail">
              <span>{simWon ? "Net profit" : "Collateral payout"}</span>
              <i />
              <span>{simWon ? `+$${simProfit.toFixed(2)}` : "$0.00"}</span>
            </div>

            <p className="slip-note">
              {simWon
                ? "Example: 2% protocol fee deducted from the losing pool. Final fees may vary."
                : "Token quantity minted depends on the emission controller tier curve."}
            </p>
            <div className="barcode" aria-hidden="true" />
            <div style={{ marginTop: 20 }}>
              <Link
                className="landing-btn"
                style={{ width: "100%", justifyContent: "center" }}
                href={`/app/market/${simMarket.id}?side=${simSide}`}
              >
                <span>Place Bet on App</span> <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </dialog>
      )}

      {/* ── NOTES RULES DIALOG ── */}
      {notesDialogOpen && (
        <dialog
          className="landing-dialog"
          open
          aria-labelledby="notes-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNotesDialogOpen(false);
          }}
        >
          <div className="slip-head">
            <span>Stake · protocol notes</span>
            <button className="x" onClick={() => setNotesDialogOpen(false)} aria-label="Close protocol notes">
              ×
            </button>
          </div>
          <div className="slip-body">
            <h2 id="notes-title">The rules, simply.</h2>
            <p className="intro">
              Objective YES / NO markets. Stablecoin pools. Oracle-verified settlement.
            </p>
            <div className="rules">
              <details open>
                <summary>Where payouts come from<span className="pm" aria-hidden="true">+</span></summary>
                <p>
                  Winners recover their winning stake and share the losing pool proportionally after the protocol fee. The protocol does not underwrite the bet.
                </p>
              </details>
              <details>
                <summary>What counts as a loss<span className="pm" aria-hidden="true">+</span></summary>
                <p>
                  Eligible loss = max(0, total wallet stake − total payout), per market. Betting both sides does not earn tokens on gross losing stake. Multi-wallet farming is mitigated through net loss invariants.
                </p>
              </details>
              <details>
                <summary>Who can mint tokens<span className="pm" aria-hidden="true">+</span></summary>
                <p>
                  The intended model starts at zero supply with no premint. Only an emission controller can mint against verified eligible losses. Admin permissions do not provide a back door to issuance.
                </p>
              </details>
              <details>
                <summary>What &ldquo;ownership&rdquo; means<span className="pm" aria-hidden="true">+</span></summary>
                <p>
                  It describes the distribution of protocol tokens ($STAKE). Holder rights, caps, and transfer rules are enforced on Robinhood Chain.
                </p>
              </details>
              <details>
                <summary>If settlement fails<span className="pm" aria-hidden="true">+</span></summary>
                <p>
                  The cancellation path refunds original stakes with no fee or token emission. One-sided markets cancel. Resolved outcomes cannot be changed.
                </p>
              </details>
              <details>
                <summary>Live Robinhood Chain deployment<span className="pm" aria-hidden="true">+</span></summary>
                <p>
                  Running on Robinhood Chain Testnet (Chain ID 46630). Connect your Web3 wallet to participate in live prediction markets with deterministic oracles.
                </p>
              </details>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
