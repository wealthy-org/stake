/**
 * Float-based settlement preview for the UI only (hero simulator, "estimated
 * payout" in the trade panel). This is NOT what gets written on bet/claim —
 * the real settlement always runs server-side with BigInt math
 * (lib/engine/pool.ts, lib/engine/netloss.ts). Mirrors the same formulas at
 * display precision so the preview and the real result agree to the cent.
 */
export interface SettlePreview {
  payout: number;
  profit: number;
  total: number;
  pnl: number;
  loss: number;
  fee: number;
  net: number;
  paper: number;
}

export function previewSettle(
  yesPool: number,
  noPool: number,
  yesStake: number,
  noStake: number,
  winner: "yes" | "no",
  feeBps: number,
  paperRatePerDollar: number
): SettlePreview {
  const win = winner === "yes" ? yesPool : noPool;
  const lose = winner === "yes" ? noPool : yesPool;
  const stake = winner === "yes" ? yesStake : noStake;

  const fee = lose * (feeBps / 10_000);
  const net = lose - fee;
  const profit = win > 0 && stake > 0 ? (stake / win) * net : 0;
  const payout = stake > 0 ? stake + profit : 0;

  const total = yesStake + noStake;
  const pnl = payout - total;
  const loss = Math.max(0, -pnl);

  return { payout, profit, total, pnl, loss, fee, net, paper: loss * paperRatePerDollar };
}
