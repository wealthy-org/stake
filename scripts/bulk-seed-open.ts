import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
try {
  const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.warn("Could not read .env.local");
}

import { query, getPool } from "../lib/db/client";
import { fetchPolymarketMarkets, getYesTokenId, type PolymarketCategory } from "../lib/oracle/polymarket";
import { createMarket, placeBet } from "../lib/engine/market";
import { toBaseUnits } from "../lib/engine/units";

const BOT_BETTOR_1 = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const BOT_BETTOR_2 = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";

async function run() {
  console.log("Starting bulk market populate...");
  const categories: PolymarketCategory[] = ["CRYPTO", "FINANCE", "GEOPOLITICS", "TECH"];
  const now = Date.now();
  let added = 0;

  for (const cat of categories) {
    try {
      console.log(`Fetching Polymarket category ${cat}...`);
      const markets = await fetchPolymarketMarkets(cat, 50);

      for (const pm of markets) {
        const endDateMs = new Date(pm.endDate).getTime();
        if (!Number.isFinite(endDateMs) || endDateMs <= now) continue;

        // check if already tracked
        const existing = await query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM markets WHERE oracle_source LIKE $1`,
          [`polymarket:${pm.conditionId}%`]
        );
        if (Number(existing[0].count) > 0) continue;

        const yesTokenId = getYesTokenId(pm);
        const oracleSource = yesTokenId
          ? `polymarket:${pm.conditionId}:${yesTokenId}`
          : `polymarket:${pm.conditionId}`;

        const bettingClosesAt = new Date(endDateMs);
        const resolutionTimestamp = bettingClosesAt;

        try {
          const id = await createMarket({
            question: pm.question,
            assetSymbol: cat,
            oracleSource,
            strikePrice: 0.5,
            comparison: "gt",
            bettingOpensAt: new Date(now - 60_000),
            bettingClosesAt,
            resolutionTimestamp,
            resolutionWindowSec: 7 * 24 * 3600,
            protocolFeeBps: 200,
            minBet: toBaseUnits(1, 6),
            maxBet: toBaseUnits(50_000, 6),
          });

          // Seed random realistic liquidity ($2,000 - $8,000)
          const yesAmt = Math.floor(2000 + Math.random() * 4000);
          const noAmt = Math.floor(2000 + Math.random() * 4000);

          await placeBet({
            marketId: id,
            address: BOT_BETTOR_1,
            side: "yes",
            amount: toBaseUnits(yesAmt, 6),
          });

          await placeBet({
            marketId: id,
            address: BOT_BETTOR_2,
            side: "no",
            amount: toBaseUnits(noAmt, 6),
          });

          added++;
          console.log(`[${added}] Added & seeded: ${pm.question.slice(0, 45)}...`);
        } catch (err: any) {
          console.error(`Failed to create market:`, err?.message || err);
        }
      }
    } catch (e: any) {
      console.error(`Error in category ${cat}:`, e?.message || e);
    }
  }

  const openCount = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM markets WHERE status = 'open'`
  );
  console.log(`\n========================================`);
  console.log(`SUCCESS! Total open markets in DB: ${openCount[0].count}`);
  console.log(`========================================`);
  await getPool().end();
}

run().catch(async (e) => {
  console.error("Fatal error:", e);
  await getPool().end();
  process.exit(1);
});
