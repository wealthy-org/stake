"use client";

import { useEffect, useState } from "react";

type Point = { t: number; p: number };

const INSTRUMENTS = [
  { label: "BTC", source: "binance", feed: "BTCUSDT" },
  { label: "ETH", source: "binance", feed: "ETHUSDT" },
  { label: "SOL", source: "binance", feed: "SOLUSDT" },
  { label: "NVDA", source: "stock", feed: "NVDA" },
  { label: "TSLA", source: "stock", feed: "TSLA" },
] as const;

type Slot = {
  points: Point[] | null;
  price: string;
  chg: number | null;
  dead: boolean;
};

const EMPTY: Slot = { points: null, price: "—", chg: null, dead: true };

function sparkPath(points: Point[]): {
  path: string;
  area: string;
} {
  const ps = points.slice(-48);
  const min = Math.min(...ps.map((x) => x.p));
  const max = Math.max(...ps.map((x) => x.p));
  const span = max - min || 1;
  const W = 140;
  const H = 40;
  const step = W / Math.max(1, ps.length - 1);
  const coords = ps.map((pt, i) => {
    const x = (i * step).toFixed(1);
    const y = (6 + ((max - pt.p) / span) * (H - 12)).toFixed(1);
    return `${x},${y}`;
  });
  const path = `M${coords.join(" L")}`;
  const area = `${path} L${W},${H} L0,${H} Z`;
  return { path, area };
}

export default function TapeStrip() {
  const [slots, setSlots] = useState<Record<string, Slot>>(() =>
    Object.fromEntries(INSTRUMENTS.map((i) => [i.label, EMPTY]))
  );

  useEffect(() => {
    let alive = true;

    async function load() {
      const next = await Promise.all(
        INSTRUMENTS.map(async (inst) => {
          try {
            const res = await fetch(
              `/api/price-history?source=${inst.source}&feed=${inst.feed}&tf=24H`,
              { cache: "no-store" }
            );
            if (!res.ok) throw new Error(String(res.status));
            const points: Point[] = await res.json();
            if (!Array.isArray(points) || points.length < 2) throw new Error("empty");
            const first = points[0].p;
            const last = points[points.length - 1].p;
            const chg = first > 0 ? ((last - first) / first) * 100 : 0;
            return [
              inst.label,
              {
                points,
                price: last >= 100 ? last.toLocaleString("en-US", { maximumFractionDigits: 0 }) : last.toFixed(2),
                chg,
                dead: false,
              } as Slot,
            ] as const;
          } catch {
            return [inst.label, EMPTY] as const;
          }
        })
      );
      if (alive) setSlots(Object.fromEntries(next));
    }

    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mkt-tape" aria-label="Live market tape">
      {INSTRUMENTS.map((inst) => {
        const slot = slots[inst.label] ?? EMPTY;
        const up = (slot.chg ?? 0) >= 0;
        return (
          <div key={inst.label} className={`mkt-tape-card ${slot.dead ? "dead" : up ? "up" : "down"}`}>
            <div className="mkt-tape-head">
              <span className="mkt-tape-dot" aria-hidden="true" />
              {inst.label}/USD
            </div>
            <span className="mkt-tape-price">{slot.price}</span>
            <span className="mkt-tape-chg">
              {slot.chg === null ? " — " : `${up ? "+" : ""}${slot.chg.toFixed(2)}% · 24h`}
            </span>
            <svg className="mkt-tape-svg" viewBox="0 0 140 40" preserveAspectRatio="none" aria-hidden="true">
              {slot.points && (
                <>
                  <path d={sparkPath(slot.points).area} fill="currentColor" opacity="0.08" />
                  <path
                    d={sparkPath(slot.points).path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
