# Paper Bet — DB-ledger backend/UI + Solidity contracts (testnet in progress)

Spec: `../PAPER_BET_ROBINHOOD_CHAIN_DEVELOPER_BRIEF.md`.

Two parallel implementations of the same brief, kept in sync on purpose:

- **This directory (Next.js + NeonDB):** the DB-ledger phase — markets,
  bets, pool settlement, net-realized-loss accounting, and PAPER emission
  live in Next.js API routes + Postgres, the same "escrow is a database
  ledger, not an on-chain program" approach as the sibling `paper-arena`
  project. No wallet signatures or RPC required to run it.
- **`contracts/` (Foundry):** the real Solidity implementation — `PaperToken`,
  `EmissionController`, `PaperBetFactory`/`Market`, `FeeTreasury` (brief
  §13/§15/§19-21/§36). `PayoutMath.sol`/`EmissionMath.sol` are line-for-line
  ports of this directory's `lib/engine/pool.ts`/`netloss.ts`/`emission.ts`,
  and its 7 Foundry tests mirror `scripts/stress.ts`/`selftest.ts` scenario
  for scenario. See `contracts/README.md` for test/deploy instructions and
  exactly what's still unconfirmed (Chainlink Data Streams integration, the
  real USDG testnet address).

The UI (App Router pages under `app/`, components under `components/`) is
wired to the real API — no mock data. It covers all 7 pages from brief §41:
board (`/`), market detail (`/market/[id]`), slips/portfolio (`/portfolio`),
PAPER genesis (`/paper`), activity (`/activity`), stats (`/stats`), and the
settlement record (`/proof/[id]`), plus an unauthenticated `/admin/new-market`
form since V1 market creation is meant to be restricted (§20) but there's no
admin auth yet. Wallet "connection" is either a real injected EVM wallet
(`window.ethereum`, address-only, no signature) or a generated local test
address — both are just an address string per the identity model this phase
uses; see "What's real vs. simulated" below.

## What's real vs. simulated right now

