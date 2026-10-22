import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts } from "wagmi";
import { parseUnits } from "viem";
import { paperBetMarketAbi, erc20Abi, rewardVaultAbi } from "./abi";
import { useState } from "react";

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

/** Reads from the on-chain points+vault pilot (RewardVault.sol) — replaces the DB `emission_state` reads for markets that have moved to the real contract. */
export function useRewardVault(vaultAddress?: `0x${string}`) {
  const { address } = useAccount();

  const { data, isLoading } = useReadContracts({
    contracts: vaultAddress
      ? [
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "totalPoints" },
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "totalRewardDeposited" },
          { address: vaultAddress, abi: rewardVaultAbi, functionName: "rewardToken" },
        ]
      : [],
    query: { enabled: Boolean(vaultAddress) },
  });

  const { data: myPending } = useReadContract(
    vaultAddress && address
      ? { address: vaultAddress, abi: rewardVaultAbi, functionName: "pendingReward", args: [address] }
      : ({} as any)
  );

  const { writeContractAsync } = useWriteContract();
  const [claiming, setClaiming] = useState(false);

  async function claimFromVault() {
    if (!vaultAddress) throw new Error("Reward vault address missing");
    setClaiming(true);
    try {
      return await writeContractAsync({ address: vaultAddress, abi: rewardVaultAbi, functionName: "claim" });
    } finally {
      setClaiming(false);
    }
  }

  return {
    totalPoints: data?.[0]?.result as bigint | undefined,
    totalRewardDeposited: data?.[1]?.result as bigint | undefined,
    rewardTokenAddress: data?.[2]?.result as `0x${string}` | undefined,
    myPendingReward: myPending as bigint | undefined,
    isLoading,
    claimFromVault,
    claiming,
  };
}
