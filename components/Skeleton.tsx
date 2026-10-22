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

/** Mirrors MarketRow's tote-row grid so the board doesn't jump when real rows swap in. */
export function SkelMarketRow() {
  return (
    <article className="landing-row">
      <div className="pno">
        <Skel width={44} height={40} />
      </div>
      <div className="skel-row">
        <Skel width="70%" height={28} />
      </div>
      <div className="pool skel-row">
        <Skel width="100%" height={12} />
        <Skel width="100%" height={12} radius={2} />
      </div>
      <div className="take">
        <Skel width="100%" height={46} radius={3} />
        <Skel width="100%" height={46} radius={3} />
      </div>
    </article>
  );
}

export function SkelBoard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="tote">
      {Array.from({ length: rows }).map((_, i) => (
        <SkelMarketRow key={i} />
      ))}
    </div>
  );
}

export function SkelFacts({ count = 5 }: { count?: number }) {
  return (
    <div className={"facts" + (count === 4 ? " f4" : "")}>
      {Array.from({ length: count }).map((_, i) => (
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

/** Mirrors the Home dashboard's .poly-hero (featured spotlight + trending leaderboard) so it doesn't just vanish while markets load. */
export function SkelPolyHero() {
  return (
    <div className="poly-hero">
      <div className="poly-featured-card">
        <div className="poly-featured-header skel-row" style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Skel width={120} height={16} />
          <Skel width={80} height={16} />
        </div>
        <Skel width="85%" height={26} style={{ margin: "14px 0" }} />
        <div className="poly-odds-row">
          <Skel height={64} radius={10} />
          <Skel height={64} radius={10} />
        </div>
        <Skel width="100%" height={180} radius={8} style={{ marginTop: 16 }} />
        <div className="poly-featured-bet-btns" style={{ marginTop: 16 }}>
          <Skel height={44} radius={10} />
          <Skel height={44} radius={10} />
        </div>
      </div>
      <div className="poly-trending-card">
        <div className="trending-head skel-row" style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Skel width={90} height={16} />
          <Skel width={60} height={14} />
        </div>
        <ul className="trending-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="skel-row" style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: "10px 0" }}>
              <Skel width={18} height={14} />
              <Skel width={28} height={28} radius={99} />
              <Skel width="50%" height={14} />
              <Skel width={50} height={12} style={{ marginLeft: "auto" }} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Mirrors the Home dashboard's .poly-market-grid card layout (not the row-table SkelBoard uses) so grid view doesn't jump when real cards swap in. */
export function SkelMarketGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="poly-market-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="poly-market-card skel-row">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Skel width={24} height={24} radius={99} />
              <Skel width={70} height={13} />
            </div>
            <Skel width={40} height={16} radius={99} />
          </div>
          <Skel width="90%" height={18} style={{ marginTop: 10 }} />
          <Skel width="60%" height={18} style={{ marginTop: 6 }} />
          <Skel width="100%" height={8} radius={4} style={{ marginTop: 14 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Skel height={40} radius={8} style={{ flex: 1 }} />
            <Skel height={40} radius={8} style={{ flex: 1 }} />
          </div>
        </div>
      ))}
    </div>
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
