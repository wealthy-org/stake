# Paper Bet contracts

Solidity implementation of the brief's V1 architecture (§19-§39), written
against the already-validated math in `../lib/engine/` (the backend-logic
phase's pool/net-loss/emission functions) — `PayoutMath.sol` and
`EmissionMath.sol` are line-for-line ports of `lib/engine/pool.ts`,
`lib/engine/netloss.ts`, and `lib/engine/emission.ts`.

## Layout

```text
src/
├── PaperToken.sol              ERC-20, zero initial supply, EMISSION_ROLE-only mint (§13)
├── EmissionController.sol      the only minter; net-loss -> PAPER (§15)
├── PaperBetFactory.sol         EIP-1167 clone factory, role-gated creation (§19/§20)
├── PaperBetMarket.sol          one market per clone: bet/resolve/claim (§21-§35)
├── ProtocolPause.sol           shared pause switch (§38)
├── FeeTreasury.sol             fee collection, multisig-gated withdrawal (§36)
├── oracle/
│   ├── IOracleResolver.sol             adapter interface (§24)
│   └── ChainlinkDataStreamsResolver.sol UNVERIFIED SCAFFOLD — see its NatSpec
├── interfaces/                 IEmissionController, IPaperBetMarket
├── libraries/                  PayoutMath, EmissionMath (pure math, no state)
└── mocks/                      MockCollateral, MockOracleResolver — tests/testnet only
```

## Test

```bash
forge test -vv
```

7 tests mirror `../scripts/stress.ts` and `../scripts/selftest.ts` scenario
for scenario (worked example from brief §9/§10, the net-loss hedge-farming
guard from §11, the profitable-hedge-zero-PAPER rule from §53, double-claim
rejection from §52 Invariant 3/4, empty-pool cancellation from §34/§35,
pause from §38, bet bounds from §59).

## Deploy to Robinhood Chain testnet

```bash
cp .env.example .env   # fill in RPC, ADMIN_ADDRESS; never commit this file
source .env

# 1. First pass: deploy mocks so you're not blocked on real USDG/Chainlink
forge script script/DeployMocks.s.sol --rpc-url robinhood_testnet --broadcast

# 2. Export the two printed addresses, then deploy the real stack
export COLLATERAL_TOKEN=<MockCollateral address from step 1>
export ORACLE_RESOLVER=<MockOracleResolver address from step 1>
forge script script/Deploy.s.sol --rpc-url robinhood_testnet --broadcast
## Live Robinhood Chain Testnet Deployment (Chain ID 46630)

| Contract | Address |
|---|---|
| `MockCollateral` (mUSDG) | `0x9084a6Fb1740a6Ad63c564e9213A885Ff035ea43` |
| `MockOracleResolver` | `0x18d9cB324b31C1cafBa2d76dF7F1478FDF8aABB4` |
| `PaperToken` (`$PAPER`) | `0xccffc2ED8dc1796Ed27F7B682c78A23E299EC6Db` |
| `EmissionController` | `0x326305D7169ca5d6ABBe038726a3C2a396B2e044` |
| `ProtocolPause` | `0x82f273568cD93a5DCAec4e2021f74d05ac6DA9b4` |
| `FeeTreasury` | `0x63f59137c81E46fF5433557e2B5F36EA22ad9582` |
| `PaperBetMarket` (Implementation) | `0xFd7a931E70aCc9dD66016c229BfAc2aeDa4E33a1` |
| `PaperBetFactory` | `0xE106dd6464eBc44fd23E9B341e905e31471f10a5` |

Deployer / Admin: `0xb91E596EF3E1855df77bC34b2d094eF8704bB5AE`

## What's deliberately NOT done yet

- **ChainlinkDataStreamsResolver.sol is a scaffold, not a working
  integration.** Its NatSpec lists exactly what's unconfirmed: the real
  report struct (needs the actual `@chainlink/contracts` package, not a
  hand-typed guess), the fee-token encoding for `parameterPayload`, whether
  this chain's VerifierProxy needs LINK/native fee payment, and the
  testnet VerifierProxy address (brief §4's own docs only list the mainnet
  one). Get Data Streams API credentials at app.chain.link and confirm all
  four before using this contract for anything beyond compiling.
- **USDG address is unverified for testnet specifically.** The canonical
  token page lists one address without saying which network it's for —
  confirm on Robinhood Chain testnet Blockscout before setting
  `COLLATERAL_TOKEN` to it (brief §18's own warning).
- **Foundry invariant & fuzz tests implemented** (brief §55/§56) — `test/FuzzMath.t.sol` (property testing for solvency, net-loss hedge farming guard, and piecewise emission additivity) and `test/PaperBetInvariant.t.sol` (stateful invariant testing with `MarketHandler` over 128,000 randomized multi-actor calls verifying market solvency, finality, and PAPER supply integrity).
- **No external security audit** — brief §70 Gate 16 is unmet by
  definition; nothing in this repo substitutes for one.
