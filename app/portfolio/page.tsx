"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/providers";
import ResultSlip from "@/components/ResultSlip";
import { Skel, SkelPortfolio } from "@/components/Skeleton";
import { getMarket } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd } from "@/lib/client/format";
import type { MarketRow, WalletPosition } from "@/lib/client/types";

function SettledSlip({ marketId, position, onChanged }: { marketId: string; position: WalletPosition; onChanged: () => void }) {
  const [market, setMarket] = useState<MarketRow | null>(null);

  useEffect(() => {
    getMarket(marketId)
      .then((d) => setMarket(d.market))
      .catch(() => {});
  }, [marketId]);

  if (!market)
    return (
      <div className="skel-row">
        <Skel width="100%" height={14} />
        <Skel width="100%" height={40} />
      </div>
    );
  return <ResultSlip market={market} position={position} onChanged={onChanged} />;
}

export default function PortfolioPage() {
  const { address, summary, connectInjected, connectTestAddress, refresh } = useWallet();

  if (!address) {
    return (
      <>
        <div className="sec" style={{ marginTop: 0 }}>
          <h2>Your slips</h2>
        </div>
        <div className="empty">
          <h3>Connect a wallet to see your slips</h3>
          <p>Open bets, claimable winnings and STAKE certificates show up here.</p>
          <button className="btn big" onClick={connectInjected}>
            Connect wallet
          </button>{" "}
          <button className="btn big ghost" onClick={connectTestAddress}>
            Use a test address
          </button>
        </div>
      </>
    );
  }

  if (!summary)
    return (
      <>
        <div className="sec" style={{ marginTop: 0 }}>
          <h2>Your slips</h2>
        </div>
        <SkelPortfolio />
      </>
    );

  const balance = collateralToNumber(summary.virtualBalance);
  const paperBalance = paperToNumber(summary.paperBalance);
  const openExposure = summary.positions
    .filter((p) => p.status !== "resolved" && p.status !== "cancelled")
    .reduce((sum, p) => sum + collateralToNumber(p.yes_stake) + collateralToNumber(p.no_stake), 0);

  return (
    <>
      <div className="sec" style={{ marginTop: 0 }}>
        <h2>Your slips</h2>
        <span className="status">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
      </div>
      <div className="psum" style={{ marginTop: 22 }}>
        <div>
          <small>Virtual balance</small>
          <b>{usd(balance, 0)}</b>
        </div>
        <div>
          <small>STAKE balance</small>
          <b style={{ color: "var(--gold-d)" }}>{paperBalance.toLocaleString("en-US")}</b>
        </div>
        <div>
          <small>Open exposure</small>
          <b>{usd(openExposure, 0)}</b>
        </div>
      </div>

      {summary.positions.length === 0 ? (
        <div className="empty">
          <h3>No slips yet</h3>
          <p>Place a bet on an open market to see it here.</p>
          <Link className="btn big" href="/">
            See the board
          </Link>
        </div>
      ) : (
        <div className="slips">
          {summary.positions.map((pos) => (
            <div key={pos.market_id} className="slip rs">
              <div className="slip-h">
                <b>{pos.status === "resolved" || pos.status === "cancelled" ? "Settled slip" : "Open slip"}</b>
                <span className="no">
                  <Link href={`/market/${pos.market_id}`}>No. {pos.market_id.slice(-4)}</Link>
                </span>
              </div>
              <div className="slip-q" style={{ fontSize: 15 }}>
                {pos.question}
              </div>
              {pos.status === "resolved" || pos.status === "cancelled" ? (
                <SettledSlip marketId={pos.market_id} position={pos} onChanged={refresh} />
              ) : (
                <>
                  <div className="ld">
                    <span>YES exposure</span>
                    <i></i>
                    <b>{usd(collateralToNumber(pos.yes_stake), 0)}</b>
                  </div>
                  <div className="ld">
                    <span>NO exposure</span>
                    <i></i>
                    <b>{usd(collateralToNumber(pos.no_stake), 0)}</b>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
