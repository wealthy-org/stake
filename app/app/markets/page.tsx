"use client";

import { useEffect, useMemo, useState } from "react";
import { listMarkets } from "@/lib/client/api";
import type { MarketRow } from "@/lib/client/types";
import MarketRow_ from "@/components/MarketRow";
import { SkelBoard } from "@/components/Skeleton";

type Tab = "open" | "wait" | "done" | "all";

const PAGE_SIZE = 12;

const TABS: [Tab, string][] = [
  ["all", "All"],
  ["open", "Open"],
  ["wait", "Awaiting result"],
  ["done", "Resolved"],
];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("open");
  // "all" plus whatever asset_symbol values actually exist in the data —
  // this used to be a hardcoded ETH/BTC/.../TSLA list left over from the
  // old price-threshold generator, which silently stopped matching
  // anything once markets started coming from Polymarket categories
  // (CRYPTO/FINANCE/GEOPOLITICS/TECH) instead. Deriving it from the data
  // means the next source switch doesn't need this file touched again.
  const [asset, setAsset] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    const fetchMarkets = () => {
      listMarkets()
        .then((data) => {
          if (active) setMarkets(data);
        })
        .catch(() => {
          if (active && markets === null) setMarkets([]);
        });
    };

    fetchMarkets();
    const timer = setInterval(fetchMarkets, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!markets) return [];
    return markets.filter((m) => {
      const tabOk =
        tab === "all" ? true :
        tab === "open" ? m.status === "open" :
        tab === "wait" ? m.status === "locked" || m.status === "resolution_pending" :
        m.status === "resolved" || m.status === "cancelled";
      const assetOk = asset === "all" || m.asset_symbol === asset;
      const q = search.trim().toLowerCase();
      const searchOk = !q || m.question.toLowerCase().includes(q) || m.asset_symbol.toLowerCase().includes(q);
      return tabOk && assetOk && searchOk;
    }).sort((a, b) => {
      // Polymarket-sourced markets surface first — leader's priority call,
      // without touching the lifecycle of any already-created legacy market.
      const aPm = a.oracle_source.startsWith("polymarket:");
      const bPm = b.oracle_source.startsWith("polymarket:");
      if (aPm !== bPm) return aPm ? -1 : 1;
      return Number(b.yes_pool) + Number(b.no_pool) - (Number(a.yes_pool) + Number(a.no_pool));
    });
  }, [markets, tab, asset, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 on filter/search change
  useEffect(() => { setPage(1); }, [tab, asset, search]);

  const assets = useMemo(() => {
    if (!markets) return ["all"];
    const unique = Array.from(new Set(markets.map((m) => m.asset_symbol))).sort();
    return ["all", ...unique];
  }, [markets]);

  const counts = useMemo(() => {
    if (!markets) return { open: 0, wait: 0, done: 0, all: 0 };
    return {
      all: markets.length,
      open: markets.filter((m) => m.status === "open").length,
      wait: markets.filter((m) => m.status === "locked" || m.status === "resolution_pending").length,
      done: markets.filter((m) => m.status === "resolved" || m.status === "cancelled").length,
    };
  }, [markets]);

  return (
    <>
      {/* ── Page header ── */}
      <div className="mkt-hd">
        <div>
          <h1>Markets</h1>
          <p className="mkt-sub">
            All prediction markets on Robinhood Chain testnet.{" "}
            {markets !== null && (
              <span className="mkt-total">{markets.length} total</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Modern Control & Filter Panel ── */}
      <div className="mkt-control-bar">
        {/* Row 1: Status segmented control + Search */}
        <div className="mkt-top-row">
          <div className="mkt-status-tabs" role="tablist" aria-label="Market status">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={`status-tab ${tab === k ? "active" : ""}`}
                onClick={() => setTab(k)}
              >
                <span>{label}</span>
                {markets !== null && (
                  <span className="tab-pill">{counts[k]}</span>
                )}
              </button>
            ))}
          </div>

          <div className="mkt-search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="mkt-search"
              className="mkt-search"
              type="search"
              placeholder="Search markets or asset…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search markets"
            />
            {search && (
              <button className="mkt-search-clear" onClick={() => setSearch("")} aria-label="Clear search">×</button>
            )}
          </div>
        </div>

        {/* Row 2: Asset filter pills */}
        <div className="mkt-asset-row">
          <span className="asset-label">Asset:</span>
          <div className="mkt-asset-chips">
            {assets.map((k) => (
              <button
                key={k}
                className={`asset-chip ${asset === k ? "active" : ""}`}
                onClick={() => setAsset(k)}
              >
                {k === "all" ? "All assets" : k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results summary ── */}
      {markets !== null && search && (
        <p className="mkt-results-info">
          {filtered.length === 0
            ? `No markets found for "${search}"`
            : `${filtered.length} market${filtered.length !== 1 ? "s" : ""} found`}
        </p>
      )}

      {/* ── Board ── */}
      {markets === null ? (
        <SkelBoard rows={6} />
      ) : pageItems.length > 0 ? (
        <div className="tote">
          <div className="tote-head" aria-hidden="true">
            <span>Pool</span>
            <span>Question</span>
            <span>Pool split</span>
            <span>Take a side · pays per $1</span>
          </div>
          {pageItems.map((m) => (
            <MarketRow_ key={m.id} market={m} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>Nothing here</h3>
          <p>
            {search
              ? `No markets match "${search}". Try a different search term.`
              : "Try another status or asset filter."}
          </p>
          {search && (
            <button className="btn sm" style={{ marginTop: 16 }} onClick={() => setSearch("")}>
              Clear search
            </button>
          )}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="mkt-pagination" role="navigation" aria-label="Pagination">
          <button
            className="btn ghost sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            ← Prev
          </button>
          <div className="pg-nums">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={"pg-btn" + (p === page ? " on" : "")}
                onClick={() => setPage(p)}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            className="btn ghost sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Page info ── */}
      {markets !== null && filtered.length > 0 && (
        <p className="mkt-page-info">
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
        </p>
      )}
    </>
  );
}
