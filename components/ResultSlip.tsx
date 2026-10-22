"use client";

import { useState } from "react";
import { useWallet, useToast } from "./providers";
import { claimPayout, claimPaper } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd, num } from "@/lib/client/format";
import type { MarketRow, PositionRow } from "@/lib/client/types";
import { useOnChainClaim } from "@/lib/web3/useMarketContract";
import { friendlyWeb3Error } from "@/lib/web3/errors";

/** Resolved-market winner/loser/cancelled-refund slip, with working claim buttons (brief §30/§44). */
export default function ResultSlip({ market, position, onChanged }: { market: MarketRow; position: PositionRow; onChanged: () => void }) {
  const { address, refresh, isOnChain } = useWallet();
  const toast = useToast();
  const [busy, setBusy] = useState<"payout" | "paper" | null>(null);

  // Same on-chain pilot gate as TradePanel: only markets with a deployed
  // clone, and only while the wallet is actually on Robinhood Chain, send
  // real claim transactions. Everything else keeps using the DB ledger.
  const onChainMode = Boolean(market.contract_address && isOnChain);
  const { claimPayoutOnChain, claimPaperOnChain } = useOnChainClaim(
    market.contract_address as `0x${string}` | undefined
  );

  const yesStake = collateralToNumber(position.yes_stake);
  const noStake = collateralToNumber(position.no_stake);
  const totalStake = yesStake + noStake;
  const both = yesStake > 0 && noStake > 0;

  if (market.status === "cancelled") {
    return (
      <div className="slip rs">
        <div className="slip-h">
          <b>Cancelled</b>
          <span className="no">No. {market.id.slice(-4)}</span>
        </div>
        <div className="slip-q" style={{ fontSize: 15 }}>
          {market.question}
        </div>
        <p style={{ fontSize: 13, color: "var(--ink2)" }}>
          {market.cancel_reason === "empty_side_pool" || market.cancel_reason === "zero_pool_at_settlement"
            ? "One side of the pool was empty at close, so this market cancelled instead of settling into broken math."
            : "This market was cancelled before resolution."}{" "}
          Every stake is refunded in full, with no fee and no STAKE.
        </p>
        <div className="stubs">
          <div className="srow pay">
            <div>
              <small>To collect (refund)</small>
              <b>{usd(totalStake, 0)}</b>
            </div>
            {position.payout_claimed ? (
              <span className="done">Claimed</span>
            ) : (
              <button
                className="btn sm yes"
                disabled={busy !== null}
                onClick={async () => {
                  if (!address) return;
                  setBusy("payout");
                  try {
                    if (onChainMode) await claimPayoutOnChain();
                    else await claimPayout(market.id, address);
                    toast("Refund claimed");
                    await refresh();
                    onChanged();
                  } catch (err) {
                    toast(onChainMode ? friendlyWeb3Error(err) : err instanceof Error ? err.message : "Claim failed");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Claim refund
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const winnerStake = market.yes_won ? yesStake : noStake;
  const rewardPerShare = market.reward_per_winning_share ? Number(market.reward_per_winning_share) : 0;
  const winningPool = collateralToNumber(market.yes_won ? market.yes_pool : market.no_pool);
  const profit = winnerStake > 0 && rewardPerShare > 0 ? (winnerStake * rewardPerShare) / 1e18 : 0;
  const payout = winnerStake > 0 ? winnerStake + profit : 0;
  const netPnl = payout - totalStake;
  const realizedLoss = position.realized_loss ? collateralToNumber(position.realized_loss) : Math.max(0, -netPnl);
  const paperAmount = position.paper_minted ? paperToNumber(position.paper_minted) : null;
  const won = netPnl > 0.005;
  const lost = realizedLoss > 0.005 || position.loss_reward_claimed;

  return (
    <div className="slip rs">
      <div className="slip-h">
        <b>{both ? "Both sides" : "Settled slip"}</b>
        <span className="no">No. {market.id.slice(-4)}</span>
      </div>
      <div className="slip-q" style={{ fontSize: 15 }}>
        {market.question}
      </div>
      <div className="ld">
        <span>Total stake</span>
        <i></i>
        <b>{usd(totalStake, 0)}</b>
      </div>
      <div className="ld">
        <span>Total payout</span>
        <i></i>
        <b>{usd(payout)}</b>
      </div>
      {lost ? (
        <div className="ld">
          <span>Net realized loss</span>
          <i></i>
          <b>{usd(realizedLoss)}</b>
        </div>
      ) : (
        <div className="ld">
          <span>Profit</span>
          <i></i>
          <b>{usd(Math.max(0, netPnl))}</b>
        </div>
      )}
      {both && lost && (
        <p style={{ fontSize: 13, color: "var(--ink2)", marginTop: 6 }}>
          STAKE is based on the {usd(realizedLoss)} net loss, not the losing side&rsquo;s gross stake.
        </p>
      )}
      <span className={"stamp sm " + (won ? "won" : "lost")}>{won ? "Won" : both ? "Net loss" : "Lost"}</span>
      <div className="stubs">
        {payout > 0.005 && (
          <div className="srow pay">
            <div>
              <small>To collect</small>
              <b>{usd(payout)}</b>
            </div>
            {position.payout_claimed ? (
              <span className="done">Claimed</span>
            ) : (
              <button
                className="btn sm yes"
                disabled={busy !== null}
                onClick={async () => {
                  if (!address) return;
                  setBusy("payout");
                  try {
                    if (onChainMode) await claimPayoutOnChain();
                    else await claimPayout(market.id, address);
                    toast(`Claimed ${usd(payout)} USDG`);
                    await refresh();
                    onChanged();
                  } catch (err) {
                    toast(onChainMode ? friendlyWeb3Error(err) : err instanceof Error ? err.message : "Claim failed");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Claim
              </button>
            )}
          </div>
        )}
        {realizedLoss > 0.005 && (
          <div className="srow mc">
            <div>
              <small>STAKE certificate</small>
              <b>{paperAmount !== null ? num(paperAmount) : "—"} STAKE</b>
            </div>
            {position.loss_reward_claimed ? (
              <span className="done">Claimed</span>
            ) : (
              <button
                className="btn sm gold"
                disabled={busy !== null}
                onClick={async () => {
                  if (!address) return;
                  setBusy("paper");
                  try {
                    if (onChainMode) {
                      await claimPaperOnChain();
                      toast("STAKE points accrued — claim the token itself from the STAKE page once the reward vault is funded");
                    } else {
                      const res = await claimPaper(market.id, address);
                      toast(`Claimed ${num(paperToNumber(res.paperMinted))} STAKE`);
                    }
                    await refresh();
                    onChanged();
                  } catch (err) {
                    toast(onChainMode ? friendlyWeb3Error(err) : err instanceof Error ? err.message : "Claim failed");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Claim
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
