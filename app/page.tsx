"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import "./landing.css";
import { getStats, listMarkets } from "@/lib/client/api";
import { collateralToNumber } from "@/lib/client/format";
import type { ProtocolStats, MarketRow } from "@/lib/client/types";
import { DOCS_SECTIONS, DOC_ARTICLES } from "@/lib/client/docsData";
import MarketRow_ from "@/components/MarketRow";

// Split-flap constants
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$% ";
const DIGITS = "0123456789";

function calculatePays(own: number, other: number): string {
  if (own <= 0) return "1.00";
  return (1 + (other * 0.98) / own).toFixed(2);
}

export default function LandingPage() {
  const [activePage, setActivePage] = useState<"home" | "markets" | "how" | "genesis" | "docs">("home");
  const isDocs = activePage === "docs";
  // Marketing sections are always mounted and stacked for scroll navigation;
  // "entered" tracks which ones have scrolled into view at least once so
  // their rise/reveal animations play on arrival instead of only on mount.
  const [entered, setEntered] = useState<Record<string, boolean>>({ home: true });
  const homeSectionRef = useRef<HTMLElement>(null);
  const marketsSectionRef = useRef<HTMLElement>(null);
  const howSectionRef = useRef<HTMLElement>(null);
  const genesisSectionRef = useRef<HTMLElement>(null);
  const [activeDocSlug, setActiveDocSlug] = useState<string>("what-is-stake");
  const [docsMobileOpen, setDocsMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [marketTab, setMarketTab] = useState<"open" | "wait" | "done" | "all">("open");
  const [marketAsset, setMarketAsset] = useState<string>("all");

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

  // Flattened doc articles for sequential prev / next navigation
  const allDocArticles = useMemo(
    () =>
      DOCS_SECTIONS.flatMap((sec) =>
        sec.items.map((it) => ({ ...it, section: sec.title }))
      ),
    []
  );

  const currentArticle =
    DOC_ARTICLES[activeDocSlug] || DOC_ARTICLES["what-is-stake"];
  const currentDocIndex = allDocArticles.findIndex(
    (a) => a.slug === currentArticle.slug
  );
  const prevDoc =
    currentDocIndex > 0 ? allDocArticles[currentDocIndex - 1] : null;
  const nextDoc =
    currentDocIndex < allDocArticles.length - 1
      ? allDocArticles[currentDocIndex + 1]
      : null;

  const selectDocArticle = (slug: string) => {
    setActiveDocSlug(slug);
    setDocsMobileOpen(false);
    window.history.pushState(null, "", `#docs/${slug}`);
    const el = document.getElementById("docs-article-view");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Scroll-spy: mark each marketing section "entered" the first time it
  // scrolls into view (plays its reveal animation), and keep the header
  // nav's active-section highlight in sync with scroll position.
  useEffect(() => {
    if (isDocs) return;
    const sections: Array<["home" | "markets" | "how" | "genesis", React.RefObject<HTMLElement>]> = [
      ["home", homeSectionRef],
      ["markets", marketsSectionRef],
      ["how", howSectionRef],
      ["genesis", genesisSectionRef],
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id as "home" | "markets" | "how" | "genesis";
          if (!entry.isIntersecting) return;
          setEntered((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
          if (entry.intersectionRatio > 0.4) {
            setActivePage((prev) => (prev === "docs" ? prev : id));
          }
        });
      },
      { threshold: [0.25, 0.4, 0.6], rootMargin: "-84px 0px -45% 0px" }
    );
    sections.forEach(([, ref]) => {
      if (ref.current) observer.observe(ref.current);
    });
    return () => observer.disconnect();
  }, [isDocs]);

  // Fetch real data on mount and poll for real-time updates
  useEffect(() => {
    let active = true;
    getStats().then(setStats).catch(() => {});
    const fetchMarkets = () => {
      listMarkets()
        .then((data) => {
          if (active && data && data.length > 0) setMarkets(data);
        })
        .catch(() => {});
    };
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Safety net: never let a fresh mount start with the flipover transition
  // stuck visible (can happen after a hot-reload mid-transition in dev).
  useEffect(() => {
    setIsTransitioning(false);
  }, []);

  // Sync hash routing if user comes with #markets, #how, #genesis, #docs
  useEffect(() => {
    const handleHash = (rawHash: string) => {
      const h = rawHash.slice(1);
      if (h.startsWith("docs")) {
        setActivePage("docs");
        const parts = h.split("/");
        if (parts[1] && DOC_ARTICLES[parts[1]]) {
          setActiveDocSlug(parts[1]);
        }
      } else if (["home", "markets", "how", "genesis", "docs"].includes(h)) {
        setActivePage(h as any);
        if (h !== "docs") {
          requestAnimationFrame(() => {
            document.getElementById(h)?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
          });
        }
      }
    };

    handleHash(window.location.hash);
    const onHashChange = () => handleHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Update document title per active section matching reference design
  useEffect(() => {
    const docTitles: Record<string, string> = {
      home: "Your call. Your stake.",
      markets: "Take a side.",
      how: "Two outcomes. A new stake.",
      genesis: "Supply starts with you.",
      docs: "Documentation",
    };
    document.title = `Stake · ${docTitles[activePage] || "Your call. Your stake."}`;
  }, [activePage]);

  // Marketing sections (home/markets/how/genesis) are always mounted and
  // stacked, so moving between them is a smooth scroll with no transition.
  // Only entering/leaving "docs" mode (a separate mounted section) uses the
  // flipover transition, since that swaps what's in the DOM.
  const scrollToSection = (id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const navigateTo = (page: "home" | "markets" | "how" | "genesis" | "docs") => {
    setMenuOpen(false);

    if (page === activePage) {
      if (page !== "docs") scrollToSection(page);
      return;
    }

    const wasDocs = activePage === "docs";
    const goingToDocs = page === "docs";

    if (!wasDocs && !goingToDocs) {
      setActivePage(page);
      window.history.pushState(null, "", `#${page}`);
      scrollToSection(page);
      return;
    }

    const labels: Record<string, string> = {
      home: "00 / Home",
      markets: "01 / Markets",
      how: "02 / How it works",
      genesis: "03 / Rewards",
      docs: "04 / Documentation",
    };
    const words: Record<string, string> = {
      home: "STAKE",
      markets: "MARKETS",
      how: "HOW IT WORKS",
      genesis: "REWARDS",
      docs: "DOCS",
    };

    setTransitionLabel(labels[page] || "00 / Home");
    setTransitionWord(words[page] || "STAKE");
    setIsTransitioning(true);

    setTimeout(() => {
      setActivePage(page);
      window.history.pushState(null, "", `#${page}`);
      window.scrollTo({ top: 0, behavior: "instant" });
      if (!goingToDocs) scrollToSection(page);
    }, 400);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 850);
  };

  // Compute counts and filtered markets for the Markets section
  const marketCounts = useMemo(() => {
    return {
      all: markets.length,
      open: markets.filter((m) => m.status === "open").length,
      wait: markets.filter((m) => m.status === "locked" || m.status === "resolution_pending").length,
      done: markets.filter((m) => m.status === "resolved" || m.status === "cancelled").length,
    };
  }, [markets]);

  const filteredLandingMarkets = useMemo(() => {
    if (!markets || markets.length === 0) return [];
    return markets.filter((m) => {
      const tabOk =
        marketTab === "all" ? true :
        marketTab === "open" ? m.status === "open" :
        marketTab === "wait" ? m.status === "locked" || m.status === "resolution_pending" :
        m.status === "resolved" || m.status === "cancelled";
      const assetOk = marketAsset === "all" || m.asset_symbol === marketAsset;
      return tabOk && assetOk;
    });
  }, [markets, marketTab, marketAsset]);

  // Derive pools for tote board & fallback
  // Use real open markets if available, else standard fallback
  const displayMarkets = useMemo(() => {
    if (markets && markets.length > 0) {
      const openOnes = markets.filter((m) => m.status === "open");
      const list = openOnes.length >= 3 ? openOnes : markets;
      return list.map((m) => {
        const yesVal = collateralToNumber(m.yes_pool);
        const noVal = collateralToNumber(m.no_pool);
        const yes = yesVal > 0 ? yesVal : 50000;
        const no = noVal > 0 ? noVal : 50000;
        return {
          id: m.id.slice(-3).toUpperCase(),
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
        id: "ETH",
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
        id: "BTC",
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
        id: "SOL",
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
      {
        id: "NVD",
        marketId: "nvda",
        asset: "NVDA",
        question: "NVDA above $200?",
        yes: 70000,
        no: 30000,
        total: 100000,
        yesPct: 70,
        noPct: 30,
        paysYes: calculatePays(70000, 30000),
        paysNo: calculatePays(30000, 70000),
      },
    ];
  }, [markets]);

  // Tote board cycle timer
  useEffect(() => {
    const interval = setInterval(() => {
      setBoardIndex((prev) => (prev + 1) % Math.min(displayMarkets.length, 3));
    }, 6500);
    return () => clearInterval(interval);
  }, [displayMarkets.length]);

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
            className="brand"
            onClick={() => navigateTo("home")}
            aria-label="Stake home"
            style={{ border: 0, background: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
          >
            <img src="/logo.jpeg" alt="Stake" className="brand-mark" />
            <span className="brand-text">
              <span className="brand-name">Stake</span>
              <span className="brand-sub">Prediction Protocol · Robinhood L1</span>
            </span>
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
              Rewards
            </button>
            <button
              onClick={() => navigateTo("docs")}
              aria-current={activePage === "docs" ? "page" : undefined}
            >
              Docs
            </button>
          </nav>

          <div className="top-end">
            <Link className="landing-btn sm" href="/app">
              <span className="btn-label">Take a side</span>
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
        {!isDocs && (
          <section
            className={`landing-page ${entered.home ? "entered" : ""}`}
            id="home"
            aria-label="Stake introduction"
            ref={homeSectionRef}
          >
            <div className="kicker">
              <b>A stake in every outcome.</b>
              <span>Robinhood Chain / Independent project</span>
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
                  <Link className="landing-btn" href="/app">
                    <span>Pick your side</span> <span className="arr" aria-hidden="true">→</span>
                  </Link>
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
        {!isDocs && (
          <section
            className={`landing-page ${entered.markets ? "entered" : ""}`}
            id="markets"
            aria-label="Prediction markets"
            ref={marketsSectionRef}
          >
            <div className="kicker">
              <b>01 / Markets</b>
              <span>Live prediction pools · Robinhood Chain testnet · {markets.length} total</span>
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
                One question. Two sides. Back YES or NO with live contract liquidity.
              </p>
            </div>

            {/* ── Modern Control & Filter Panel ── */}
            <div className="mkt-control-bar rise" style={{ "--d": "240ms", marginBottom: 24 } as any}>
              {/* Row 1: Status segmented control */}
              <div className="mkt-top-row">
                <div className="mkt-status-tabs" role="tablist" aria-label="Market status">
                  {[
                    ["open", "Open"],
                    ["wait", "Awaiting result"],
                    ["done", "Resolved"],
                    ["all", "All"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={marketTab === k}
                      className={`status-tab ${marketTab === k ? "active" : ""}`}
                      onClick={() => setMarketTab(k as any)}
                    >
                      <span>{label}</span>
                      {markets.length > 0 && (
                        <span className="tab-pill">{marketCounts[k as keyof typeof marketCounts]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Asset filter pills */}
              <div className="mkt-asset-row">
                <span className="asset-label">Asset:</span>
                <div className="mkt-asset-chips">
                  {["all", "ETH", "BTC", "SOL", "NVDA", "AAPL", "TSLA"].map((k) => (
                    <button
                      key={k}
                      className={`asset-chip ${marketAsset === k ? "active" : ""}`}
                      onClick={() => setMarketAsset(k)}
                    >
                      {k === "all" ? "All assets" : k}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="tote">
              <div className="tote-head" aria-hidden="true">
                <span>Pool</span>
                <span>Question</span>
                <span>Pool split</span>
                <span>Take a side · pays per $1</span>
              </div>

              {filteredLandingMarkets.length > 0 ? (
                filteredLandingMarkets.map((m) => (
                  <MarketRow_ key={m.id} market={m} />
                ))
              ) : markets.length === 0 ? (
                displayMarkets.slice(0, 4).map((m) => (
                  <article key={m.id} className="landing-row">
                    <div className="pno">
                      <b>{m.id}</b>
                      <span>{m.asset} / USD</span>
                    </div>
                    <h2 className="landing-q">
                      <Link href="/app/markets">{m.question}</Link>
                    </h2>
                    <div className="pool">
                      <div className="pool-nums">
                        <span>${m.yes.toLocaleString("en-US")}<i>YES</i></span>
                        <span>${m.no.toLocaleString("en-US")}<i>NO</i></span>
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
                      <Link className="pick yes" href={`/app/market/${m.marketId}?side=yes`}>
                        <span className="pick-side">YES</span>
                        <span className="pick-pays">pays <b>{m.paysYes}</b></span>
                        <span className="arr" aria-hidden="true">→</span>
                      </Link>
                      <Link className="pick no" href={`/app/market/${m.marketId}?side=no`}>
                        <span className="pick-side">NO</span>
                        <span className="pick-pays">pays <b>{m.paysNo}</b></span>
                        <span className="arr" aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty" style={{ gridColumn: "1 / -1", margin: "20px 0" }}>
                  <h3>No markets matching filter</h3>
                  <p>Try switching the asset or status filter above.</p>
                </div>
              )}
            </div>

            {markets.length > 0 && (
              <div className="board-more" style={{ marginTop: 24, textAlign: "center" }}>
                <Link href="/app/markets" className="landing-btn sm" style={{ padding: "0 28px" }}>
                  <span>Browse all {markets.length} markets in App</span>
                  <span className="arr" aria-hidden="true">→</span>
                </Link>
              </div>
            )}

            <p className="footnote rise" style={{ "--d": "460ms", marginTop: 24 } as any}>
              Real liquidity on Robinhood Chain Testnet. Payouts depend on pool sizes at cutoff.
              &ldquo;Pays&rdquo; is the proportional return per $1 staked, including returned stake, after 2% protocol fee on the losing pool.
            </p>

            <div className="page-foot">
              <span>Verified oracle prices. Deterministic settlement.</span>
              <button className="next" onClick={() => navigateTo("how")}>
                What happens next <span className="arr" aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}

        {/* ── SECTION: HOW IT WORKS ── */}
        {!isDocs && (
          <section
            className={`landing-page ${entered.how ? "entered" : ""}`}
            id="how"
            aria-label="How Stake works"
            ref={howSectionRef}
          >
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
                        <span>No. 000184</span>
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
                      <div className="stamp win">Paid<small>$165.22</small></div>
                    </div>
                  </div>
                </div>
                <div className="out-copy">
                  <h2>Right call.<span>Real payout.</span></h2>
                  <p>Your stake back, plus your share of the losing pool after fees.</p>
                  <div className="out-foot">Funded by the opposing pool</div>
                </div>
              </article>

              {/* Loser outcome */}
              <article className="outcome rise" style={{ "--d": "340ms", "--sd": "1300ms" } as any}>
                <div className="ticket-wrap" style={{ "--rot": "1.5deg" } as any} aria-hidden="true">
                  <div className="thud">
                    <div className="ticket">
                      <div className="t-head">
                        <span>Stake · pool ticket</span>
                        <span>No. 000185</span>
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
                      <div className="stamp loss">Net loss<small>Token eligible</small></div>
                    </div>
                  </div>
                </div>
                <div className="out-copy">
                  <h2>Wrong call.<span>A new stake.</span></h2>
                  <p>Your net loss determines your protocol-token emissions.</p>
                  <div className="out-foot">Verified net loss → token eligibility</div>
                </div>
              </article>
            </div>

            <div className="steps rise" style={{ "--d": "420ms" } as any}>
              <div className="step">
                <b>1</b>
                <strong>Predict</strong>
                <span>Back YES or NO before cutoff.</span>
              </div>
              <div className="step">
                <b>2</b>
                <strong>Settle</strong>
                <span>A verified oracle price decides the outcome.</span>
              </div>
              <div className="step">
                <b>3</b>
                <strong>Claim</strong>
                <span>Payouts and token eligibility are claimed individually.</span>
              </div>
            </div>

            <div className="notice rise" style={{ "--d": "480ms" } as any}>
              <p>
                Lost collateral stays lost. Tokens have no guaranteed value. &ldquo;Ownership&rdquo; describes token distribution; holder rights are not finalized.
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
        {!isDocs && (
          <section
            className={`landing-page ${entered.genesis ? "entered" : ""}`}
            id="genesis"
            aria-label="Token genesis"
            ref={genesisSectionRef}
          >
            <div className="kicker">
              <b>Rewards</b>
              <span>How losses become STAKE</span>
            </div>
            <div className="gen">
              <div>
                <h1 className="title" tabIndex={-1}>
                  <span className="ln" style={{ "--i": 0 } as any}>
                    <span>Losses become</span>
                  </span>
                  <span className="ln" style={{ "--i": 1 } as any}>
                    <span>
                      <span className="mark">points.</span>
                    </span>
                  </span>
                </h1>
                <p className="lede rise" style={{ "--d": "240ms" } as any}>
                  Verified net losses earn Points. Each Point represents a $1 budget to buy STAKE. When the treasury
                  funds a purchase, your Points convert into STAKE at the actual execution price. Claim your tokens
                  once they&rsquo;re allocated.
                </p>

                <dl className="landing-ledger rise" style={{ "--d": "300ms" } as any}>
                  <div>
                    <dt>1 Point</dt><i /><dd>$1 purchase budget</dd>
                  </div>
                  <div>
                    <dt>Conversion</dt><i /><dd>At treasury execution</dd>
                  </div>
                  <div>
                    <dt>Claim</dt><i /><dd>After token allocation</dd>
                  </div>
                </dl>

                <button
                  className="landing-link rise"
                  style={{ "--d": "360ms" } as any}
                  onClick={() => setNotesDialogOpen(true)}
                >
                  The rewards model
                </button>
              </div>

              <div className="rise" style={{ "--d": "160ms" } as any}>
                <div className="tboard-wrap" aria-hidden="true">
                  <div className="counter-in">
                    <div className="strip">
                      <span>Points to STAKE</span>
                      <span><i className="lamp" />Example</span>
                    </div>
                    <dl className="landing-ledger" style={{ margin: "18px 0" }}>
                      <div>
                        <dt>10.00</dt><i /><dd>Points</dd>
                      </div>
                      <div>
                        <dt>$10.00</dt><i /><dd>Purchase budget</dd>
                      </div>
                      <div>
                        <dt>STAKE amount</dt><i /><dd>Set when purchased</dd>
                      </div>
                    </dl>
                    <div className="strip">
                      <span>Unit · protocol tokens</span>
                      <span>Treasury-funded rewards</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="page-foot">
              <span>Reward batches, conversion ratios and token rights remain open.</span>
              <button className="next" onClick={() => navigateTo("docs")}>
                Protocol documentation <span className="arr" aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}

        {/* ── SECTION: DOCS (docs.papertrade.xyz style) ── */}
        {activePage === "docs" && (
          <section className="landing-page entered" id="docs" aria-label="Documentation">
            <div className="kicker">
              <b>04 / Documentation</b>
              <span>Protocol Architecture & Developer Reference</span>
            </div>

            <div className="docs-shell" id="docs-article-view">
              {/* Mobile Sidebar Toggle Button */}
              <button
                className="sidebar-toggle"
                onClick={() => setDocsMobileOpen(!docsMobileOpen)}
                aria-expanded={docsMobileOpen}
              >
                <span>Menu: {currentArticle.title}</span>
                <span>{docsMobileOpen ? "▲ Hide" : "▼ Topics"}</span>
              </button>

              {/* Left Column: Navigation Sidebar */}
              <aside className={`sidebar-col ${docsMobileOpen ? "" : "is-collapsed"}`} aria-label="Documentation navigation">
                {DOCS_SECTIONS.map((sec) => (
                  <div key={sec.title} className="sidebar-section">
                    <div className="sidebar-head">{sec.title}</div>
                    <ul className="sidebar-list">
                      {sec.items.map((item) => (
                        <li key={item.slug}>
                          <button
                            type="button"
                            className={activeDocSlug === item.slug ? "active" : ""}
                            onClick={() => selectDocArticle(item.slug)}
                          >
                            {item.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </aside>

              {/* Center Column: Article */}
              <article className="article-col docs-article">
                <div className="docs-breadcrumb" aria-label="Breadcrumb">
                  <span style={{ cursor: "pointer" }} onClick={() => navigateTo("home")}>Stake</span>
                  <span className="sep">/</span>
                  <span>{currentArticle.section}</span>
                  <span className="sep">/</span>
                  <span style={{ color: "var(--ink)" }}>{currentArticle.title}</span>
                </div>

                <span className="eyebrow">{currentArticle.section}</span>
                <h1>{currentArticle.title}</h1>
                <p className="lead">{currentArticle.lead}</p>

                <div className="article-body">
                  {currentArticle.content.map((block, idx) => {
                    if (block.type === "h2") {
                      return (
                        <h2 key={idx} id={block.id}>
                          {block.text}
                        </h2>
                      );
                    }
                    if (block.type === "h3") {
                      return (
                        <h3 key={idx} id={block.id}>
                          {block.text}
                        </h3>
                      );
                    }
                    if (block.type === "p") {
                      return <p key={idx}>{block.text}</p>;
                    }
                    if (block.type === "list") {
                      return (
                        <ul key={idx}>
                          {block.items?.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      );
                    }
                    if (block.type === "callout") {
                      return (
                        <div key={idx} className={`callout ${block.calloutType || ""}`}>
                          {block.calloutHead && (
                            <div className="callout-head">{block.calloutHead}</div>
                          )}
                          <p style={{ margin: 0 }}>{block.text}</p>
                        </div>
                      );
                    }
                    if (block.type === "code") {
                      return (
                        <pre key={idx}>
                          <code>{block.codeContent}</code>
                        </pre>
                      );
                    }
                    if (block.type === "table") {
                      return (
                        <table key={idx}>
                          {block.tableHeaders && (
                            <thead>
                              <tr>
                                {block.tableHeaders.map((h, i) => (
                                  <th key={i}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {block.tableRows?.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    }
                    return null;
                  })}
                </div>

                {/* Article Pager */}
                <nav className="docs-nav-pager" aria-label="Documentation pager">
                  {prevDoc ? (
                    <button
                      type="button"
                      className="docs-pager-btn prev"
                      onClick={() => selectDocArticle(prevDoc.slug)}
                    >
                      <div className="label">← Previous</div>
                      <div className="title">{prevDoc.title}</div>
                    </button>
                  ) : (
                    <div />
                  )}
                  {nextDoc && (
                    <button
                      type="button"
                      className="docs-pager-btn next"
                      onClick={() => selectDocArticle(nextDoc.slug)}
                    >
                      <div className="label">Next →</div>
                      <div className="title">{nextDoc.title}</div>
                    </button>
                  )}
                </nav>

                <div className="page-foot" style={{ marginTop: 48, paddingBottom: 0, borderBottom: "none" }}>
                  <span>Deploy and trade native markets on Robinhood Chain.</span>
                  <Link className="next" href="/app">
                    Launch App <span className="arr" aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>

              {/* Right Column: Table of Contents */}
              <aside className="toc-col" aria-label="Table of contents">
                <div className="toc-head">On this page</div>
                <ul className="toc-list">
                  {currentArticle.headings.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(h.id);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        {h.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </section>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="site-foot">
        <span>STAKE MARKET · INTERACTIVE PREVIEW · NO REAL FUNDS</span>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <button onClick={() => navigateTo("docs")}>Documentation</button>
          <button onClick={() => setNotesDialogOpen(true)}>Protocol notes ↗</button>
        </div>
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
                <summary>How rewards are earned<span className="pm" aria-hidden="true">+</span></summary>
                <p>
                  No token is ever minted against a loss. Verified net losses record Points — each point is a $1
                  purchase budget. Treasury batches buy STAKE on the open market and allocate the received tokens
                  pro-rata; points are consumed at conversion. The Claim button only transfers already-allocated STAKE.
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
