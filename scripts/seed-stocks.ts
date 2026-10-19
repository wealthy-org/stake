import { createMarket, placeBet } from "../lib/engine/market";
import { toBaseUnits } from "../lib/engine/units";
import { getPool } from "../lib/db/client";
import { stockOracleResolver } from "../lib/oracle/stock";

interface StockMarketConfig {
  symbol: string;
  name: string;
  strikeDeltaPct: number; // e.g. +5% or -3% from current price
  comparison: "gt" | "lt";
  closesInDays: number;
  yesPool: number;
  noPool: number;
}

const STOCK_MARKETS: StockMarketConfig[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    strikeDeltaPct: 5, // e.g. +5%
    comparison: "gt",
    closesInDays: 5,
    yesPool: 850,
    noPool: 350, // ~71% YES
  },
  {
    symbol: "AAPL",
    name: "Apple",
    strikeDeltaPct: 3,
    comparison: "gt",
    closesInDays: 7,
    yesPool: 420,
    noPool: 580, // ~42% YES
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    strikeDeltaPct: 8,
    comparison: "gt",
    closesInDays: 4,
    yesPool: 620,
    noPool: 280, // ~69% YES
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    strikeDeltaPct: -4,
    comparison: "lt",
    closesInDays: 3,
    yesPool: 180,
    noPool: 720, // ~20% YES
  },
];

const BOT_1 = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const BOT_2 = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";

async function seedStockMarkets() {
  console.log("Seeding Phase 2 Robinhood Stock Token Markets (NVDA, AAPL, TSLA)...");
  const now = Date.now();

  for (const item of STOCK_MARKETS) {
    try {
      console.log(`Querying stock oracle for ${item.symbol}...`);
      const obs = await stockOracleResolver.getStockObservation(item.symbol);
      console.log(`Current price for ${item.symbol}: $${obs.price} (Multiplier: ${obs.corporateActionMultiplier}, Status: ${obs.marketStatus})`);

      const multiplier = 1 + item.strikeDeltaPct / 100;
      const strike = Math.round(obs.price * multiplier);

      const closesAt = new Date(now + item.closesInDays * 24 * 3600 * 1000);
      const resolvesAt = new Date(closesAt.getTime() + 10 * 60 * 1000);

      const question = item.comparison === "gt"
        ? `Will ${item.symbol} close above $${strike} by ${closesAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}?`
        : `Will ${item.symbol} dip below $${strike} by ${closesAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}?`;

      const id = await createMarket({
        question,
        assetSymbol: item.symbol,
        oracleSource: `stock:${item.symbol}`,
        strikePrice: strike,
        comparison: item.comparison,
        bettingOpensAt: new Date(now - 15 * 60 * 1000),
        bettingClosesAt: closesAt,
        resolutionTimestamp: resolvesAt,
        resolutionWindowSec: 600,
        protocolFeeBps: 200,
        minBet: toBaseUnits(1, 6),
        maxBet: toBaseUnits(10_000, 6),
      });

      console.log(`✓ Created Stock Token market ${id}: "${question}"`);

      await placeBet({
        marketId: id,
        address: BOT_1,
        side: "yes",
        amount: toBaseUnits(item.yesPool, 6),
      });

      await placeBet({
        marketId: id,
        address: BOT_2,
        side: "no",
        amount: toBaseUnits(item.noPool, 6),
      });

      console.log(`  ✓ Seeded liquidity: $${item.yesPool} YES / $${item.noPool} NO`);
    } catch (err: any) {
      console.error(`✗ Failed seeding ${item.symbol}:`, err?.message ?? err);
    }
  }

  console.log("Stock Tokens markets seeding finished!");
  await getPool().end();
}

seedStockMarkets().catch(async (err) => {
  console.error("Error in seedStockMarkets:", err);
  await getPool().end();
  process.exit(1);
});
