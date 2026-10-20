export interface DocHeading {
  id: string;
  title: string;
}

export interface DocArticle {
  slug: string;
  section: string;
  title: string;
  lead: string;
  headings: DocHeading[];
  content: {
    type: "p" | "list" | "h2" | "h3" | "callout" | "code" | "pre" | "table";
    id?: string;
    text?: string;
    items?: string[];
    calloutType?: "info" | "lime";
    calloutHead?: string;
    codeLang?: string;
    codeContent?: string;
    tableHeaders?: string[];
    tableRows?: string[][];
  }[];
}

export interface DocSection {
  title: string;
  items: { slug: string; title: string }[];
}

export const DOCS_SECTIONS: DocSection[] = [
  {
    title: "Introduction",
    items: [
      { slug: "what-is-stake", title: "What is Stake?" },
      { slug: "faq", title: "FAQ" },
      { slug: "quick-start", title: "Quick start" },
    ],
  },
  {
    title: "How it works",
    items: [
      { slug: "pools-collateral", title: "Prediction pools & collateral" },
      { slug: "resolution-oracles", title: "Deterministic oracles" },
      { slug: "loss-into-ownership", title: "Loss into ownership" },
      { slug: "anti-farming", title: "Anti-farming invariants" },
    ],
  },
  {
    title: "Robinhood Stock Tokens (V2)",
    items: [
      { slug: "stock-tokens", title: "Stock token markets" },
      { slug: "corporate-actions", title: "Halts & split multipliers" },
    ],
  },
  {
    title: "Genesis & Tokenomics",
    items: [
      { slug: "genesis-model", title: "Zero-premint model" },
      { slug: "emission-curve", title: "Emission curve & caps" },
    ],
  },
  {
    title: "Developer reference",
    items: [
      { slug: "contract-addresses", title: "Contract addresses" },
      { slug: "solidity-interface", title: "Interface & integration" },
    ],
  },
];

