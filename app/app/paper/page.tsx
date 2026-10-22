"use client";

import { useEffect, useState } from "react";
import { SkelPaper } from "@/components/Skeleton";
import { getPaperSummary, getStats, listMarkets } from "@/lib/client/api";
import { collateralToNumber, paperToNumber, usd, num } from "@/lib/client/format";
import type { PaperSummary, MarketRow, ProtocolStats } from "@/lib/client/types";
import { useWallet, useToast } from "@/components/providers";
import { useRewardVault } from "@/lib/web3/useMarketContract";
import { friendlyWeb3Error } from "@/lib/web3/errors";
import { useReadContracts } from "wagmi";
import { rewardVaultAbi } from "@/lib/web3/abi";

// Pilot RewardVault deployed via contracts/script/TestnetPonsSimulation.s.sol —
// the points+vault model (fine2's "Skenario B"), separate from the legacy
// DB-ledger emission_state read below. Swap this for the real Pons-linked
// vault once the leader's token is live.
const REWARD_VAULT_PILOT = "0xa5c4dD985AC3f627FA697683537d2ca02476dafb" as const;

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
        Belum ada batch pembelian STAKE yang dieksekusi treasury. Poin pemain yang ada saat ini berstatus <b>menunggu pembelian</b>.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--body)" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left", color: "var(--ink2)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "8px 10px" }}>Batch</th>
            <th style={{ padding: "8px 10px" }}>Anggaran Belanja ($1/Poin)</th>
            <th style={{ padding: "8px 10px" }}>STAKE Diterima</th>
            <th style={{ padding: "8px 10px" }}>Rasio Hasil Beli</th>
            <th style={{ padding: "8px 10px" }}>Wallets</th>
            <th style={{ padding: "8px 10px" }}>Waktu Eksekusi</th>
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
            const dateStr = batch.timestamp ? new Date(Number(batch.timestamp) * 1000).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—";
            const txHashRaw = batch.txHash ? String(batch.txHash) : "";
            const isZeroHash = !txHashRaw || /^0x0+$/.test(txHashRaw);
            const txDisplay = isZeroHash ? "On-chain Batch" : `${txHashRaw.slice(0, 8)}…${txHashRaw.slice(-6)}`;

            return (
              <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "9px 10px", fontFamily: "var(--type)", fontWeight: 700 }}>#{Number(batch.batchId) + 1}</td>
                <td style={{ padding: "9px 10px" }}>{usd(pointsBurned, 2)} ({num(pointsBurned)} poin)</td>
                <td style={{ padding: "9px 10px", fontWeight: 700, color: "var(--desk)" }}>{num(stakeReceived, 2)} STAKE</td>
                <td style={{ padding: "9px 10px", fontFamily: "var(--type)" }}>{ratio} STAKE / Poin</td>
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

  const pendingPointsNum = toUnitNumber(myPendingPoints);
  const allocatedStakeNum = toUnitNumber(myAllocatedStake);
  const claimedStakeNum = toUnitNumber(myClaimedStake);

  const totalPendingNum = toUnitNumber(totalPendingPoints);
  const totalSettledNum = toUnitNumber(totalPointsSettled);
  const totalDepositedStakeNum = toUnitNumber(totalStakeDeposited);
  const totalClaimedStakeNum = toUnitNumber(totalStakeClaimed);
  const batchCount = batchHistoryCount ? Number(batchHistoryCount) : 0;

  return (
    <div className="blk" style={{ marginBottom: 32, border: "2px solid var(--ink)", borderRadius: 12, padding: 22, background: "var(--paper)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 11, fontFamily: "var(--type)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--desk)", fontWeight: 700, background: "var(--yes-t)", padding: "3px 8px", borderRadius: 4 }}>
            Sistem Reward Revisi STAKE
          </span>
          <h2 style={{ fontSize: 22, marginTop: 8, marginBottom: 4, color: "var(--ink)" }}>
            Reward Poin Kerugian Bersih (Net-Loss)
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--ink2)", maxWidth: 740, lineHeight: 1.5 }}>
            Pemain yang mengalami kerugian bersih di market Stake memperoleh <b>poin</b>. Setiap <b>1 poin mewakili anggaran $1</b> bagi treasury untuk membeli token STAKE di pasar (Pons V2 / Uniswap v4). Poin habis dikonversi saat batch pembelian selesai.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 11, color: "var(--ink3)", display: "block" }}>Kontrak RewardVault Pilot</span>
          <code style={{ fontSize: 11, fontFamily: "var(--type)", color: "var(--ink2)" }}>
            {REWARD_VAULT_PILOT.slice(0, 8)}...{REWARD_VAULT_PILOT.slice(-6)}
          </code>
        </div>
      </div>

      {/* 3 Status Angka Utama Sesuai Brief §5 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 20 }}>
        {/* 1. Poin Menunggu Pembelian */}
        <div style={{ background: "var(--slip)", border: "1.5px solid var(--line)", borderRadius: 10, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink2)" }}>
              Poin Menunggu Pembelian
            </span>
            <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 4, background: "#FFF3CD", color: "#856404", fontWeight: 700 }}>
              Antrean Treasury
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--display)", color: "var(--ink)" }}>
            {address ? num(pendingPointsNum, 2) : "—"}{" "}
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink2)" }}>Poin</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink2)", marginTop: 6, marginBottom: 0 }}>
            Setara anggaran pembelian: <b>{address ? usd(pendingPointsNum, 2) : "—"}</b>
          </p>
          <p style={{ fontSize: 11, color: "var(--ink3)", marginTop: 8, lineHeight: 1.4 }}>
            Menunggu treasury menyediakan dana dan membeli STAKE di pasar. Poin belum berubah menjadi token.
          </p>
        </div>

        {/* 2. STAKE Siap Diklaim */}
        <div style={{ background: "var(--slip)", border: "2px solid var(--desk)", borderRadius: 10, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--desk)" }}>
              STAKE Siap Diklaim
            </span>
            <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 4, background: "#D1E7DD", color: "#0F5132", fontWeight: 700 }}>
              Hasil Pembelian
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--display)", color: "var(--desk)" }}>
            {address ? num(allocatedStakeNum, 2) : "—"}{" "}
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink2)" }}>STAKE</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink2)", marginTop: 6, marginBottom: 0 }}>
            Jatah yang sudah dikunci dari batch pembelian treasury.
          </p>
          {address && isOnChain && (
            <button
              className="btn sm gold"
              style={{ marginTop: 12, width: "100%", fontWeight: 700 }}
              disabled={claiming || allocatedStakeNum <= 0}
              onClick={async () => {
                try {
                  await claimFromVault();
                  toast("STAKE berhasil diklaim ke wallet!");
                } catch (err) {
                  toast(friendlyWeb3Error(err));
                }
              }}
            >
              {claiming ? "Mengirim STAKE…" : allocatedStakeNum > 0 ? `Klaim ${num(allocatedStakeNum, 2)} STAKE` : "Tidak Ada Token Siap Klaim"}
            </button>
          )}
        </div>

        {/* 3. STAKE Sudah Diklaim */}
        <div style={{ background: "var(--slip)", border: "1.5px solid var(--line)", borderRadius: 10, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink2)" }}>
              STAKE Sudah Diklaim
            </span>
            <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 4, background: "var(--line)", color: "var(--ink)", fontWeight: 700 }}>
              Selesai Ditransfer
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--display)", color: "var(--ink)" }}>
            {address ? num(claimedStakeNum, 2) : "—"}{" "}
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink2)" }}>STAKE</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink2)", marginTop: 6, marginBottom: 0 }}>
            Total token STAKE yang telah sukses ditarik ke wallet.
          </p>
          <p style={{ fontSize: 11, color: "var(--ink3)", marginTop: 8, lineHeight: 1.4 }}>
            Klaim hanya mentransfer jatah yang sudah ada. Tidak ada pembelian baru saat tombol klaim ditekan.
          </p>
        </div>
      </div>

      {/* Ringkasan Protokol & Treasury */}
      <div className="zeros" style={{ marginTop: 20 }}>
        <div>
          <small>Total Poin Antrean (Global)</small>
          <b>{num(totalPendingNum)} Poin ({usd(totalPendingNum, 0)})</b>
        </div>
        <div>
          <small>Total Poin Telah Dikonversi</small>
          <b>{num(totalSettledNum)} Poin</b>
        </div>
        <div>
          <small>Total STAKE Disetor Treasury</small>
          <b>{num(totalDepositedStakeNum, 2)} STAKE</b>
        </div>
        <div>
          <small>Total STAKE Telah Diklaim</small>
          <b>{num(totalClaimedStakeNum, 2)} STAKE</b>
        </div>
      </div>

      {/* Penjelasan Transparansi Konversi Poin (§5) */}
      <div style={{ marginTop: 18, padding: "12px 16px", borderRadius: 8, background: "var(--slip)", border: "1px solid var(--line)", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5 }}>
        <b>Prinsip Konversi & Nilai STAKE:</b>
        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
          <li><b>Bukan 10 Poin = 10 STAKE:</b> Jumlah token yang didapat tidak tetap, melainkan mengikuti hasil nyata pembelian treasury di pasar dibagi rata per poin dalam batch tersebut.</li>
          <li><b>Poin Habis Setelah Batch:</b> Poin yang sudah dikonversi hangus dan tidak dapat memperoleh reward dari setoran/batch di masa mendatang.</li>
          <li><b>Klaim Bebas Risiko Harga:</b> Sekali jatah STAKE dialokasikan, jumlah token Anda terkunci permanen sampai Anda mengklaimnya.</li>
        </ul>
      </div>

      {/* Riwayat Batch Pembelian Treasury */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h4 style={{ fontSize: 15, color: "var(--ink)" }}>Riwayat Batch Pembelian Treasury</h4>
          <span style={{ fontSize: 12, color: "var(--ink3)" }}>Total {batchCount} Batch Dieksekusi</span>
        </div>
        <BatchHistorySection vaultAddress={REWARD_VAULT_PILOT} count={batchCount} />
      </div>

      {!isOnChain && (
        <p className="note" style={{ marginTop: 14 }}>
          Hubungkan wallet pada Robinhood Chain Testnet untuk melihat poin kerugian dan mengklaim jatah STAKE Anda.
        </p>
      )}
    </div>
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

      <div className="certbig">
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
    </>
  );
}
