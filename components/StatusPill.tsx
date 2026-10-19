import type { MarketRow } from "@/lib/client/types";

export default function StatusPill({ market }: { market: MarketRow }) {
  if (market.status === "open") return <span className="status open">Open</span>;
  if (market.status === "locked" || market.status === "resolution_pending")
    return <span className="status">Awaiting oracle</span>;
  if (market.status === "cancelled") return <span className="status cancelled">Cancelled</span>;
  return <span className={"status won-" + (market.yes_won ? "yes" : "no")}>{market.yes_won ? "YES" : "NO"} won</span>;
}