export const DOC_ARTICLES: Record<string, DocArticle> = {
  "what-is-stake": {
    slug: "what-is-stake",
    section: "Introduction",
    title: "What is Stake?",
    lead: "Stake is a decentralized binary prediction protocol natively built on Robinhood Chain, featuring objective binary pools, oracle-verified settlement, and the revolutionary 'Loss Into Ownership' token genesis mechanism.",
    headings: [
      { id: "core-features", title: "Core features" },
      { id: "how-it-runs", title: "How it runs" },
      { id: "how-bets-work", title: "How bets work" },
      { id: "loss-into-ownership", title: "The LP & Loss Into Ownership" },
      { id: "fees", title: "Deterministic fees" },
    ],
    content: [
      {
        type: "p",
        text: "Unlike traditional sportsbooks or centralized prediction platforms, Stake operates purely via smart contracts on Robinhood Chain. There is no house underwriting bets, no counterparty risk from a central bookmaker, and no subjective human dispute arbitration.",
      },
      {
        type: "h2",
        id: "core-features",
        text: "Core features",
      },
      {
        type: "list",
        items: [
          "Parimutuel YES / NO Pools: Winners take the opposing pool pro-rata without protocol counterparty risk.",
          "Loss Into Ownership: Realized net losers mint protocol governance and fee-claim tokens ($STAKE).",
          "Anti-Farming Invariants: Hedging both sides cannot game token emissions; minting is strictly based on net realized losses.",
          "Deterministic Oracles: Price settlement resolves at immutable timestamps via cryptographically signed feeds.",
          "V2 Robinhood Stock Tokens: Official support for equity tokens (NVDA, AAPL, TSLA) factoring in market halts and splits.",
          "Zero Pre-Mint: 100% fair launch with zero insider allocations, zero VC tranches, and zero foundation reserve.",
        ],
      },
      {
        type: "h2",
        id: "how-it-runs",
        text: "How it runs",
      },
      {
        type: "p",
        text: "Stake smart contracts live on Robinhood Chain Testnet (Chain ID 46630). When a market is initiated, users deposit approved collateral (e.g. Robinhood USD / stablecoins) into dedicated YES or NO pool vaults. All deposits are locked immutably on-chain until the predetermined cutoff and oracle settlement timestamp.",
      },
      {
        type: "callout",
        calloutType: "lime",
        calloutHead: "ROBINHOOD CHAIN NATIVE",
        text: "Stake leverages Robinhood Chain's sub-second finality and near-zero gas costs, ensuring immediate receipt issuance and instantaneous atomic claims.",
      },
      {
        type: "h2",
        id: "how-bets-work",
        text: "How bets work",
      },
      {
        type: "p",
        text: "Every market poses a clear, objective binary proposition (e.g., 'Will NVDA close above $140 by Friday cutoff?'). Participants choose their side and commit collateral. Pool shares reflect capital allocation dynamically until cutoff, determining the payout ratio per $1 staked.",
      },
      {
        type: "p",
        text: "When the market settles, the signed oracle feeds establish the deterministic outcome. Winning shares recover 100% of their initial principal plus their proportional slice of the losing pool after an example 2% protocol fee.",
      },
      {
        type: "h2",
        id: "loss-into-ownership",
        text: "The LP & Loss Into Ownership",
      },
      {
        type: "p",
        text: "In traditional gambling, when you lose, your money is gone forever to the house. In Stake, losing collateral is distributed to the winners, but the net loss is recorded by the immutable token genesis contract. Verified net losers are entitled to claim $STAKE protocol tokens.",
      },
      {
        type: "p",
        text: "This effectively converts bad market timing into long-term equity and fee rights across future protocol volume. The community of protocol owners is composed entirely of real, verified protocol users.",
      },
      {
        type: "h2",
        id: "fees",
        text: "Deterministic fees",
      },
      {
        type: "p",
        text: "Stake charges no entry fees, no deposit fees, and zero spreads. The protocol takes a flat 2% fee strictly from the losing pool upon settlement. If a market cancels or oracle data fails, 100% of funds are returned with zero fees deducted.",
      },
    ],
  },

  faq: {
    slug: "faq",
    section: "Introduction",
    title: "Frequently Asked Questions",
    lead: "Answers to common questions about pool mechanics, token eligibility, anti-farming safeguards, and Robinhood Chain execution.",
    headings: [
      { id: "what-is-a-loss", title: "What counts as a loss?" },
      { id: "can-i-hedge", title: "Can I bet both sides to farm tokens?" },
      { id: "where-payouts-come-from", title: "Where do payouts come from?" },
      { id: "is-there-a-premint", title: "Is there a premint or team allocation?" },
      { id: "market-cancellation", title: "What happens if a market cancels?" },
    ],
    content: [
      {
        type: "h2",
        id: "what-is-a-loss",
        text: "What counts as a loss?",
      },
      {
        type: "p",
        text: "A loss is strictly defined per wallet, per market as: max(0, Total Stake Deposited − Total Collateral Payout Received). Only net realized losses generate $STAKE token mint rights. Unsettled bets and open positions do not count until the settlement transaction is finalized on-chain.",
      },
      {
        type: "h2",
        id: "can-i-hedge",
        text: "Can I bet both sides to farm tokens?",
      },
      {
        type: "p",
        text: "Yes, you are permitted to bet both YES and NO on the same market. However, hedging will NEVER farm protocol tokens. Because the mint basis is strictly net realized loss across your entire wallet commitment on that market, any payout received on your winning side directly offsets your gross loss. If your net payout exceeds your stake, your net loss is 0, and you receive 0 tokens.",
      },
      {
        type: "callout",
        calloutType: "info",
        calloutHead: "INVARIANT FORMULA",
        text: "Eligible Loss Basis = max(0, Stake_YES + Stake_NO - Payout_Total). No mathematical loophole allows risk-free token extraction.",
      },
      {
        type: "h2",
        id: "where-payouts-come-from",
        text: "Where do payouts come from?",
      },
      {
        type: "p",
        text: "All payouts come directly from the losing pool. Stake does not run a treasury liquidity pool that underwrites risk. The winning pool claims 100% of their deposited principal plus the remaining net collateral of the opposing side after protocol fees.",
      },
      {
        type: "h2",
        id: "is-there-a-premint",
        text: "Is there a premint or team allocation?",
      },
      {
        type: "p",
        text: "No. The total supply of $STAKE starts at exactly 0. There is no team premint, no private seed sale, no advisor grants, and no pre-mined foundation treasury. Every single $STAKE token is minted on-chain against verified user losses through the programmatic emission curve.",
      },
      {
        type: "h2",
        id: "market-cancellation",
        text: "What happens if a market cancels?",
      },
      {
        type: "p",
        text: "If an underlying asset experiences a prolonged halt, if an oracle is permanently unavailable, or if only one side of the pool has deposits at cutoff, the market transitions to Cancelled state. All depositors can withdraw 100% of their principal without any fee or token emission.",
      },
    ],
  },

  "quick-start": {
    slug: "quick-start",
    section: "Introduction",
    title: "Quick Start Guide",
    lead: "Follow these 4 steps to participate in live prediction pools on Robinhood Chain.",
    headings: [
      { id: "step-1", title: "1. Connect your wallet" },
      { id: "step-2", title: "2. Acquire testnet collateral" },
      { id: "step-3", title: "3. Choose a market & side" },
      { id: "step-4", title: "4. Settle & claim" },
    ],
    content: [
      {
        type: "h2",
        id: "step-1",
        text: "1. Connect your wallet",
      },
      {
        type: "p",
        text: "Make sure you have an EVM-compatible wallet (MetaMask, Rabby, Coinbase Wallet) connected to Robinhood Chain Testnet.",
      },
      {
        type: "table",
        tableHeaders: ["Parameter", "Network Configuration"],
        tableRows: [
          ["Network Name", "Robinhood Chain Testnet"],
          ["RPC URL", "https://rpc.testnet.robinhood.com"],
          ["Chain ID", "46630"],
          ["Currency Symbol", "ETH"],
          ["Block Explorer", "https://explorer.testnet.robinhood.com"],
        ],
      },
      {
        type: "h2",
        id: "step-2",
        text: "2. Acquire testnet collateral",
      },
      {
        type: "p",
        text: "Navigate to the in-app Faucet under /app/faucet or use the top-bar faucet button to claim 500 testnet USDC collateral tokens directly to your wallet.",
      },
      {
        type: "h2",
        id: "step-3",
        text: "3. Choose a market & side",
      },
      {
        type: "p",
        text: "Open the Markets board. Select any open pool (ETH, BTC, SOL, NVDA, AAPL, TSLA). Choose YES or NO, input your stake amount, and approve the smart contract transaction. You will receive an on-chain digital thermal ticket.",
      },
      {
        type: "h2",
        id: "step-4",
        text: "4. Settle & claim",
      },
      {
        type: "p",
        text: "Once the market cutoff timestamp passes and the signed oracle resolves the outcome:",
      },
      {
        type: "list",
        items: [
          "If you won: Click Claim Payout to receive your initial collateral plus your share of the losing pool.",
          "If you lost: Click Claim $STAKE to mint your protocol governance tokens according to the current emission curve.",
        ],
      },
    ],
  },

  "pools-collateral": {
    slug: "pools-collateral",
    section: "How it works",
    title: "Prediction Pools & Collateral",
    lead: "Detailed explanation of the parimutuel pool invariant, collateral lockup, and payout mathematics.",
    headings: [
      { id: "parimutuel-math", title: "Parimutuel pricing formula" },
      { id: "example-calculation", title: "Worked payout example" },
      { id: "collateral-security", title: "Collateral security" },
    ],
    content: [
      {
        type: "h2",
        id: "parimutuel-math",
        text: "Parimutuel pricing formula",
      },
      {
        type: "p",
        text: "Stake uses a pure parimutuel pool model. Unlike fixed-odds bookmakers that shade odds or AMMs that suffer impermanent loss, parimutuel pools ensure that the protocol is always 100% solvent by construction.",
      },
      {
        type: "pre",
        codeLang: "solidity",
        codeContent: `// Formula for Payout per $1 of Winning Stake:
// Total Winning Pool = W
// Total Losing Pool = L
// Protocol Fee = 2% on Losing Pool = 0.02 * L
// Net Losing Pool = 0.98 * L

Payout_Per_Dollar = 1.0 + (0.98 * L) / W;
User_Payout = User_Stake * Payout_Per_Dollar;`,
      },
      {
        type: "h2",
        id: "example-calculation",
        text: "Worked payout example",
      },
      {
        type: "p",
        text: "Consider a market with $60,000 in YES and $40,000 in NO:",
      },
      {
        type: "list",
        items: [
          "YES Pool (W) = $60,000 (60% share)",
          "NO Pool (L) = $40,000 (40% share)",
          "Fee deducted = 2% of $40,000 = $800",
          "Distributable profit = $39,200",
          "Payout ratio for YES = 1 + ($39,200 / $60,000) = $1.653 per $1",
          "A $100 YES bet returns $165.33 ($100 principal + $65.33 profit)",
        ],
      },
      {
        type: "h2",
        id: "collateral-security",
        text: "Collateral security",
      },
      {
        type: "p",
        text: "All collateral is held directly in non-custodial smart contracts deployed on Robinhood Chain. No admin key or multisig can withdraw collateral before settlement. Funds can only exit through deterministic claim calls verified against oracle resolution flags.",
      },
    ],
  },

  "resolution-oracles": {
    slug: "resolution-oracles",
    section: "How it works",
    title: "Deterministic Oracles",
    lead: "How price settlement resolves deterministically at immutable timestamps using signed feeds.",
    headings: [
      { id: "oracle-architecture", title: "Oracle architecture" },
      { id: "timestamp-cutoffs", title: "Timestamp cutoff rules" },
      { id: "fallback-circuit", title: "Circuit breakers & fallbacks" },
    ],
    content: [
      {
        type: "h2",
        id: "oracle-architecture",
        text: "Oracle architecture",
      },
      {
        type: "p",
        text: "Stake integrates decentralized oracle networks including Chainlink Data Feeds and Pyth on-chain benchmarks. For cryptocurrency pairs (ETH/USD, BTC/USD, SOL/USD), price updates are verified against round IDs recorded at exact resolution timestamps.",
      },
      {
        type: "h2",
        id: "timestamp-cutoffs",
        text: "Timestamp cutoff rules",
      },
      {
        type: "p",
        text: "Every market defines two strict timestamps in Unix seconds:",
      },
      {
        type: "list",
        items: [
          "bettingCutoff: The exact second after which deposit calls revert. No new capital can enter.",
          "resolutionTimestamp: The exact target time where oracle price P is evaluated against Strike price S.",
        ],
      },
      {
        type: "p",
        text: "If P >= S, YES is declared the winner. If P < S, NO is declared the winner. The outcome is binary and permanently written to the contract state.",
      },
      {
        type: "h2",
        id: "fallback-circuit",
        text: "Circuit breakers & fallbacks",
      },
      {
        type: "p",
        text: "If the primary oracle feed fails to publish an update within a 4-hour window following resolutionTimestamp, the market triggers a fallback timeout. Any user can trigger cancelMarket(), returning 100% of deposited collateral to all participants.",
      },
    ],
  },

  "loss-into-ownership": {
    slug: "loss-into-ownership",
    section: "How it works",
    title: "Loss Into Ownership",
    lead: "The novel mechanism transforming trading losses into decentralized protocol equity.",
    headings: [
      { id: "the-thesis", title: "The core thesis" },
      { id: "minting-rules", title: "Minting mechanics" },
      { id: "holder-rights", title: "Token utility & fee distribution" },
    ],
    content: [
      {
        type: "h2",
        id: "the-thesis",
        text: "The core thesis",
      },
      {
        type: "p",
        text: "Traditional casinos and prediction platforms treat users who lose as discarded churn. Stake flips this incentive dynamic: losing traders funded the winners, provided real collateral velocity, and bore protocol adoption risk. They are rewarded with $STAKE tokens.",
      },
      {
        type: "callout",
        calloutType: "lime",
        calloutHead: "LOSSES INTO EQUITY",
        text: "A loss stays a loss. $STAKE tokens are not a guaranteed dollar refund, but an immutable stake in future protocol volume and treasury accrual.",
      },
      {
        type: "h2",
        id: "minting-rules",
        text: "Minting mechanics",
      },
      {
        type: "p",
        text: "When a market settles, any wallet with net realized loss can invoke the claimPaper() method on the emission controller. The controller mints $STAKE directly into the user's wallet according to the emission curve.",
      },
      {
        type: "h2",
        id: "holder-rights",
        text: "Token utility & fee distribution",
      },
      {
        type: "p",
        text: "Staked $STAKE tokens receive a proportional share of the 2% protocol fee collected from all winning markets across the entire ecosystem. As protocol volume expands, token holders receive continuous collateral dividend flows.",
      },
    ],
  },

  "anti-farming": {
    slug: "anti-farming",
    section: "How it works",
    title: "Anti-Farming Invariants",
    lead: "Formal mathematical guarantees preventing multi-wallet wash trading and malicious token emissions.",
    headings: [
      { id: "the-invariant", title: "The Net Loss Invariant" },
      { id: "hedging-proof", title: "Mathematical proof against hedging" },
    ],
    content: [
      {
        type: "h2",
        id: "the-invariant",
        text: "The Net Loss Invariant",
      },
      {
        type: "p",
        text: "To ensure that $STAKE is never farmed by bot syndicates or risk-neutral capital, the smart contract strictly enforces the Net Realized Loss Invariant:",
      },
      {
        type: "pre",
        codeLang: "solidity",
        codeContent: `// Evaluated per wallet W on resolved market M:
uint256 totalStake = userYesStake[W][M] + userNoStake[W][M];
uint256 totalPayout = calculatePayout(W, M);

if (totalPayout >= totalStake) {
    eligibleNetLoss[W][M] = 0; // Winner, zero tokens
} else {
    eligibleNetLoss[W][M] = totalStake - totalPayout;
}`,
      },
      {
        type: "h2",
        id: "hedging-proof",
        text: "Mathematical proof against hedging",
      },
      {
        type: "p",
        text: "Suppose a farmer attempts to bet $1,000 on YES and $1,000 on NO in a 50/50 pool ($2,000 total commitment):",
      },
      {
        type: "list",
        items: [
          "The winning side pays out roughly $1,980 (after the 2% fee).",
          "Total stake = $2,000. Total payout = $1,980.",
          "Net loss = $20. The farmer lost $20 in capital fees.",
          "Tokens minted = $20 * mintRate. The farmer pays the full capital cost for whatever tokens are minted.",
          "There is no arbitrage or free token creation possible.",
        ],
      },
    ],
  },

  "stock-tokens": {
    slug: "stock-tokens",
    section: "Robinhood Stock Tokens (V2)",
    title: "Stock Token Markets",
    lead: "Phase 2 implementation utilizing official Robinhood Chain equity tokens for stock prediction pools.",
    headings: [
      { id: "supported-equities", title: "Supported stock tokens" },
      { id: "market-hours", title: "Market hours & settlement timing" },
    ],
    content: [
      {
        type: "h2",
        id: "supported-equities",
        text: "Supported stock tokens",
      },
      {
        type: "p",
        text: "In Phase 2, Stake introduces prediction markets pegged to official Robinhood Chain synthetic equity tokens. Launch tickers include:",
      },
      {
        type: "table",
        tableHeaders: ["Ticker", "Asset Name", "Standard Cutoff", "Oracle Source"],
        tableRows: [
          ["NVDA", "NVIDIA Corporation", "Friday 16:00 EST", "Robinhood Chain Equity Feed"],
          ["AAPL", "Apple Inc.", "Friday 16:00 EST", "Robinhood Chain Equity Feed"],
          ["TSLA", "Tesla Inc.", "Friday 16:00 EST", "Robinhood Chain Equity Feed"],
        ],
      },
      {
        type: "h2",
        id: "market-hours",
        text: "Market hours & settlement timing",
      },
      {
        type: "p",
        text: "Unlike 24/7 crypto markets, US equities adhere to standard trading sessions (09:30 - 16:00 EST). Market cutoff occurs at 15:30 EST on expiration day, and official settlement evaluates the consolidated closing price at 16:00 EST.",
      },
    ],
  },

  "corporate-actions": {
    slug: "corporate-actions",
    section: "Robinhood Stock Tokens (V2)",
    title: "Halts & Split Multipliers",
    lead: "Protocol specifications for handling stock splits, corporate dividends, and NYSE/NASDAQ trading halts.",
    headings: [
      { id: "stock-splits", title: "Stock split multipliers" },
      { id: "trading-halts", title: "Handling trading halts" },
    ],
    content: [
      {
        type: "h2",
        id: "stock-splits",
        text: "Stock split multipliers",
      },
      {
        type: "p",
        text: "If a company executes a stock split (e.g. 10-for-1 forward split) while a market is active, the strike price is adjusted automatically via the splitMultiplier parameter supplied by the Robinhood Chain oracle:",
      },
      {
        type: "pre",
        codeLang: "solidity",
        codeContent: `// Adjusted Strike Price upon Stock Split:
adjustedStrike = originalStrike / splitMultiplier;

// Example: NVDA original strike $1,200 with 10:1 split:
// adjustedStrike = 1,200 / 10 = $120.00;`,
      },
      {
        type: "h2",
        id: "trading-halts",
        text: "Handling trading halts",
      },
      {
        type: "p",
        text: "If a stock undergoes a regulatory trading halt (LULD halt or news pending) spanning past the resolution cutoff, the market settlement is deferred until the official resumption print. If the halt extends past 5 consecutive trading days, the market is cancelled and principal is refunded in full.",
      },
    ],
  },

  "genesis-model": {
    slug: "genesis-model",
    section: "Genesis & Tokenomics",
    title: "Zero-Premint Model",
    lead: "The architectural commitment to 100% fair launch and organic community ownership.",
    headings: [
      { id: "distribution-table", title: "Token allocation breakdown" },
      { id: "why-zero-premint", title: "Why zero premint matters" },
    ],
    content: [
      {
        type: "h2",
        id: "distribution-table",
        text: "Token allocation breakdown",
      },
      {
        type: "table",
        tableHeaders: ["Allocation Tranche", "Amount", "% of Supply"],
        tableRows: [
          ["Premint / Genesis Mint", "0 STAKE", "0%"],
          ["Team & Founders", "0 STAKE", "0%"],
          ["Venture Capital / Investors", "0 STAKE", "0%"],
          ["Foundation Reserve", "0 STAKE", "0%"],
          ["Minted via Verified Loss", "100% Programmatic", "100%"],
        ],
      },
      {
        type: "h2",
        id: "why-zero-premint",
        text: "Why zero premint matters",
      },
      {
        type: "p",
        text: "Traditional tokens launch with 60-80% of supply reserved for insiders, resulting in relentless dilution and sell pressure. Stake eliminates this dynamic completely. The token can only exist if real users interact with the protocol and take real market views.",
      },
    ],
  },

  "emission-curve": {
    slug: "emission-curve",
    section: "Genesis & Tokenomics",
    title: "Emission Curve & Caps",
    lead: "Decay schedules, issuance controller, and long-term supply stabilization.",
    headings: [
      { id: "curve-formula", title: "Decay schedule formula" },
      { id: "emission-tiers", title: "Volume tiers" },
    ],
    content: [
      {
        type: "h2",
        id: "curve-formula",
        text: "Decay schedule formula",
      },
      {
        type: "p",
        text: "The mint rate begins at 100 $STAKE per $1 of verified net loss basis. As cumulative protocol volume increases, the rate decays smoothly to safeguard long-term token scarcity.",
      },
      {
        type: "table",
        tableHeaders: ["Cumulative Protocol Loss", "Emission Rate", "Status"],
        tableRows: [
          ["$0 - $2,000,000", "100 STAKE per $1 loss", "Genesis Phase (Current)"],
          ["$2,000,000 - $10,000,000", "50 STAKE per $1 loss", "Phase 2 Growth"],
          ["$10,000,000 - $50,000,000", "20 STAKE per $1 loss", "Maturity"],
          ["> $50,000,000", "Asymptotic Tail (5 STAKE/$) ", "Permanent Baseline"],
        ],
      },
    ],
  },

  "contract-addresses": {
    slug: "contract-addresses",
    section: "Developer reference",
    title: "Contract Addresses",
    lead: "Official deployment addresses on Robinhood Chain Testnet (Chain ID 46630).",
    headings: [
      { id: "testnet-deployments", title: "Robinhood Chain Testnet deployments" },
    ],
    content: [
      {
        type: "h2",
        id: "testnet-deployments",
        text: "Robinhood Chain Testnet deployments",
      },
      {
        type: "table",
        tableHeaders: ["Contract Name", "Address", "Explorer"],
        tableRows: [
          ["StakeMarketFactory", "0x39a1c68f2371E7D52F8f2a9692461D4C73f40431", "Verified"],
          ["StakeToken ($STAKE)", "0x8B75F34E35c75B91aC191A77576579c1e7a5E98B", "Verified"],
          ["TreasuryVault", "0x5241C765471B3E4eA3E62b9D206B1A8325Ac7F68", "Verified"],
          ["OracleResolver", "0x7aB9c025D8F2A803Bf75960F1c8D6241b3F5a939", "Verified"],
          ["MockCollateralUSD", "0x12F8e6899c750b2F5c9779313bF5605a67D98a72", "Verified"],
        ],
      },
      {
        type: "callout",
        calloutType: "info",
        calloutHead: "NETWORK RPC",
        text: "Testnet RPC: https://rpc.testnet.robinhood.com · Chain ID: 46630 · Symbol: ETH",
      },
    ],
  },

  "solidity-interface": {
    slug: "solidity-interface",
    section: "Developer reference",
    title: "Interface & Integration",
    lead: "Solidity interfaces and events for building automated bots and prediction aggregators on Stake.",
    headings: [
      { id: "core-interface", title: "IStakePool.sol" },
    ],
    content: [
      {
        type: "h2",
        id: "core-interface",
        text: "IStakePool.sol",
      },
      {
        type: "pre",
        codeLang: "solidity",
        codeContent: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStakePool {
    enum Outcome { PENDING, YES_WON, NO_WON, CANCELLED }

    event BetPlaced(address indexed user, bool isYes, uint256 amount);
    event MarketResolved(Outcome outcome, uint256 finalPrice, uint256 timestamp);
    event PayoutClaimed(address indexed user, uint256 collateralAmount);
    event StakeTokensMinted(address indexed user, uint256 tokenAmount);

    function deposit(bool isYes, uint256 amount) external;
    function resolve(uint256 signedPrice, bytes calldata signature) external;
    function claimPayout() external returns (uint256 payout);
    function claimTokens() external returns (uint256 tokensMinted);
}`,
      },
    ],
  },
};
