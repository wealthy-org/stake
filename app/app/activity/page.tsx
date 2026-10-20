"use client";

import { useEffect, useState } from "react";
import { getActivity } from "@/lib/client/api";
import { SkelActivity } from "@/components/Skeleton";
import { collateralToNumber, paperToNumber, usd, num } from "@/lib/client/format";
import type { ActivityEvent } from "@/lib/client/types";

/* ── badge type per event ── */
type BadgeKind = "bet" | "claim" | "paper" | "market" | "resolve";

function badgeKind(type: string): BadgeKind {
  if (type === "BetPlaced") return "bet";
  if (type === "PayoutClaimed" || type === "RefundClaimed") return "claim";
  if (type === "LossRewardClaimed") return "paper";
  if (type === "MarketResolved") return "resolve";
  return "market";
}

const LABEL: Record<string, string> = {
  MarketCreated: "Market created",
  BetPlaced: "Bet placed",
  MarketLocked: "Pool locked",
  MarketResolved: "Market resolved",
  MarketCancelled: "Market cancelled",
  PayoutClaimed: "Winnings claimed",
  RefundClaimed: "Refund claimed",
  LossRewardClaimed: "STAKE minted",
};

/* ── icon per badge kind ── */
function BadgeIcon({ kind }: { kind: BadgeKind }) {
  if (kind === "bet")
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
      </svg>
    );
  if (kind === "claim")
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  if (kind === "paper")
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    );
  if (kind === "resolve")
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function describe(e: ActivityEvent): string {
  const p = e.payload ?? {};
  const mkt = e.market_id ? `No. ${e.market_id.slice(-4)}` : "";
  switch (e.type) {
    case "MarketCreated":
      return p.question ?? e.question ?? "";
    case "BetPlaced":
      return `${usd(collateralToNumber(p.amount), 0)} on ${String(p.side).toUpperCase()}, ${mkt}`;
    case "MarketLocked":
      return `Pool locked, ${mkt}`;
    case "MarketResolved":
      return `${mkt} resolved ${p.yesWon ? "YES" : "NO"} at ${usd(Number(p.resolvedPrice), 2)}`;
    case "MarketCancelled":
      return `${mkt} cancelled (${p.reason ?? "unspecified"})`;
    case "PayoutClaimed":
      return `${usd(collateralToNumber(p.amount), 2)} USDG claimed, ${mkt}`;
    case "RefundClaimed":
      return `${usd(collateralToNumber(p.amount), 2)} USDG refunded, ${mkt}`;
    case "LossRewardClaimed":
      return `${num(paperToNumber(p.paperMinted))} STAKE minted from a ${usd(collateralToNumber(p.realizedLoss), 0)} net loss`;
    default:
      return mkt;
  }
}

function marketRef(e: ActivityEvent): string | null {
  if (!e.market_id) return null;
  return `No. ${e.market_id.slice(-4)}`;
}

function formatTime(dateStr: string) {
  const t = new Date(dateStr);
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  const ss = String(t.getUTCSeconds()).padStart(2, "0");
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][t.getUTCMonth()];
  return { time: `${hh}:${mm}:${ss}`, date: `${t.getUTCDate()} ${mon}` };
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    const fetchFeed = () => {
      getActivity(200)
        .then((data) => {
          if (active) setEvents(data);
        })
        .catch(() => {
          if (active && events === null) setEvents([]);
        });
    };

    fetchFeed();
    const timer = setInterval(fetchFeed, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (events === null) return <SkelActivity />;

  return (
    <div className="tapewrap">
      {/* ── Header ── */}
      <div className="tape-hd">
        <div>
          <h1>Activity tape</h1>
          <p className="tape-sub">
            Every bet, resolution, and claim printed live from the on-chain events log.
          </p>
        </div>
        <div className="tape-live">
          <span className="dot-pulse" />
          LIVE FEED · {events.length} events
        </div>
      </div>

      {/* ── Column headers ── */}
      {events.length > 0 && (
        <div className="tl2 tl2-head">
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Time</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Event</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Details</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: ".06em", textAlign: "right" }}>#ID</span>
        </div>
      )}

      {/* ── Feed ── */}
      <div className="tape-body">
        {events.length === 0 ? (
          <div className="empty" style={{ marginTop: 32 }}>
            <h3>Nothing on the tape yet</h3>
            <p>Events will appear here as bets, resolutions and claims happen.</p>
          </div>
        ) : (
          events.map((e) => {
            const { time, date } = formatTime(e.created_at);
            const kind = badgeKind(e.type);
            const ref = marketRef(e);
            return (
              <div className="tl2" key={e.id}>
                {/* Time */}
                <div>
                  <span className="tm">{time}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", marginTop: 1 }}>{date}</span>
                </div>
                {/* Event type + badge */}
                <div>
                  <span className={`tape-type-badge badge-${kind}`}>
                    <BadgeIcon kind={kind} />
                    {LABEL[e.type] ?? e.type}
                  </span>
                  {ref && <div className="ev-mkt">{ref}</div>}
                </div>
                {/* Description */}
                <div className="ev-desc">{describe(e)}</div>
                {/* ID */}
                <span className="hx">#{e.id}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
