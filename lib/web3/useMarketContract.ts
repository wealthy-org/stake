import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts, usePublicClient } from "wagmi";
import { parseUnits, parseAbiItem } from "viem";
import { paperBetMarketAbi, erc20Abi, rewardVaultAbi } from "./abi";
import { useEffect, useState } from "react";

/** Testnet-only self-serve faucet: anyone can mint MockCollateral (mUSDG) to their own wallet, no admin needed. */
export function useOnChainFaucet(collateralAddress?: `0x${string}`) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  async function mintToSelf(amountDollars: number) {
    if (!isConnected || !address || !collateralAddress) {
      throw new Error("Wallet not connected or collateral address missing");
    }
    setBusy(true);
    try {
      return await writeContractAsync({
        address: collateralAddress,
        abi: erc20Abi,
        functionName: "mint",
        args: [address, parseUnits(amountDollars.toString(), 6)],
      });
    } finally {
      setBusy(false);
    }
  }

  return { mintToSelf, busy };
}

export function useOnChainBet(marketAddress?: `0x${string}`, collateralAddress?: `0x${string}`) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "betting">("idle");

  async function betOnChain(side: "yes" | "no", amountDollars: number) {
    if (!isConnected || !marketAddress || !collateralAddress) {
      throw new Error("Wallet not connected or market contract address missing");
    }

    setBusy(true);
    setStep("approving");

    try {
      const amountUnits = parseUnits(amountDollars.toString(), 6);

      // 1. Approve Collateral
      const approveTx = await writeContractAsync({
        address: collateralAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [marketAddress, amountUnits],
      });

      setStep("betting");

      // 2. Place Bet on Market
      const sideEnum = side === "yes" ? 0 : 1;
      const betTx = await writeContractAsync({
        address: marketAddress,
        abi: paperBetMarketAbi,
        functionName: "bet",
        args: [sideEnum, amountUnits],
      });

      return { approveTx, betTx };
    } finally {
      setBusy(false);
      setStep("idle");
    }
  }

  return { betOnChain, busy, step };
}

export function useOnChainClaim(marketAddress?: `0x${string}`) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<"payout" | "paper" | null>(null);

  async function claimPayoutOnChain() {
    if (!isConnected || !marketAddress) {
      throw new Error("Wallet not connected or market address missing");
    }
    setBusy("payout");
    try {
      return await writeContractAsync({
        address: marketAddress,
        abi: paperBetMarketAbi,
        functionName: "claimPayout",
      });
    } finally {
      setBusy(null);
    }
  }

  async function claimPaperOnChain() {
    if (!isConnected || !marketAddress) {
      throw new Error("Wallet not connected or market address missing");
    }
    setBusy("paper");
    try {
      return await writeContractAsync({
        address: marketAddress,
        abi: paperBetMarketAbi,
        functionName: "claimLossReward",
      });
    } finally {
      setBusy(null);
    }
  }

  return { claimPayoutOnChain, claimPaperOnChain, busy };
}

/** Reads from the on-chain points+vault pilot (RewardVault.sol) — implements the 3 distinct states:
 * 1. Poin menunggu pembelian ($1 budget per point)
 * 2. STAKE siap diklaim (allocated from completed batch)
 * 3. STAKE sudah diklaim (already transferred to wallet)
 */
export function useRewardVault(vaultAddress?: `0x${string}`) {
  const { address } = useAccount();

  const { data, isLoading, refetch: refetchTotals } = useReadContracts({
    contracts: vaultAddress
      ? [
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "totalPendingPoints" },
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "totalPointsSettled" },
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "totalStakeDeposited" },
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "totalStakeClaimed" },
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "rewardToken" },
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "getBatchHistoryCount" },
        ]
      : [],
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: userAccount, refetch: refetchAccount } = useReadContract(
    vaultAddress && address
      ? { address: vaultAddress, abi: rewardVaultAbi, functionName: "accounts", args: [address] }
      : ({} as any)
  );

  const { writeContractAsync } = useWriteContract();
  const [claiming, setClaiming] = useState(false);

  async function claimFromVault() {
    if (!vaultAddress) throw new Error("Reward vault address missing");
    setClaiming(true);
    try {
      const tx = await writeContractAsync({ address: vaultAddress, abi: rewardVaultAbi, functionName: "claim" });
      setTimeout(() => {
        refetchTotals();
        refetchAccount();
      }, 2000);
      return tx;
    } finally {
      setClaiming(false);
    }
  }

  const myPendingPoints = (userAccount as any)?.[0] as bigint | undefined;
  const myAllocatedStake = (userAccount as any)?.[1] as bigint | undefined;
  const myClaimedStake = (userAccount as any)?.[2] as bigint | undefined;

  return {
    // Global metrics
    totalPendingPoints: data?.[0]?.result as bigint | undefined,
    totalPointsSettled: data?.[1]?.result as bigint | undefined,
    totalStakeDeposited: data?.[2]?.result as bigint | undefined,
    totalStakeClaimed: data?.[3]?.result as bigint | undefined,
    rewardTokenAddress: data?.[4]?.result as `0x${string}` | undefined,
    batchHistoryCount: data?.[5]?.result as bigint | undefined,
    // Legacy aliases
    totalPoints: data?.[0]?.result as bigint | undefined,
    totalRewardDeposited: data?.[2]?.result as bigint | undefined,
    // User-specific 3 states
    myPendingPoints,
    myAllocatedStake,
    myClaimedStake,
    myPendingReward: myAllocatedStake, // backwards compatibility
    isLoading,
    claimFromVault,
    claiming,
    refetch: () => {
      refetchTotals();
      refetchAccount();
    },
  };
}

export interface ClaimHistoryEntry {
  amount: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number | null;
}

/** Per-wallet claim history, read from RewardClaimed logs — the vault itself
 * only stores a running total (`claimedStake`), not individual past claims. */
export function useClaimHistory(vaultAddress?: `0x${string}`) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [claims, setClaims] = useState<ClaimHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!publicClient || !vaultAddress || !address) {
      setClaims([]);
      return;
    }
    setLoading(true);
    try {
      const logs = await publicClient.getLogs({
        address: vaultAddress,
        event: parseAbiItem("event RewardClaimed(address indexed user, uint256 amount)"),
        args: { user: address },
        fromBlock: 0n,
        toBlock: "latest",
      });
      const withTimestamps = await Promise.all(
        logs.map(async (log) => {
          let timestamp: number | null = null;
          try {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            timestamp = Number(block.timestamp) * 1000;
          } catch {
            // Block lookup is best-effort — the amount/tx hash still render without it.
          }
          return {
            amount: log.args.amount ?? 0n,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp,
          };
        })
      );
      setClaims(withTimestamps.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber)));
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultAddress, address, publicClient]);

  return { claims, loading, refetch: load };
}
