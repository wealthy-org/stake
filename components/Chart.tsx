function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 233280;
  return h || 7;
}

/**
 * Illustrative-only series: we don't record pool-share history yet (brief
 * doesn't require it for V1), so this renders a deterministic pseudo-random
 * walk seeded by the market id that ends at today's real YES share. It's a
 * texture, not real history — swap for a real time series once bet-history
 * aggregation exists.
 */
function series(seed: number, end: number): number[] {
  const n = 48;
  let s = seed;
  let v = 50;
  const a: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    v += (s / 233280 - 0.5) * 9;
    a.push(v);
  }
  const d = end - a[n - 1];
  return a.map((x, i) => Math.max(4, Math.min(96, x + d * (i / (n - 1)))));
}

export function Spark({ marketId, yesPct }: { marketId: string; yesPct: number }) {
  const pts = series(seedFromId(marketId), yesPct);
  const w = 64;
  const h = 24;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${((i * w) / (pts.length - 1)).toFixed(1)} ${(2 + ((100 - v) / 100) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function ChartSVG({ marketId, yesPct }: { marketId: string; yesPct: number }) {
  const W = 720;
  const H = 240;
  const pl = 34;
  const pb = 24;
  const pts = series(seedFromId(marketId), yesPct);
  const x = (i: number) => pl + (i * (W - pl - 8)) / (pts.length - 1);
  const y = (v: number) => 8 + ((100 - v) / 100) * (H - 8 - pb);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(pts.length - 1)} ${H - pb} L${x(0)} ${H - pb} Z`;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="YES share of the pool over the last 7 days (illustrative)">
      {[25, 50, 75].map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 50 ? "5 4" : undefined} />
          <text x={0} y={y(v) + 4}>
            {v}%
          </text>
        </g>
      ))}
      <path d={area} fill="var(--yes)" opacity={0.1} />
      <path d={d} fill="none" stroke="var(--yes)" strokeWidth={2.4} strokeLinejoin="round" />
      <text x={pl} y={H - 6}>
        7 days ago
      </text>
      <text x={W - 8} y={H - 6} textAnchor="end">
        Now
      </text>
    </svg>
  );
}
