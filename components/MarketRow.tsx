import Link from "next/link";
import Coin from "./Coin";
import StatusPill from "./StatusPill";
import Countdown from "./Countdown";
import { Spark } from "./Chart";
import { short, pct, collateralToNumber } from "@/lib/client/format";
import type { MarketRow as MarketRowType } from "@/lib/client/types";

export default function MarketRow({ market }: { market: MarketRowType }) {
  const yes = collateralToNumber(market.yes_pool);
  const no = collateralToNumber(market.no_pool);
  const p = pct(yes, no);
  const open = market.status === "open";

  return (
    <article className="brow">
      <span className="n">#{market.id.slice(-4)}</span>
      <div className="q">
        <Coin symbol={market.asset_symbol} />
        <div>
          <h3>
            <Link href={`/app/market/${market.id}`}>{market.question}</Link>
          </h3>
          <small>
            <span>
              {open ? (
                <>
                  Closes in <Countdown to={market.betting_closes_at} />
                </>
              ) : market.status === "locked" ? (
                "Pool locked"
              ) : market.status === "cancelled" ? (
                "Cancelled"
              ) : (
                "Settled"
              )}
            </span>
            <span>{market.bettor_count ?? 0} bettors</span>
          </small>
        </div>
      </div>
      <div className="shr">
        <div>
          <b>{p}%</b>
          <small>of the pool on YES</small>
        </div>
        <Spark marketId={market.id} yesPct={p} />
      </div>
      <div className="split">
        <div className="poolbar" role="img" aria-label={`${p}% of the pool is on YES`}>
          <i style={{ width: `${p}%` }}></i>
        </div>
        <div className="pool-row">
          <span className="y">YES {short(yes)}</span>
          <span className="n">NO {short(no)}</span>
        </div>
      </div>
      {open ? (
        <div className="acts2">
          <Link className="bet y" href={`/app/market/${market.id}?side=yes`}>
            Bet YES
          </Link>
          <Link className="bet n" href={`/app/market/${market.id}?side=no`}>
            Bet NO
          </Link>
        </div>
      ) : market.status === "resolved" ? (
        <span className={"mini-stamp won-" + (market.yes_won ? "yes" : "no")}>{market.yes_won ? "yes" : "no"} won</span>
      ) : market.status === "cancelled" ? (
        <span className="mini-stamp cancelled">Cancelled</span>
      ) : (
        <span className="mini-stamp wait">Waiting</span>
      )}
    </article>
  );
}
