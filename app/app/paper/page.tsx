"use client";

import { useEffect, useState } from "react";
import { SkelPaper } from "@/components/Skeleton";
import { getPaperSummary, getStats, listMarkets } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd, num } from "@/lib/client/format";
import type { PaperSummary, MarketRow, ProtocolStats } from "@/lib/client/types";
import { useWallet, useToast } from "@/components/providers";
import { useRewardVault, useClaimHistory } from "@/lib/web3/useMarketContract";
import { friendlyWeb3Error } from "@/lib/web3/errors";
import { useReadContracts } from "wagmi";
import { rewardVaultAbi } from "@/lib/web3/abi";
import ClaimShareCard from "@/components/ClaimShareCard";

// Pilot RewardVault deployed via contracts/script/TestnetPonsSimulation.s.sol —
// the points+vault model (fine2's "Skenario B"), separate from the legacy
// DB-ledger emission_state read below. Swap this for the real Pons-linked
// vault once the leader's token is live.
const REWARD_VAULT_PILOT = "0xB558f06c3557f090a5Ae1C629D42cE90be422FA6" as const;

const MILESTONES = (totalWagered: number, cumulativeLoss: number, bettors: number, marketsCreated: number, transfersEnabled: boolean) => [
  ["First market", marketsCreated > 0 ? 1 : 0],
  ["First $10K wagered", totalWagered >= 10_000 ? 1 : 0],
  ["First STAKE mint", cumulativeLoss > 0 ? 1 : 0],
  ["First $100K realized loss", cumulativeLoss >= 100_000 ? 1 : 0],
  ["First 1,000 bettors", bettors >= 1000 ? 1 : 0],
  ["Genesis complete", transfersEnabled ? 1 : 0],
  ["Transfers enabled", transfersEnabled ? 1 : 0],
] as const;

function EmissionCurve({ cumulativeLoss, rate }: { cumulativeLoss: number; rate: number }) {
  const W = 640, H = 240, pl = 40, pb = 26, max = Math.max(3_000_000, cumulativeLoss * 1.5);
  // Illustrative only — mirrors the shape of lib/engine/emission.ts's testnet
  // tiers (steep early, flattening out), not a literal re-plot of the
  // piecewise function. The real tiers are shown as text under the chart.
  const R0 = 100;
  const K = 100_000;
  const x = (c: number) => pl + (c / max) * (W - pl - 10);
  const y = (r: number) => 10 + (1 - r / R0) * (H - 10 - pb);
  let d = "";
  for (let c = 0; c <= max; c += max / 60) {
    d += `${c ? "L" : "M"}${x(c).toFixed(1)} ${y(R0 / (1 + c / K)).toFixed(1)} `;
  }
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Illustrative emission rate falling as cumulative realized losses grow">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - 10} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={0} y={y(v) + 4}>{v}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--gold-d)" strokeWidth={2.6} />
      <line x1={x(cumulativeLoss)} x2={x(cumulativeLoss)} y1={10} y2={H - pb} stroke="var(--ink)" strokeDasharray="3 4" />
      <circle cx={x(cumulativeLoss)} cy={y(Math.min(rate, R0))} r={5} fill="var(--gold-d)" />
      <text x={x(cumulativeLoss) + 10} y={y(Math.min(rate, R0)) - 10} style={{ fontWeight: 700, fill: "var(--ink)" }}>
        Now: {rate} STAKE per $1
      </text>
      <text x={pl} y={H - 6}>$0 realized losses</text>
      <text x={W - 10} y={H - 6} textAnchor="end">${(max / 1e6).toFixed(1)}M</text>
    </svg>
  );
}

function toUnitNumber(val?: bigint): number {
  if (!val) return 0;
  if (val > 100_000_000_000_000n) {
    return Number(val) / 1e18;
  }
  return Number(val) / 1e6;
}

