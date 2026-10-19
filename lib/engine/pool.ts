import { SHARE_PRECISION } from "./units";

export interface ResolutionResult {
  yesWon: boolean;
  winningPool: bigint;
  losingPool: bigint;
  protocolFee: bigint;
  netLosingPool: bigint;
  rewardPerWinningShare: bigint; // scaled by 1e18, per brief §33
}

/**
 * Pure pool settlement math per brief §9, §10, §33, §35.
 * Caller is responsible for the empty-pool cancellation check (§34) before
 * calling this — it throws instead of silently dividing by zero.
 */
export function settlePools(
  yesPool: bigint,
  noPool: bigint,
  yesWon: boolean,
  protocolFeeBps: number
): ResolutionResult {
  const winningPool = yesWon ? yesPool : noPool;
  const losingPool = yesWon ? noPool : yesPool;

  if (winningPool <= 0n || losingPool <= 0n) {
    throw new Error("settlePools called with an empty side; market should be cancelled instead (brief §34/§35)");
  }

  const protocolFee = (losingPool * BigInt(protocolFeeBps)) / 10_000n;
  const netLosingPool = losingPool - protocolFee;
  const rewardPerWinningShare = (netLosingPool * SHARE_PRECISION) / winningPool;

  return { yesWon, winningPool, losingPool, protocolFee, netLosingPool, rewardPerWinningShare };
}

/**
 * Winner payout for a single user, per brief §10/§31.
 * stake is this user's stake on the winning side (0 if they didn't win).
 */
export function winnerPayout(winnerStake: bigint, rewardPerWinningShare: bigint): {
  profit: bigint;
  totalPayout: bigint;
} {
  if (winnerStake <= 0n) return { profit: 0n, totalPayout: 0n };
  const profit = (winnerStake * rewardPerWinningShare) / SHARE_PRECISION;
  return { profit, totalPayout: winnerStake + profit };
}
