import Link from "next/link";
import Countdown from "./Countdown";
import { collateralToNumber } from "@/lib/client/format";
import type { MarketRow as MarketRowType } from "@/lib/client/types";

function calculatePays(own: number, other: number): string {
  if (own <= 0) return "1.00";
  return (1 + (other * 0.98) / own).toFixed(2);
}

export default function MarketRow({ market }: { market: MarketRowType }) {
  const yes = collateralToNumber(market.yes_pool);
  const no = collateralToNumber(market.no_pool);
  const total = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;
  const noPct = 100 - yesPct;
  const open = market.status === "open";

  return (
    <article className="landing-row">
      <div className="pno">
        <b>{market.id.slice(-3).toUpperCase()}</b>
        <span>{market.asset_symbol} / USD</span>
      </div>
      <h2 className="landing-q">
        <Link href={`/app/market/${market.id}`}>{market.question}</Link>
      </h2>
      <div className="pool">
        <div className="pool-nums">
          <span>
            ${yes.toLocaleString("en-US")}
            <i>YES</i>
          </span>
          <span>
            ${no.toLocaleString("en-US")}
            <i>NO</i>
          </span>
        </div>
        <div className="landing-split">
          <span className="y" style={{ "--w": `${yesPct}%` } as React.CSSProperties} />
          <span className="n" />
        </div>
        <div className="pool-pct">
          <span>{yesPct}%</span>
          <span>{noPct}%</span>
        </div>
      </div>

      {open ? (
        <div className="take">
          <Link className="pick yes" href={`/app/market/${market.id}?side=yes`} aria-label={`Bet YES on ${market.question}`}>
            <span className="pick-side">YES</span>
            <span className="pick-pays">
              pays <b>{calculatePays(yes, no)}</b>
            </span>
            <span className="arr" aria-hidden="true">
              →
            </span>
          </Link>
          <Link className="pick no" href={`/app/market/${market.id}?side=no`} aria-label={`Bet NO on ${market.question}`}>
            <span className="pick-side">NO</span>
            <span className="pick-pays">
              pays <b>{calculatePays(no, yes)}</b>
            </span>
            <span className="arr" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      ) : (
        <div className="take">
          <span className="mini-stamp wait" style={{ gridColumn: "1 / -1", justifySelf: "start" }}>
            {market.status === "locked" ? (
              "Pool locked"
            ) : market.status === "resolved" ? (
              `${market.yes_won ? "YES" : "NO"} won`
            ) : market.status === "cancelled" ? (
              "Cancelled"
            ) : (
              "Settled"
            )}
          </span>
        </div>
      )}

      {open && (
        <p
          style={{
            gridColumn: "1/-1",
            margin: "-10px 0 0",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: ".04em",
            color: "var(--ink-2)",
          }}
        >
          Closes in <Countdown to={market.betting_closes_at} /> · {market.bettor_count ?? 0} bettors
        </p>
      )}
    </article>
  );
}
