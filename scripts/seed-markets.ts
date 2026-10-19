import { createMarket, placeBet } from "../lib/engine/market";
import { toBaseUnits } from "../lib/engine/units";
import { getPool } from "../lib/db/client";

interface MarketSeed {
  question: string;
  assetSymbol: "ETH" | "BTC" | "SOL";
  strikePrice: number;
  comparison: "gt" | "lt";
  closesInHours: number;
  initialYesUSD?: number;
  initialNoUSD?: number;
}

const SEED_MARKETS: MarketSeed[] = [
  // BTC Markets
  {
    question: "Will Bitcoin stay above $80,000 this weekend?",
    assetSymbol: "BTC",
    strikePrice: 80000,
    comparison: "gt",
    closesInHours: 48,
    initialYesUSD: 250,
    initialNoUSD: 100,
  },
  {
    question: "Will BTC cross $85,000 before the weekly close?",
    assetSymbol: "BTC",
    strikePrice: 85000,
    comparison: "gt",
    closesInHours: 72,
    initialYesUSD: 120,
    initialNoUSD: 180,
  },
  {
    question: "Will BTC dip below $78,000 during US market hours?",
    assetSymbol: "BTC",
    strikePrice: 78000,
    comparison: "lt",
    closesInHours: 24,
    initialYesUSD: 50,
    initialNoUSD: 200,
  },
  {
    question: "Will Bitcoin breach $90,000 by end of the month?",
    assetSymbol: "BTC",
    strikePrice: 90000,
    comparison: "gt",
    closesInHours: 168,
    initialYesUSD: 300,
    initialNoUSD: 300,
  },

  // ETH Markets
  {
    question: "Will Ethereum break above $3,500 by end of the week?",
    assetSymbol: "ETH",
    strikePrice: 3500,
    comparison: "gt",
    closesInHours: 96,
    initialYesUSD: 400,
    initialNoUSD: 150,
  },
  {
    question: "Will ETH hold above $3,000 support level?",
    assetSymbol: "ETH",
    strikePrice: 3000,
    comparison: "gt",
    closesInHours: 36,
    initialYesUSD: 180,
    initialNoUSD: 60,
  },
  {
    question: "Will ETH/BTC ratio climb above 0.045 this cycle?",
    assetSymbol: "ETH",
    strikePrice: 3800,
    comparison: "gt",
    closesInHours: 120,
    initialYesUSD: 90,
    initialNoUSD: 210,
  },
  {
    question: "Will ETH test $2,800 before next rebound?",
    assetSymbol: "ETH",
    strikePrice: 2800,
    comparison: "lt",
    closesInHours: 48,
    initialYesUSD: 75,
    initialNoUSD: 225,
  },

  // SOL Markets
  {
    question: "Will Solana flip $150 before Friday 16:00 UTC?",
    assetSymbol: "SOL",
    strikePrice: 150,
    comparison: "gt",
    closesInHours: 60,
    initialYesUSD: 200,
    initialNoUSD: 120,
  },
  {
    question: "Will SOL break through $180 resistance this week?",
    assetSymbol: "SOL",
    strikePrice: 180,
    comparison: "gt",
    closesInHours: 144,
    initialYesUSD: 150,
    initialNoUSD: 350,
  },
  {
    question: "Will SOL network TPS remain stable above 2,500?",
    assetSymbol: "SOL",
    strikePrice: 120,
    comparison: "gt",
    closesInHours: 40,
    initialYesUSD: 110,
    initialNoUSD: 90,
  },
  {
    question: "Will Solana reclaim $200 before monthly expiry?",
    assetSymbol: "SOL",
    strikePrice: 200,
    comparison: "gt",
    closesInHours: 192,
    initialYesUSD: 320,
    initialNoUSD: 280,
  },
];

const BOT_BETTOR_1 = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const BOT_BETTOR_2 = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";

async function seed() {
  console.log("Seeding realistic open markets...");
  const now = Date.now();

  for (const m of SEED_MARKETS) {
    const closesAt = new Date(now + m.closesInHours * 3600 * 1000);
    const resolvesAt = new Date(closesAt.getTime() + 5 * 60 * 1000); // 5 mins after close

    try {
      const id = await createMarket({
        question: m.question,
        assetSymbol: m.assetSymbol,
        oracleSource: `binance:${m.assetSymbol}USDT`,
        strikePrice: m.strikePrice,
        comparison: m.comparison,
        bettingOpensAt: new Date(now - 10 * 60 * 1000), // opened 10m ago
        bettingClosesAt: closesAt,
        resolutionTimestamp: resolvesAt,
        resolutionWindowSec: 300,
        protocolFeeBps: 200, // 2%
        minBet: toBaseUnits(1, 6),
        maxBet: toBaseUnits(10_000, 6),
      });

      console.log(`✓ Created [${m.assetSymbol}] market: ${id} -> "${m.question}"`);

      // Add realistic initial betting volume if specified
      if (m.initialYesUSD && m.initialYesUSD > 0) {
        await placeBet({
          marketId: id,
          address: BOT_BETTOR_1,
          side: "yes",
          amount: toBaseUnits(m.initialYesUSD, 6),
        });
      }

      if (m.initialNoUSD && m.initialNoUSD > 0) {
        await placeBet({
          marketId: id,
          address: BOT_BETTOR_2,
          side: "no",
          amount: toBaseUnits(m.initialNoUSD, 6),
        });
      }
    } catch (err: any) {
      console.error(`Error creating market "${m.question}":`, err?.message ?? err);
    }
  }

  console.log("Seeding complete!");
  await getPool().end();
}

seed().catch(async (e) => {
  console.error("Seed script failed:", e);
  await getPool().end();
  process.exit(1);
});