function BatchHistorySection({ vaultAddress, count }: { vaultAddress: `0x${string}`; count: number }) {
  const batchCalls = Array.from({ length: Math.min(count, 8) }, (_, i) => ({
    address: vaultAddress,
    abi: rewardVaultAbi,
    functionName: "getBatch" as const,
    args: [BigInt(count - 1 - i)],
  }));

  const { data: batches } = useReadContracts({
    contracts: count > 0 ? (batchCalls as any) : [],
    query: { enabled: count > 0 },
  });

  if (count === 0) {
    return (
      <div style={{ marginTop: 14, padding: "14px 18px", background: "var(--slip)", borderRadius: 6, border: "1px dashed var(--line)", textAlign: "center", fontSize: 13, color: "var(--ink2)" }}>
        No STAKE purchase batch has been executed by the treasury yet. Existing player points are currently <b>pending purchase</b>.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--body)" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left", color: "var(--ink2)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "8px 10px" }}>Batch</th>
            <th style={{ padding: "8px 10px" }}>Spend Budget ($1/Point)</th>
            <th style={{ padding: "8px 10px" }}>STAKE Received</th>
            <th style={{ padding: "8px 10px" }}>Purchase Ratio</th>
            <th style={{ padding: "8px 10px" }}>Wallets</th>
            <th style={{ padding: "8px 10px" }}>Executed At</th>
            <th style={{ padding: "8px 10px" }}>Tx Ref</th>
          </tr>
        </thead>
        <tbody>
          {batches?.map((b: any, idx: number) => {
            const batch = b?.result;
            if (!batch) return null;
            const pointsBurned = toUnitNumber(batch.totalPointsBurned);
            const stakeReceived = toUnitNumber(batch.totalStakePurchased);
            const ratio = pointsBurned > 0 ? (stakeReceived / pointsBurned).toFixed(2) : "—";
            const dateStr = batch.timestamp ? new Date(Number(batch.timestamp) * 1000).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—";
            const txHashRaw = batch.txHash ? String(batch.txHash) : "";
            const isZeroHash = !txHashRaw || /^0x0+$/.test(txHashRaw);
            const txDisplay = isZeroHash ? "On-chain Batch" : `${txHashRaw.slice(0, 8)}…${txHashRaw.slice(-6)}`;

            return (
              <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "9px 10px", fontFamily: "var(--type)", fontWeight: 700 }}>#{Number(batch.batchId) + 1}</td>
                <td style={{ padding: "9px 10px" }}>{usd(pointsBurned, 2)} ({num(pointsBurned)} pts)</td>
                <td style={{ padding: "9px 10px", fontWeight: 700, color: "var(--desk)" }}>{num(stakeReceived, 2)} STAKE</td>
                <td style={{ padding: "9px 10px", fontFamily: "var(--type)" }}>{ratio} STAKE / pt</td>
                <td style={{ padding: "9px 10px" }}>{Number(batch.userCount)}</td>
                <td style={{ padding: "9px 10px", color: "var(--ink2)" }}>{dateStr}</td>
                <td style={{ padding: "9px 10px", fontFamily: "var(--type)", fontSize: 11 }}>{txDisplay}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OnChainVaultSection() {
  const { address, isOnChain } = useWallet();
  const toast = useToast();
  const [shareAmount, setShareAmount] = useState<number | null>(null);
  const {
    totalPendingPoints,
    totalPointsSettled,
    totalStakeDeposited,
    totalStakeClaimed,
    batchHistoryCount,
    myPendingPoints,
    myAllocatedStake,
    myClaimedStake,
    claimFromVault,
    claiming,
  } = useRewardVault(REWARD_VAULT_PILOT);
  const { claims: claimHistory, loading: claimHistoryLoading, refetch: refetchClaimHistory } = useClaimHistory(REWARD_VAULT_PILOT);

  const pendingPointsNum = toUnitNumber(myPendingPoints);
  const allocatedStakeNum = toUnitNumber(myAllocatedStake);
  const claimedStakeNum = toUnitNumber(myClaimedStake);

  const totalPendingNum = toUnitNumber(totalPendingPoints);
  const totalSettledNum = toUnitNumber(totalPointsSettled);
  const totalDepositedStakeNum = toUnitNumber(totalStakeDeposited);
  const totalClaimedStakeNum = toUnitNumber(totalStakeClaimed);
  const batchCount = batchHistoryCount ? Number(batchHistoryCount) : 0;

  const claimable = address && isOnChain && allocatedStakeNum > 0;

  return (
    <>
      <div className="certbig">
        <div className="k">STAKE reward</div>
        <h1>{address ? num(allocatedStakeNum, 2) : "—"}</h1>
        <p>
          Net-loss points reward: players who end up net-negative on Stake markets earn points, each worth a $1
          treasury budget to buy STAKE on the open market (Pons V2 / Uniswap v4). This is your locked-in STAKE
          allocation from completed purchase batches, ready to claim.
        </p>
        <span className="serial">STAKE ready to claim</span>
        <span className={"stamp" + (claimable ? " gold" : " acc")}>{claimable ? "Claimable" : "Pending"}</span>
      </div>

      {address && isOnChain && (
        <div style={{ textAlign: "center", marginTop: -16, marginBottom: 28 }}>
          <button
            className="btn gold"
            disabled={claiming || allocatedStakeNum <= 0}
            onClick={async () => {
              const claimedNow = allocatedStakeNum;
              try {
                await claimFromVault();
                toast("STAKE claimed to your wallet!");
                setShareAmount(claimedNow);
                setTimeout(refetchClaimHistory, 2500);
              } catch (err) {
                toast(friendlyWeb3Error(err));
              }
            }}
          >
            {claiming ? "Sending STAKE…" : allocatedStakeNum > 0 ? `Claim ${num(allocatedStakeNum, 2)} STAKE` : "No Tokens Ready To Claim"}
          </button>
        </div>
      )}

      {shareAmount !== null && (
        <ClaimShareCard
          amount={shareAmount}
          batchId={batchCount > 0 ? batchCount - 1 : null}
          onClose={() => setShareAmount(null)}
        />
      )}

      {/* 3 headline status figures per brief §5 — this wallet's own standing */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink3)", marginBottom: 8 }}>
        Your STAKE
      </p>
      <div className="zeros" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div>
          <small>Points pending purchase</small>
          <b>{address ? num(pendingPointsNum, 2) : "—"} Points</b>
        </div>
        <div>
          <small>STAKE ready to claim</small>
          <b>{address ? num(allocatedStakeNum, 2) : "—"} STAKE</b>
        </div>
        <div>
          <small>STAKE already claimed</small>
          <b>{address ? num(claimedStakeNum, 2) : "—"} STAKE</b>
        </div>
      </div>

      {!isOnChain && (
        <p className="note" style={{ marginTop: -6, marginBottom: 20 }}>
          Connect a wallet on Robinhood Chain Testnet to see your net-loss points and claim your STAKE allocation.
        </p>
      )}

      {/* Per-wallet claim history — the vault only stores a running total
          (claimedStake), so this reads individual past RewardClaimed events. */}
      {address && isOnChain && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink3)", margin: 0 }}>
              Your claim history
            </p>
            {claimHistoryLoading && <span style={{ fontSize: 11, color: "var(--ink3)" }}>Loading…</span>}
          </div>
          {claimHistory.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink2)" }}>
              {claimHistoryLoading ? "Checking the chain for past claims…" : "No claims yet from this wallet."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {claimHistory.map((c) => (
                <div
                  key={c.txHash}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--slip)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13 }}
                >
                  <span>
                    <b>{num(toUnitNumber(c.amount), 2)} STAKE</b>{" "}
                    <span style={{ color: "var(--ink2)" }}>
                      {c.timestamp ? new Date(c.timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : `Block #${c.blockNumber}`}
                    </span>
                  </span>
                  <a
                    href={`https://explorer.testnet.chain.robinhood.com/tx/${c.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, fontFamily: "var(--type)" }}
                  >
                    {c.txHash.slice(0, 8)}...{c.txHash.slice(-6)} ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Protocol-wide figures — deliberately smaller/muted than "Your STAKE" above, so the two never read as duplicates */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink3)", marginTop: 4, marginBottom: 12 }}>
        Protocol-wide totals
      </p>
      <div className="subzeros" style={{ marginTop: 0, marginBottom: 28 }}>
        <div>
          <small>Total pending points (global)</small>
          <b>{num(totalPendingNum)} Points</b>
        </div>
        <div>
          <small>Total points converted</small>
          <b>{num(totalSettledNum)} Points</b>
        </div>
        <div>
          <small>Total STAKE deposited by treasury</small>
          <b>{num(totalDepositedStakeNum, 2)} STAKE</b>
        </div>
        <div>
          <small>Total STAKE claimed</small>
          <b>{num(totalClaimedStakeNum, 2)} STAKE</b>
        </div>
        <div>
          <small>Pilot RewardVault contract</small>
          <b style={{ fontFamily: "var(--type)", fontSize: 14 }}>
            {REWARD_VAULT_PILOT.slice(0, 8)}...{REWARD_VAULT_PILOT.slice(-6)}
          </b>
        </div>
      </div>

      <div style={{ padding: "14px 18px", borderRadius: 8, background: "var(--slip)", border: "1px solid var(--line)", marginBottom: 36 }}>
        <b style={{ fontSize: 13, color: "var(--ink)" }}>Conversion &amp; STAKE value principles</b>
        <ul style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 13, color: "var(--ink2)", lineHeight: 1.6 }}>
          <li><b>Not 10 Points = 10 STAKE:</b> the amount of token you receive isn&rsquo;t fixed — it follows the treasury&rsquo;s real market purchase result, split evenly per point within that batch.</li>
          <li><b>Points expire after a batch:</b> once converted, points are burned and can no longer earn a reward from any future deposit/batch.</li>
          <li><b>Claiming is price-risk-free:</b> once a STAKE allocation is locked in, your token amount is permanently fixed until you claim it.</li>
        </ul>
      </div>

      {/* Treasury purchase batch history */}
      <div className="blk">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>Treasury purchase batch history</h3>
          <span style={{ fontSize: 12, color: "var(--ink3)" }}>Total {batchCount} batches executed</span>
        </div>
        <BatchHistorySection vaultAddress={REWARD_VAULT_PILOT} count={batchCount} />
      </div>
    </>
  );
}

export default function PaperPage() {
  const [paper, setPaper] = useState<PaperSummary | null>(null);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [stats, setStats] = useState<ProtocolStats | null>(null);

  useEffect(() => {
    getPaperSummary().then(setPaper).catch(() => {});
    listMarkets().then(setMarkets).catch(() => {});
    getStats().then(setStats).catch(() => {});
  }, []);

  if (!paper) return <SkelPaper />;

  const supply = paperToNumber(paper.supply);
  const cumulativeLoss = collateralToNumber(paper.cumulativeRealizedLoss);
  const totalWagered = stats ? collateralToNumber(stats.totalWagered) : 0;
  const uniqueBettors = stats?.uniqueBettors ?? 0;

  return (
    <>
      <OnChainVaultSection />

      <details className="legacy-archive" style={{ marginTop: 36 }}>
        <summary>
          <span className="k" style={{ fontSize: 11 }}>Archived · pre-Pons model</span>
          <b>Legacy mint-based STAKE ledger</b>
          <span className="chev">▾</span>
        </summary>

        <div className="certbig" style={{ marginTop: 18 }}>
          <div className="k">Certificate of ownership</div>
          <h1>{Math.round(supply).toLocaleString("en-US")}</h1>
          <p>
            Legacy DB-ledger model (pre-Pons pivot): STAKE entered supply through verified realized losses, with no
            team allocation and no premint. Kept here as a record of the original mint-based design — see the
            points+vault pilot above for the current direction.
          </p>
          <span className="serial">Supply today (legacy)</span>
          <span className="stamp gold">{paper.transfersEnabled ? "Transfers enabled" : "Transfers locked"}</span>
        </div>

        <div className="zeros">
          <div>
            <small>Genesis supply</small>
            <b>0</b>
          </div>
          <div>
            <small>Team allocation</small>
            <b>0</b>
          </div>
          <div>
            <small>VC allocation</small>
            <b>0</b>
          </div>
          <div>
            <small>Airdrop</small>
            <b>0</b>
          </div>
        </div>

        <div className="two">
          <div className="blk">
            <h3>Emission rate</h3>
            <p style={{ fontSize: 14 }}>
              Cumulative realized losses so far are {usd(cumulativeLoss, 0)}. The rate for each dollar of net loss
              falls as that total grows.
            </p>
            <EmissionCurve cumulativeLoss={cumulativeLoss} rate={paper.currentEmissionRatePerDollar} />
            <p className="note">
              Illustrative curve shape. Real tiers (testnet-only, not approved mainnet tokenomics — brief §16):
              100 STAKE/$ up to $100K, 40/$ to $1M, 10/$ to $10M, 3/$ beyond.
            </p>
          </div>
          <div className="blk">
            <h3>Genesis progress</h3>
            <ul className="tl">
              {MILESTONES(totalWagered, cumulativeLoss, uniqueBettors, markets.length, paper.transfersEnabled).map(([label, done]) => (
                <li key={label} className={done ? "done" : ""}>
                  <i></i>
                  <b>{label}</b>
                  <small>{done ? "Reached" : "Not yet"}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </>
  );
}
