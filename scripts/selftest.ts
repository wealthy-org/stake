// Pure-math self test for the engine — no DB needed. Checks the invariants
// from brief §52/§53 that must hold regardless of how the DB layer wires in.
import { settlePools, winnerPayout } from "../lib/engine/pool";
import { calcNetLoss } from "../lib/engine/netloss";
import { calcEmission, TESTNET_EMISSION_TIERS } from "../lib/engine/emission";
import { evaluateComparison } from "../lib/engine/comparison";
import { toBaseUnits, fromBaseUnits } from "../lib/engine/units";

let failures = 0;

function assertEq(actual: unknown, expected: unknown, label: string) {
  const a = String(actual);
  const e = String(expected);
  if (a !== e) {
    failures++;
    console.error(`FAIL: ${label} — expected ${e}, got ${a}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function assertTrue(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// --- §9/§10: pool settlement + brief's own worked example ---
{
  const yesPool = toBaseUnits(60_000, 6);
  const noPool = toBaseUnits(40_000, 6);
  const settlement = settlePools(yesPool, noPool, true, 200); // 2% fee, YES wins

  assertEq(fromBaseUnits(settlement.protocolFee, 6), "800", "brief worked example: protocol fee = 800");
  assertEq(fromBaseUnits(settlement.netLosingPool, 6), "39200", "brief worked example: net losing pool = 39200");

  const aliceStake = toBaseUnits(6_000, 6);
  const { profit, totalPayout } = winnerPayout(aliceStake, settlement.rewardPerWinningShare);
  // §33: integer division leaves sub-cent rounding dust by design (left in the
  // market, per brief's own V1 recommendation) — assert within 1 base unit (1e-6), not bit-exact.
  const expectedProfit = toBaseUnits(3920, 6);
  const expectedPayout = toBaseUnits(9920, 6);
  assertTrue(
    profit <= expectedProfit && expectedProfit - profit <= 1n,
    `brief worked example: Alice profit ~= 3920 (got ${fromBaseUnits(profit, 6)}, §33 rounding dust allowed)`
  );
  assertTrue(
    totalPayout <= expectedPayout && expectedPayout - totalPayout <= 1n,
    `brief worked example: Alice total claim ~= 9920 (got ${fromBaseUnits(totalPayout, 6)}, §33 rounding dust allowed)`
  );
}

// --- §11: net-loss basis, not gross losing stake (hedge farming guard) ---
{
  // Alice bets 100 YES and 100 NO in the same market. YES wins.
  const yesPool = toBaseUnits(1_000, 6);
  const noPool = toBaseUnits(1_000, 6);
  const settlement = settlePools(yesPool, noPool, true, 0); // no fee, simplest case

  const netLoss = calcNetLoss({
    yesStake: toBaseUnits(100, 6),
    noStake: toBaseUnits(100, 6),
    yesWon: true,
    rewardPerWinningShare: settlement.rewardPerWinningShare,
  });

  // With 0% fee and a 50/50 pool, Alice's 100 YES stake returns exactly 200 (100 stake + 100 profit).
  // totalStake = 200, totalPayout = 200 -> realized loss must be 0, NOT 100 (the gross NO-side loss).
  assertEq(netLoss.realizedLoss, "0", "§11: hedged wallet with totalPayout==totalStake has zero realized loss");
}

{
  // §53: profitable wallet (payout > stake) must get zero PAPER even with a losing position on one side.
  const settlement = settlePools(toBaseUnits(100, 6), toBaseUnits(300, 6), true, 0);
  const netLoss = calcNetLoss({
    yesStake: toBaseUnits(100, 6),
    noStake: toBaseUnits(20, 6), // small hedge on the losing side
    yesWon: true,
    rewardPerWinningShare: settlement.rewardPerWinningShare,
  });
  assertTrue(netLoss.netPnL > 0n, "§53: net-profitable wallet sanity check (netPnL > 0)");
  assertEq(netLoss.realizedLoss, "0", "§53: net-profitable wallet gets zero realized loss despite losing side");
}

// --- §34/§35: empty-side pool must not be settled (would divide by zero) ---
{
  let threw = false;
  try {
    settlePools(toBaseUnits(100, 6), 0n, true, 100);
  } catch {
    threw = true;
  }
  assertTrue(threw, "§34/§35: settlePools throws instead of dividing by zero on an empty side");
}

// --- §17: emission boundary crossing must be piecewise, not single-rate ---
{
  const cumulativeBefore = toBaseUnits(99_900, 6);
  const loss = toBaseUnits(500, 6);
  const minted = calcEmission(cumulativeBefore, loss, TESTNET_EMISSION_TIERS);

  // first $100 at tier0 rate (100 PAPER/$) = 10,000 PAPER, remaining $400 at
  // tier1 rate (40 PAPER/$) = 16,000 PAPER -> 26,000 PAPER total, in 1e18 base units.
  const expected = 26_000n * 10n ** 18n;
  assertEq(minted.toString(), expected.toString(), "§17: emission boundary crossing is piecewise across tiers");
}

// --- §7: exact-strike match resolves to the comparison's literal boolean (no implicit tie rule) ---
{
  assertTrue(evaluateComparison("gt", 5000, 5000) === false, "§7: GREATER_THAN at exact strike -> false (NO wins)");
  assertTrue(evaluateComparison("gte", 5000, 5000) === true, "§7: GREATER_THAN_OR_EQUAL at exact strike -> true");
}

console.log(failures === 0 ? "\nALL ENGINE INVARIANTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
