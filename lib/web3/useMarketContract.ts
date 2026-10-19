import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { paperBetMarketAbi, erc20Abi } from "./abi";
import { useState } from "react";

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