| Brief concept | This phase |
|---|---|
| ERC-20 collateral deposit/approve (§18, §65) | Virtual balance per address in `wallets`, topped up via `/api/faucet` |
| PaperToken ERC-20 (§13) | `paper_ledger` table, non-transferable (no transfer endpoint exists) |
| EmissionController contract (§15) | `lib/engine/emission.ts` + `emission_state` table |
| Chainlink Data Streams resolver (§24/§25) | `lib/oracle/binance.ts` — real Binance spot price, not a signed oracle report |
| Market contract (§19-§21) | `markets`/`bets`/`positions` tables + `lib/engine/market.ts` |
| Resolution keeper (§48) | In-process worker (`lib/worker/scheduler.ts`), started lazily from the first `ensureSchema()` call, ticks every 15s |
| Chart/sparkline history on market cards | Deterministic pseudo-random walk seeded by market id, ending at today's real YES share — illustrative texture, not recorded pool-share history (none is stored yet) |

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your NeonDB connection string
npm run selftest             # pure-math invariants, no DB needed (§52/§53/§17/§7)
npm run stress                # full lifecycle against your NeonDB (needs DATABASE_URL)
npm run dev                  # http://localhost:3000 — full UI + API
```

To see a populated board, create a market first (no demo seed data ships
with this repo): open `/admin/new-market`, or `POST /api/markets` directly.

## API surface

```text
POST /api/markets                        create a market (§59 validation)
GET  /api/markets                        list markets
GET  /api/markets/:id                    market + positions + bet log
POST /api/markets/:id/bet                { address, side: "yes"|"no", amount }
POST /api/markets/:id/resolve            manual resolve trigger (worker also does this automatically)
POST /api/markets/:id/cancel             { reason } — unauthenticated in this phase, add auth before real deployment
POST /api/markets/:id/claim              winner payout, or refund if cancelled
POST /api/markets/:id/claim-paper        net-loss PAPER claim
POST /api/faucet                         { address, amount } — virtual balance top-up
GET  /api/wallets/:address               balance, PAPER balance, position history
GET  /api/paper                          PAPER genesis/supply snapshot (§45)
GET  /api/stats                          global protocol stats (§42/§68)
GET  /api/activity                       recent events feed, for the /activity "tape" page
POST /api/worker/tick                    force an open/lock/resolve pass now (optionally gated by TICK_SECRET header x-tick-secret)
```

All collateral amounts are integers in 1e6 base units (mirrors a 6-decimal
stablecoin); PAPER amounts are integers in 1e18 base units. Use
`lib/engine/units.ts` (`toBaseUnits`/`fromBaseUnits`) when working with
human-readable dollar/token amounts.

## Key invariants this phase enforces (brief §52/§53)

- PAPER emission uses **net realized loss**, not gross losing-side stake — a
  wallet that bets both YES and NO only mints PAPER on its true net loss
  (`lib/engine/netloss.ts`).
- Emission is piecewise across tier boundaries (§17) — a single claim that
  crosses a cumulative-loss threshold is split and rate-applied per segment
  (`lib/engine/emission.ts`).
- Empty-sided pools cancel instead of resolving (§34/§35) — `settlePools`
  throws rather than dividing by zero, and the caller cancels.
- Payout and PAPER claims are each one-time per `(market, address)`,
  enforced by `positions.payout_claimed` / `positions.loss_reward_claimed`
  flags checked inside the same DB transaction that pays out.
- Cancelled markets: zero protocol fee, zero PAPER, full stake refund.

## Closed since the first pass (brief gaps that were previously open)

- **Admin auth** (§37) — `POST /api/markets` and `POST /api/markets/:id/cancel`
  now require an `x-admin-key` header matching `ADMIN_API_KEY`. Refuses with
  `ADMIN_NOT_CONFIGURED` until that env var is set — secure by default, not
  silently open. `/admin/new-market` has a key field (stored in
  `localStorage`) that sends it.
- **Emergency pause** (§38) — `protocol_state.paused`, toggled via
  `POST /api/admin/pause` (admin-key gated), read via `GET /api/admin/pause`.
  Blocks `createMarket`/`placeBet` at the engine layer (so scripts and the
  API agree); claims and refunds are never blocked, per brief's explicit rule.
- **Genesis / transfer-enable milestone** (§14) — `lib/engine/admin.ts`'s
  `maybeEnableTransfers` flips `emission_state.transfers_enabled` once
  cumulative realized loss crosses `GENESIS_MILESTONE_LOSS_USD` ($100k,
  brief's own example — not a final product decision, see §75). One-way,
  checked after every PAPER mint.
- **Oracle adapter abstraction** (§24) — `lib/oracle/resolver.ts` defines
  `IOracleResolver`; `binanceResolver` implements it; `lib/oracle/index.ts`
  maps a market's `oracle_source` prefix to a resolver. Swapping in
  `ChainlinkDataStreamsResolver` later is a one-line registry addition, not
  a change to `lib/engine/market.ts`.
- **Fee treasury visibility** (§36) — `GET /api/treasury` exposes the
  cumulative fee counter. Still no withdrawal path — there's no real
  treasury wallet to withdraw to in this phase.
- **Zero-admin-effort board** — `lib/engine/autoMarket.ts`'s `ensureAutoMarkets()`
  runs every worker tick. For each of ETH/BTC/SOL, if there's no market in
  an active status, it creates one with a strike price from a LIVE Binance
  spot price (rounded to a clean number) and testnet-default params. Calls
  `createMarket()` directly at the engine layer, so it never touches the
  admin-key gate on `POST /api/markets` — this is an internal system action,
  not a user- or admin-initiated one. `/admin/new-market` still exists for
  manual overrides.

## Known gaps still open

- Oracle is unsigned Binance REST data, explicitly against brief §25/§27's
  "don't use unsigned REST as canonical settlement" rule — acceptable here
  only because this phase has no real collateral at stake. Needs a real
  `ChainlinkDataStreamsResolver` behind the same `IOracleResolver` interface.
- Auth is a single shared API key, not a role matrix or multisig (§37, §61).
- No Solidity contracts yet — `PaperToken`, `EmissionController`,
  `PaperBetFactory`/`Market`, `FeeTreasury` (§13, §15, §19-21, §36) are all DB
  tables + TypeScript, not on-chain. This is the biggest remaining gap
  before any of the brief's "no admin can mint" claims are enforced by code
  rather than trust in this backend.
- Emission curve in `TESTNET_EMISSION_TIERS` is the brief's own
  not-approved example (§16) — swap before anything but local testing.
- Fee cap, min/max bet, emission curve, and the genesis milestone threshold
  are all still product decisions per brief §75 — don't treat the testnet
  defaults as final.

## UI notes

- The visual design is adapted from a static HTML mockup into real App
  Router pages — hash routing became real routes, "Chainlink Data Streams"
  copy became "Binance spot price" to match what this phase actually does,
  and a CANCELLED market state/refund flow was added (the mockup only had
  open/locked/resolved). The mockup's stamp-animation and stub-tearing
  micro-interactions were simplified to plain state changes to keep the
  React wiring straightforward — same information, less choreography.
- `previewSettle` (`lib/client/estimate.ts`) is a float-based copy of the
  server's settlement math, used only for the hero simulator and the "to
  collect" preview in the trade panel before a bet is placed. The real
  numbers always come from the BigInt engine in `lib/engine/`.
