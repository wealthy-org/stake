import { faucetTopUp, placeBet } from "../lib/engine/market";
import { toBaseUnits } from "../lib/engine/units";
import { getPool, query } from "../lib/db/client";

// Generate diverse pseudo-random ratios between 15% and 85%
const RATIOS = [
  { yes: 350, no: 150 }, // 70% YES
  { yes: 120, no: 280 }, // 30% YES
  { yes: 480, no: 120 }, // 80% YES
  { yes: 85,  no: 340 }, // 20% YES
  { yes: 540, no: 360 }, // 60% YES
  { yes: 160, no: 240 }, // 40% YES
  { yes: 630, no: 270 }, // 70% YES
  { yes: 75,  no: 425 }, // 15% YES
  { yes: 425, no: 75 },  // 85% YES
  { yes: 220, no: 180 }, // 55% YES
  { yes: 180, no: 220 }, // 45% YES
  { yes: 510, no: 170 }, // 75% YES
  { yes: 150, no: 450 }, // 25% YES
  { yes: 320, no: 180 }, // 64% YES
  { yes: 190, no: 310 }, // 38% YES
];

const BOT_ALICE = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const BOT_BOB   = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
const BOT_CHARLIE = "0x90f79bf6eb2c4f870365e785982e1f101e93b906";

async function populateLiquidity() {
  console.log("Topping up bot wallets with virtual USDG...");
  await faucetTopUp(BOT_ALICE, toBaseUnits(1_000_000, 6));
  await faucetTopUp(BOT_BOB, toBaseUnits(1_000_000, 6));
  await faucetTopUp(BOT_CHARLIE, toBaseUnits(1_000_000, 6));

  console.log("Fetching all open markets with empty or 0/0 pools...");
  const markets = await query<any>(
    "SELECT id, question, yes_pool, no_pool FROM markets WHERE status = 'open' ORDER BY created_at DESC"
  );

  console.log(`Found ${markets.length} open markets.`);

  let index = 0;
  for (const m of markets) {
    const pair = RATIOS[index % RATIOS.length];
    index++;

    console.log(`Setting ratio for ${m.id} ("${m.question.slice(0, 40)}...") -> YES: $${pair.yes}, NO: $${pair.no}`);

    try {
      await placeBet({
        marketId: m.id,
        address: BOT_ALICE,
        side: "yes",
        amount: toBaseUnits(pair.yes, 6),
      });

      await placeBet({
        marketId: m.id,
        address: BOT_BOB,
        side: "no",
        amount: toBaseUnits(pair.no, 6),
      });
      console.log(`  ✓ Successfully placed bets on ${m.id}`);
    } catch (err: any) {
      console.error(`  ✗ Failed placing bets on ${m.id}:`, err?.message ?? err);
    }
  }

  console.log("All open markets populated with dynamic pools and percentages!");
  await getPool().end();
}

populateLiquidity().catch(async (e) => {
  console.error("Failed:", e);
  await getPool().end();
  process.exit(1);
});
