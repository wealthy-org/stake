import type { PoolClient } from "pg";
import { query, queryOne } from "../db/client";
import { ensureSchema } from "../db/schema";
import { toBigInt } from "./units";
import { MarketError } from "./errors";

/**
 * Genesis milestone (brief §14) — testnet-only placeholder, product owner
 * must finalize before mainnet (brief §75). Chosen here: $100,000 cumulative
 * verified realized loss, matching the brief's own example list in §14.
 */
export const GENESIS_MILESTONE_LOSS_USD = 100_000;

export async function isPaused(): Promise<boolean> {
  await ensureSchema();
  const row = await queryOne<{ paused: boolean }>(`SELECT paused FROM protocol_state WHERE id = 1`);
  return row?.paused ?? false;
}

export async function setPaused(paused: boolean): Promise<void> {
  await ensureSchema();
  await query(`UPDATE protocol_state SET paused = $1 WHERE id = 1`, [paused]);
}

/**
 * One-way transfer enable (brief §14) — checked after every PAPER mint.
 * Never flips back to false once true, and the milestone threshold is the
 * only condition, so no admin action can enable or disable it early.
 */
export async function maybeEnableTransfers(client: PoolClient): Promise<void> {
  const row = await client.query(`SELECT cumulative_realized_loss, transfers_enabled FROM emission_state WHERE id = 1`);
  const state = row.rows[0];
  if (state.transfers_enabled) return;
  const cumulativeLoss = toBigInt(state.cumulative_realized_loss);
  const thresholdBaseUnits = BigInt(GENESIS_MILESTONE_LOSS_USD) * 1_000_000n;
  if (cumulativeLoss >= thresholdBaseUnits) {
    await client.query(`UPDATE emission_state SET transfers_enabled = true WHERE id = 1`);
  }
}

export function requireAdmin(req: Request): void {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) {
    throw new MarketError("ADMIN_API_KEY is not configured on the server", "ADMIN_NOT_CONFIGURED");
  }
  const provided = req.headers.get("x-admin-key");
  if (provided !== configured) {
    throw new MarketError("unauthorized", "UNAUTHORIZED");
  }
}
