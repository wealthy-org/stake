import { winnerPayout } from "./pool";

/**
 * Net-realized-loss calculation per brief §11/§32.
 *
 * CRITICAL: this must run on total stake across BOTH sides, not just the
 * losing side, or a wallet that bets both YES and NO can farm PAPER by
 * "losing" on one side while really being hedged. See brief §11.
 */
export function calcNetLoss(params: {
  yesStake: bigint;
  noStake: bigint;
  yesWon: boolean;
  rewardPerWinningShare: bigint;
}): { totalStake: bigint; totalPayout: bigint; netPnL: bigint; realizedLoss: bigint } {
  const { yesStake, noStake, yesWon, rewardPerWinningShare } = params;
  const totalStake = yesStake + noStake;
  const winnerStake = yesWon ? yesStake : noStake;

  const { totalPayout } = winnerPayout(winnerStake, rewardPerWinningShare);

  const netPnL = totalPayout - totalStake;
  const realizedLoss = netPnL < 0n ? -netPnL : 0n;

  return { totalStake, totalPayout, netPnL, realizedLoss };
}
