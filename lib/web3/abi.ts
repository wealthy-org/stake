export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    // Testnet-only mock (MockCollateral.sol) — mint is deliberately open
    // to anyone so every tester can self-serve without an admin wallet.
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const rewardVaultAbi = [
  {
    name: "totalPendingPoints",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalPointsSettled",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalAllocatedStake",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalStakeDeposited",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalStakeClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalPoints",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalRewardDeposited",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "rewardToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "accounts",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "pendingPoints", type: "uint256" },
      { name: "allocatedStake", type: "uint256" },
      { name: "claimedStake", type: "uint256" },
    ],
  },
  {
    name: "pendingPoints",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allocatedStake",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "claimedStake",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "pendingReward",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getBatchHistoryCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getBatch",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "batchId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "batchId", type: "uint256" },
          { name: "totalPointsBurned", type: "uint256" },
          { name: "totalStakePurchased", type: "uint256" },
          { name: "conversionRatio", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "txHash", type: "bytes32" },
          { name: "userCount", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    name: "RewardClaimed",
    type: "event",
    anonymous: false,
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const paperBetMarketAbi = [
  {
    name: "status",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "yesPool",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "noPool",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "yesStake", type: "uint256" },
      { name: "noStake", type: "uint256" },
      { name: "payoutClaimed", type: "bool" },
      { name: "lossRewardClaimed", type: "bool" },
    ],
  },
  {
    name: "bet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "side", type: "uint8" }, // 0: YES, 1: NO
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "claimPayout",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    name: "claimLossReward",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [
      { name: "realizedLoss", type: "uint256" },
      { name: "paperMinted", type: "uint256" },
    ],
  },
] as const;

export const paperBetFactoryAbi = [
  {
    name: "marketCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allMarkets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getMarket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
