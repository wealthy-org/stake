import { getPool } from "./client";

/**
 * All collateral amounts are stored as integer base units (1e6, mirrors a
 * 6-decimal stablecoin like USDG) in NUMERIC columns so JS can do exact
 * BigInt math instead of floating point. PAPER amounts use 1e18 base units
 * (mirrors an 18-decimal ERC-20) for the same reason.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    virtual_balance NUMERIC(78,0) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    asset_symbol TEXT NOT NULL,
    oracle_source TEXT NOT NULL,
    strike_price NUMERIC(38,8) NOT NULL,
    comparison TEXT NOT NULL CHECK (comparison IN ('gt','gte','lt','lte')),

    betting_opens_at TIMESTAMPTZ NOT NULL,
    betting_closes_at TIMESTAMPTZ NOT NULL,
    resolution_timestamp TIMESTAMPTZ NOT NULL,
    resolution_window_sec INTEGER NOT NULL,

    protocol_fee_bps INTEGER NOT NULL,
    min_bet NUMERIC(78,0) NOT NULL,
    max_bet NUMERIC(78,0) NOT NULL,

    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft','open','locked','resolution_pending','resolved','cancelled')),

    yes_pool NUMERIC(78,0) NOT NULL DEFAULT 0,
    no_pool NUMERIC(78,0) NOT NULL DEFAULT 0,

    resolved_price NUMERIC(38,8),
    resolved_at TIMESTAMPTZ,
    report_timestamp TIMESTAMPTZ,
    yes_won BOOLEAN,

    protocol_fee NUMERIC(78,0),
    net_losing_pool NUMERIC(78,0),
    reward_per_winning_share NUMERIC(78,0),

    cancel_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS bets (
    id BIGSERIAL PRIMARY KEY,
    market_id TEXT NOT NULL REFERENCES markets(id),
    address TEXT NOT NULL REFERENCES wallets(address),
    side TEXT NOT NULL CHECK (side IN ('yes','no')),
    amount NUMERIC(78,0) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS bets_market_address_idx ON bets (market_id, address)`,

  `CREATE TABLE IF NOT EXISTS positions (
    market_id TEXT NOT NULL REFERENCES markets(id),
    address TEXT NOT NULL REFERENCES wallets(address),
    yes_stake NUMERIC(78,0) NOT NULL DEFAULT 0,
    no_stake NUMERIC(78,0) NOT NULL DEFAULT 0,
    payout_claimed BOOLEAN NOT NULL DEFAULT false,
    loss_reward_claimed BOOLEAN NOT NULL DEFAULT false,
    realized_loss NUMERIC(78,0),
    paper_minted NUMERIC(78,0),
    PRIMARY KEY (market_id, address)
  )`,

  `CREATE TABLE IF NOT EXISTS emission_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    cumulative_realized_loss NUMERIC(78,0) NOT NULL DEFAULT 0,
    cumulative_paper_minted NUMERIC(78,0) NOT NULL DEFAULT 0,
    transfers_enabled BOOLEAN NOT NULL DEFAULT false,
    CHECK (id = 1)
  )`,

  `CREATE TABLE IF NOT EXISTS protocol_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    paused BOOLEAN NOT NULL DEFAULT false,
    CHECK (id = 1)
  )`,

  `CREATE TABLE IF NOT EXISTS paper_ledger (
    address TEXT PRIMARY KEY REFERENCES wallets(address),
    balance NUMERIC(78,0) NOT NULL DEFAULT 0,
    total_minted NUMERIC(78,0) NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS fee_treasury (
    id INTEGER PRIMARY KEY DEFAULT 1,
    cumulative_fee NUMERIC(78,0) NOT NULL DEFAULT 0,
    CHECK (id = 1)
  )`,

  `CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    market_id TEXT,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS events_market_idx ON events (market_id)`,
];

let initialized: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!initialized) {
    initialized = (async () => {
      const pool = getPool();
      for (const statement of STATEMENTS) {
        await pool.query(statement);
      }
      await pool.query(
        `INSERT INTO emission_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
      );
      await pool.query(
        `INSERT INTO fee_treasury (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
      );
      await pool.query(
        `INSERT INTO protocol_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
      );

      // Started here (once per server process) rather than from
      // instrumentation.ts — Next.js compiles instrumentation.ts for both
      // the Node.js and edge runtimes regardless of whether a route needs
      // it, and the edge compile pass can't bundle `pg` (it conditionally
      // requires `fs`), which broke every route with a 500. API routes are
      // Node-only, so starting it from the first ensureSchema() call avoids
      // that entirely.
      const { startWorker } = await import("../worker/scheduler");
      await startWorker();
    })().catch((err) => {
      // A rejected promise stays rejected forever — without this, one
      // transient dropped connection during setup (Neon closes idle
      // sockets without warning) would permanently wedge every route on
      // this process, since every future call just re-awaits the same
      // cached rejection instead of retrying. Clear it so the next call
      // gets a fresh attempt.
      initialized = null;
      throw err;
    });
  }
  return initialized;
}
