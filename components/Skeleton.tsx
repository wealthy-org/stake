import type { CSSProperties } from "react";

export function Skel({
  width,
  height = 14,
  radius = 6,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={"skel " + (className ?? "")}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** Mirrors MarketRow's grid so the board doesn't jump when real rows swap in. */
export function SkelMarketRow() {
  return (
    <article className="brow">
      <span className="n">
        <Skel width={28} height={12} />
      </span>
      <div className="q">
        <Skel className="skel-coin" />
        <div className="skel-row" style={{ flex: 1 }}>
          <Skel width="70%" height={16} />
          <Skel width="40%" height={12} />
        </div>
      </div>
      <div className="shr">
        <div className="skel-row">
          <Skel width={40} height={28} />
          <Skel width={60} height={10} />
        </div>
      </div>
      <div className="split skel-row">
        <Skel width="100%" height={8} radius={2} />
        <Skel width="100%" height={14} />
      </div>
      <Skel width="100%" height={38} radius={5} />
    </article>
  );
}

export function SkelBoard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="board">
      {Array.from({ length: rows }).map((_, i) => (
        <SkelMarketRow key={i} />
      ))}
    </div>
  );
}

export function SkelFacts() {
  return (
    <div className="facts">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skel-row">
          <Skel width={70} height={30} />
          <Skel width={90} height={12} />
        </div>
      ))}
    </div>
  );
}

export function SkelHero() {
  return (
    <section className="hero">
      <div>
        <Skel width="90%" height={60} style={{ marginBottom: 10 }} />
        <Skel width="70%" height={60} style={{ marginBottom: 26 }} />
        <Skel width="80%" height={16} style={{ marginBottom: 8 }} />
        <Skel width="60%" height={16} style={{ marginBottom: 30 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <Skel width={220} height={46} radius={10} />
          <Skel width={200} height={46} radius={10} />
        </div>
      </div>
      <div className="slip">
        <div className="skel-row" style={{ padding: "22px 0" }}>
          <Skel width="50%" height={22} />
          <Skel width="90%" height={16} />
          <Skel width="100%" height={60} radius={5} style={{ marginTop: 10 }} />
        </div>
      </div>
    </section>
  );
}

export function SkelDetail() {
  return (
    <div className="detail">
      <div>
        <div className="dh">
          <Skel className="skel-coin" width={52} height={52} />
          <div className="skel-row" style={{ flex: 1 }}>
            <Skel width="80%" height={40} />
            <Skel width="60%" height={16} />
          </div>
        </div>
        <div className="blk skel-row">
          <Skel width={180} height={22} />
          <Skel width="100%" height={14} radius={2} />
          <Skel width="100%" height={200} radius={8} />
        </div>
        <div className="blk skel-row">
          <Skel width={100} height={22} />
          <Skel width="100%" height={14} />
          <Skel width="100%" height={14} />
          <Skel width="80%" height={14} />
        </div>
      </div>
      <aside className="trade">
        <div className="slip skel-row" style={{ padding: "22px 0" }}>
          <Skel width="100%" height={20} />
          <Skel width="100%" height={40} radius={5} />
          <Skel width="100%" height={40} radius={5} />
          <Skel width="100%" height={46} radius={10} />
        </div>
      </aside>
    </div>
  );
}

export function SkelPortfolio() {
  return (
    <>
      <div className="psum">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skel-row">
            <Skel width={80} height={12} />
            <Skel width={100} height={32} />
          </div>
        ))}
      </div>
      <div className="slips">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="slip skel-row" style={{ padding: "22px 0" }}>
            <Skel width="60%" height={18} />
            <Skel width="90%" height={14} />
            <Skel width="100%" height={40} />
          </div>
        ))}
      </div>
    </>
  );
}

export function SkelPaper() {
  return (
    <>
      <div className="certbig skel-row" style={{ alignItems: "center" }}>
        <Skel width={200} height={14} />
        <Skel width={260} height={80} style={{ margin: "10px 0" }} />
        <Skel width={360} height={14} />
      </div>
      <div className="zeros">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel-row">
            <Skel width={80} height={12} />
            <Skel width={60} height={30} />
          </div>
        ))}
      </div>
      <div className="two">
        <div className="blk skel-row">
          <Skel width={150} height={22} />
          <Skel width="100%" height={200} radius={8} />
        </div>
        <div className="blk skel-row">
          <Skel width={150} height={22} />
          <Skel width="100%" height={16} />
          <Skel width="100%" height={16} />
          <Skel width="100%" height={16} />
        </div>
      </div>
    </>
  );
}

export function SkelActivity() {
  return (
    <div className="tapewrap">
      {/* Skeleton header */}
      <div style={{ borderBottom: "2px solid var(--ink)", paddingBottom: 20, marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div className="skel-row">
          <Skel width={260} height={52} />
          <Skel width={320} height={14} />
        </div>
        <Skel width={130} height={32} radius={99} />
      </div>
      {/* Skeleton rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="tl2">
          <Skel width={52} height={13} />
          <div className="skel-row">
            <Skel width={80} height={18} radius={4} />
            <Skel width={60} height={11} />
          </div>
          <Skel width="80%" height={13} />
          <Skel width={28} height={12} style={{ justifySelf: "end" }} />
        </div>
      ))}
    </div>
  );
}

export function SkelStats() {
  return (
    <>
      <SkelFacts />
      <div className="blk" style={{ marginTop: 44 }}>
        <Skel width={100} height={22} style={{ marginBottom: 12 }} />
        <div className="zeros">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skel-row">
              <Skel width={70} height={12} />
              <Skel width={50} height={26} />
            </div>
          ))}
        </div>
      </div>
      <div className="blk skel-row">
        <Skel width={160} height={22} />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skel key={i} width="100%" height={20} />
        ))}
      </div>
    </>
  );
}

export function SkelProof() {
  return (
    <div className="record">
      <div className="slip skel-row" style={{ padding: "30px 32px 0" }}>
        <Skel width="50%" height={28} />
        <Skel width="80%" height={20} style={{ margin: "10px 0 14px" }} />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skel key={i} width="100%" height={16} />
        ))}
      </div>
    </div>
  );
}
