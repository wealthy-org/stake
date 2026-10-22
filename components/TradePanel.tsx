"use client";

import { useEffect, useState } from "react";
import { useWallet, useToast } from "./providers";
import { placeBet, faucet } from "@/lib/client/api";
import { collateralToNumber, dollarsToBaseUnits, usd, num } from "@/lib/client/format";
import { previewSettle } from "@/lib/client/estimate";
import type { MarketRow, PositionRow } from "@/lib/client/types";
import { useOnChainBet, useOnChainFaucet } from "@/lib/web3/useMarketContract";
import { friendlyWeb3Error } from "@/lib/web3/errors";

const COLLATERAL_ADDRESS = process.env.NEXT_PUBLIC_COLLATERAL_TOKEN as `0x${string}` | undefined;

export default function TradePanel({
  market,
  myPosition,
  emissionRate,
  initialSide,
  onChanged,
  onSideChange,
}: {
  market: MarketRow;
  myPosition: PositionRow | null;
  emissionRate: number;
  initialSide: "yes" | "no";
  onChanged: () => void;
  onSideChange?: (side: "yes" | "no") => void;
}) {
  const { address, summary, refresh, isOnChain } = useWallet();
  const toast = useToast();
  const [side, setSide] = useState<"yes" | "no">(initialSide);
  const [amt, setAmt] = useState("100");
  const [busy, setBusy] = useState(false);

  // On-chain pilot: only markets with a deployed PaperBetMarket clone, and
  // only while the wallet is actually connected on Robinhood Chain, send a
  // real transaction. Every other market keeps using the DB ledger exactly
  // as before — this is additive, nothing existing changes behavior.
  const onChainMode = Boolean(market.contract_address && isOnChain);
  const { betOnChain, step: onChainStep } = useOnChainBet(
    market.contract_address as `0x${string}` | undefined,
    COLLATERAL_ADDRESS
  );
  const { mintToSelf, busy: faucetBusy } = useOnChainFaucet(COLLATERAL_ADDRESS);

  useEffect(() => {
    setSide(initialSide);
  }, [initialSide]);

  function pick(s: "yes" | "no") {
    setSide(s);
    onSideChange?.(s);
  }

  const amount = Math.max(0, parseFloat(amt) || 0);
  const yesPool = collateralToNumber(market.yes_pool);
  const noPool = collateralToNumber(market.no_pool);
  const myYes = myPosition ? collateralToNumber(myPosition.yes_stake) : 0;
  const myNo = myPosition ? collateralToNumber(myPosition.no_stake) : 0;

  const ys = myYes + (side === "yes" ? amount : 0);
  const ns = myNo + (side === "no" ? amount : 0);
  const py = yesPool + (side === "yes" ? amount : 0);
  const pn = noPool + (side === "no" ? amount : 0);
  const show = previewSettle(py, pn, ys, ns, side, market.protocol_fee_bps, emissionRate);
  const other = previewSettle(py, pn, ys, ns, side === "yes" ? "no" : "yes", market.protocol_fee_bps, emissionRate);
  const oside = side === "yes" ? "NO" : "YES";

  const balance = summary ? collateralToNumber(summary.virtualBalance) : 0;
  const minBet = collateralToNumber(market.min_bet);
  const maxBet = collateralToNumber(market.max_bet);

  async function handleBet() {
    if (!address) return;
    setBusy(true);
    try {
      if (onChainMode) {
        await betOnChain(side, amount);
        toast(`On-chain bet sent: ${usd(amount, 0)} on ${side.toUpperCase()}`);
      } else {
        await placeBet(market.id, address, side, dollarsToBaseUnits(amount));
        toast(`Bet placed: ${usd(amount, 0)} on ${side.toUpperCase()}`);
      }
      await refresh();
      onChanged();
    } catch (err) {
      toast(onChainMode ? friendlyWeb3Error(err) : err instanceof Error ? err.message : "Bet failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFaucet() {
    if (!address) return;
    setBusy(true);
    try {
      await faucet(address, dollarsToBaseUnits(1000));
      toast("Topped up 1,000 virtual USDG");
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Faucet failed");
    } finally {
      setBusy(false);
    }
  }

  const step = !address ? 0 : balance < amount ? 1 : 2;

  return (
    <>
      <div className="steps" aria-hidden="true">
        <span className="on"></span>
        <span className={step >= 1 ? "on" : ""}></span>
        <span className={step >= 2 ? "on" : ""}></span>
      </div>
      <div className="slip-h">
        <b>Bet slip</b>
        <span className="no">
          {onChainMode ? "On-chain · " : ""}No. {market.id.slice(-4)}
        </span>
      </div>
      <div className="fl">
        <span>Your pick</span>
        <span className="fill tickrow">
          <button className={"tk yes" + (side === "yes" ? " on" : "")} onClick={() => pick("yes")}>
            YES
          </button>
          <button className={"tk no" + (side === "no" ? " on" : "")} onClick={() => pick("no")}>
            NO
          </button>
        </span>
      </div>
      <div className="fl">
        <span>Stake</span>
        <label className="fill stake">
          <span className="cur">$</span>
          <input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} />
          <em>USDG</em>
        </label>
      </div>
      <div className="chips">
        {[10, 50, 100, 500].map((v) => (
          <button key={v} className={Number(amt) === v ? "on" : ""} onClick={() => setAmt(String(v))}>
            ${v}
          </button>
        ))}
      </div>
      {(myYes > 0 || myNo > 0) && (
        <div className="pos">
          <h4>Already on this market</h4>
          <div className="ld">
            <span>YES</span>
            <i></i>
            <b>{usd(myYes, 0)}</b>
          </div>
          <div className="ld">
            <span>NO</span>
            <i></i>
            <b>{usd(myNo, 0)}</b>
          </div>
        </div>
      )}
      <div style={{ margin: "6px 0 16px" }}>
        <div className="ld">
          <span>To collect if {side.toUpperCase()} wins</span>
          <i></i>
          <b>{usd(show.payout)}</b>
        </div>
        <div className="ld">
          <span>If {oside} wins, net loss</span>
          <i></i>
          <b>{usd(other.loss)}</b>
        </div>
        <div className="ld">
          <span>STAKE on that loss</span>
          <i></i>
          <b>{num(other.paper)}</b>
        </div>
        <div className="ld">
          <span>Bet bounds</span>
          <i></i>
          <b>
            {usd(minBet, 0)}–{usd(maxBet, 0)}
          </b>
        </div>
      </div>

      {address && onChainMode && (
        <button
          className="btn ghost sm block"
          style={{ marginBottom: 10 }}
          disabled={faucetBusy}
          onClick={async () => {
            try {
              await mintToSelf(1000);
              toast("Minted 1,000 mUSDG to your wallet on-chain");
            } catch (err) {
              toast(friendlyWeb3Error(err));
            }
          }}
        >
          {faucetBusy ? "Minting…" : "Get on-chain test funds (1,000 mUSDG)"}
        </button>
      )}

      {!address ? (
        <p className="note">Connect a wallet (top right) to bet.</p>
      ) : balance < amount ? (
        <button className="btn big block gold" disabled={busy} onClick={handleFaucet}>
          Get test funds (virtual balance: {usd(balance, 0)})
        </button>
      ) : (
        <button className={"btn big block " + side} disabled={busy || amount < minBet || amount > maxBet} onClick={handleBet}>
          {busy
            ? onChainMode
              ? onChainStep === "approving"
                ? "Approving collateral…"
                : "Confirming on-chain bet…"
              : "Placing bet…"
            : `Place bet, ${side.toUpperCase()} ${usd(amount, 0)}`}
        </button>
      )}
      <div className="perf"></div>
      <p className="stubnote">
        Keep your stub. If you lose, your verified net loss becomes STAKE you can claim. You can lose your entire
        stake.
      </p>
    </>
  );
}
