// DB-backed integration test. Requires DATABASE_URL (NeonDB) to be set.
// Exercises a full market lifecycle plus the double-claim / cancellation
// invariants from brief §52 Invariant 3/4 and §29/§34.
import { createMarket, placeBet, resolveMarket, cancelMarket, claimPayout, claimLossReward, claimRefund, faucetTopUp } from "../lib/engine/market";
import { isPaused, setPaused } from "../lib/engine/admin";
import { getPool } from "../lib/db/client";
import { toBaseUnits } from "../lib/engine/units";

let failures = 0;
function assertTrue(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
async function assertThrows(fn: () => Promise<any>, label: string) {
  try {
    await fn();
    failures++;
    console.error(`FAIL: ${label} — expected throw, none occurred`);
  } catch {
    console.log(`ok   ${label}`);
  }
}

const ALICE = "0xalice000000000000000000000000000000000";
const BOB = "0xbob0000000000000000000000000000000000000";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set — point it at your NeonDB instance before running stress tests.");
    process.exit(1);
  }

  await faucetTopUp(ALICE, toBaseUnits(10_000, 6));
  await faucetTopUp(BOB, toBaseUnits(10_000, 6));

  // --- Scenario 1: normal resolve + winner claim + double-claim rejected ---
  const now = Date.now();
  const marketId = await createMarket({
    question: "stress test market",
    assetSymbol: "ETH",
    oracleSource: "binance:ETHUSDT",
    strikePrice: 1, // guaranteed true so the test doesn't depend on live ETH price
    comparison: "gt",
    bettingOpensAt: new Date(now - 10_000),
    bettingClosesAt: new Date(now + 4_000),
    resolutionTimestamp: new Date(now + 4_500),
    resolutionWindowSec: 300,
    protocolFeeBps: 200,
    minBet: toBaseUnits(1, 6),
    maxBet: toBaseUnits(5_000, 6),
  });

  await placeBet({ marketId, address: ALICE, side: "yes", amount: toBaseUnits(100, 6) });
  await placeBet({ marketId, address: BOB, side: "no", amount: toBaseUnits(100, 6) });

  await new Promise((r) => setTimeout(r, 5_000));
  await resolveMarket(marketId); // strike=1, real ETH price > 1 always -> YES wins

  const alicePayout = await claimPayout(marketId, ALICE);
  assertTrue(alicePayout > 0n, "winner claim returns a positive payout");

  await assertThrows(() => claimPayout(marketId, ALICE), "§52 Invariant 3: double payout claim is rejected");

  const bobLoss = await claimLossReward(marketId, BOB);
  assertTrue(bobLoss.realizedLoss > 0n, "loser has positive realized loss");
  assertTrue(bobLoss.paperMinted > 0n, "loser mints PAPER proportional to realized loss");

  await assertThrows(() => claimLossReward(marketId, BOB), "§52 Invariant 4: double PAPER claim is rejected");

  // --- Scenario 2: cancellation refunds stake, zero fee, zero PAPER ---
  const cancelMarketId = await createMarket({
    question: "cancel test market",
    assetSymbol: "ETH",
    oracleSource: "binance:ETHUSDT",
    strikePrice: 1,
    comparison: "gt",
    bettingOpensAt: new Date(now - 10_000),
    bettingClosesAt: new Date(now + 10_000),
    resolutionTimestamp: new Date(now + 20_000),
    resolutionWindowSec: 300,
    protocolFeeBps: 200,
    minBet: toBaseUnits(1, 6),
    maxBet: toBaseUnits(5_000, 6),
  });
  await placeBet({ marketId: cancelMarketId, address: ALICE, side: "yes", amount: toBaseUnits(50, 6) });
  await cancelMarket(cancelMarketId, "manual_test");
  const refund = await claimRefund(cancelMarketId, ALICE);
  assertTrue(refund === toBaseUnits(50, 6), "§29/§53: cancelled market refunds exact original stake");
  await assertThrows(() => claimRefund(cancelMarketId, ALICE), "double refund claim is rejected");

  // --- Scenario 3: bet bounds enforced ---
  const boundsMarketId = await createMarket({
    question: "bounds test market",
    assetSymbol: "ETH",
    oracleSource: "binance:ETHUSDT",
    strikePrice: 1,
    comparison: "gt",
    bettingOpensAt: new Date(now - 10_000),
    bettingClosesAt: new Date(now + 10_000),
    resolutionTimestamp: new Date(now + 20_000),
    resolutionWindowSec: 300,
    protocolFeeBps: 0,
    minBet: toBaseUnits(10, 6),
    maxBet: toBaseUnits(20, 6),
  });
  await assertThrows(
    () => placeBet({ marketId: boundsMarketId, address: ALICE, side: "yes", amount: toBaseUnits(5, 6) }),
    "§59: bet below minBet is rejected"
  );
  await assertThrows(
    () => placeBet({ marketId: boundsMarketId, address: ALICE, side: "yes", amount: toBaseUnits(25, 6) }),
    "§59: bet above maxBet is rejected"
  );
  await cancelMarket(boundsMarketId, "cleanup");

  // --- Scenario 4: pause blocks new bets and new markets, never claims (brief §38) ---
  assertTrue((await isPaused()) === false, "protocol starts unpaused");
  await setPaused(true);
  await assertThrows(
    () =>
      createMarket({
        question: "pause test market",
        assetSymbol: "ETH",
        oracleSource: "binance:ETHUSDT",
        strikePrice: 1,
        comparison: "gt",
        bettingOpensAt: new Date(now - 10_000),
        bettingClosesAt: new Date(now + 10_000),
        resolutionTimestamp: new Date(now + 20_000),
        resolutionWindowSec: 300,
        protocolFeeBps: 0,
        minBet: toBaseUnits(1, 6),
        maxBet: toBaseUnits(5_000, 6),
      }),
    "§38: market creation is rejected while protocol is paused"
  );
  await assertThrows(
    () => placeBet({ marketId: cancelMarketId, address: ALICE, side: "yes", amount: toBaseUnits(1, 6) }),
    "§38: bet is rejected while protocol is paused"
  );
  await setPaused(false);
  assertTrue((await isPaused()) === false, "protocol resumes after unpause");

  console.log(failures === 0 ? "\nALL STRESS INVARIANTS PASSED" : `\n${failures} FAILURE(S)`);
  await getPool().end();
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(async (err) => {
  console.error(err);
  await getPool().end();
  process.exit(1);
});
