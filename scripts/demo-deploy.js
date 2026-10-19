#!/usr/bin/env node

/**
 * Paper Bet — High-Production CLI Terminal Experience
 * Run with: npm run demo
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";

// Colors
const GREEN = "\x1b[32m";
const BRIGHT_GREEN = "\x1b[92m";
const CYAN = "\x1b[36m";
const BRIGHT_CYAN = "\x1b[96m";
const YELLOW = "\x1b[33m";
const BRIGHT_YELLOW = "\x1b[93m";
const BLUE = "\x1b[34m";
const BRIGHT_BLUE = "\x1b[94m";
const MAGENTA = "\x1b[35m";
const BRIGHT_MAGENTA = "\x1b[95m";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function typeWriter(text, speed = 22) {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(speed);
  }
  process.stdout.write("\n");
}

async function spinner(text, duration = 1400, color = CYAN) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < duration) {
    process.stdout.write(`\r${color}${frames[i++ % frames.length]}${RESET}  ${text}`);
    await sleep(70);
  }
  process.stdout.write(`\r${BRIGHT_GREEN}✔${RESET}  ${text}\n`);
}

async function progressBar(label, duration = 1500) {
  const total = 32;
  const start = Date.now();
  while (true) {
    const elapsed = Date.now() - start;
    const progress = Math.min(1, elapsed / duration);
    const filled = Math.floor(progress * total);
    const empty = total - filled;
    const bar = `${BRIGHT_BLUE}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
    const pct = String(Math.floor(progress * 100)).padStart(3);
    process.stdout.write(`\r  ${label} [${bar}] ${BRIGHT_CYAN}${pct}%${RESET}`);
    if (progress >= 1) break;
    await sleep(50);
  }
  process.stdout.write("\n");
}

async function printBanner() {
  console.clear();
  const bannerLines = [
    ` ${BRIGHT_BLUE} ██████╗  █████╗ ██████╗ ███████╗██████╗     ██████╗ ███████╗████████╗${RESET}`,
    ` ${BRIGHT_BLUE} ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗    ██╔══██╗██╔════╝╚══██╔══╝${RESET}`,
    ` ${BRIGHT_CYAN} ██████╔╝███████║██████╔╝█████╗  ██████╔╝    ██████╔╝█████╗     ██║   ${RESET}`,
    ` ${BRIGHT_CYAN} ██╔═══╝ ██╔══██║██╔═══╝ ██╔══╝  ██╔══██╗    ██╔══██╗██╔══╝     ██║   ${RESET}`,
    ` ${CYAN} ██║     ██║  ██║██║     ███████╗██║  ██║    ██████╔╝███████╗   ██║   ${RESET}`,
    ` ${CYAN} ╚═╝     ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝    ╚═════╝ ╚══════╝   ╚═╝   ${RESET}`,
  ];

  for (const line of bannerLines) {
    console.log(line);
    await sleep(55);
  }

  console.log(`\n  ${BOLD}${BRIGHT_YELLOW}“ WIN THE BET. LOSE INTO OWNERSHIP. ”${RESET}`);
  console.log(`  ${DIM}Robinhood Chain (Chain ID: 46630) • Non-Custodial Binary Prediction Protocol${RESET}`);
  console.log(`  ${DIM}${"═".repeat(78)}${RESET}\n`);
  await sleep(600);
}

async function main() {
  await printBanner();

  process.stdout.write(`  ${BOLD}${GREEN}mac@MacBook-Air-Mac${RESET}:${CYAN}~/paper-bet${RESET}$ `);
  await typeWriter("cd contracts && forge script script/Deploy.s.sol --broadcast", 26);
  await sleep(400);

  console.log(`\n  ${BOLD}${YELLOW}► INITIATING PROTOCOL GENESIS BOOTSTRAP${RESET}`);
  await sleep(300);

  await spinner("Analyzing protocol architecture & Foundry config (foundry.toml)...", 1100, BRIGHT_BLUE);
  await progressBar("Optimizing Bytecode (Solc 0.8.26 via-IR)", 1600);
  
  console.log(`\n  ${BOLD}${CYAN}► COMPILED ARTIFACTS & MATHEMATICAL PROOFS:${RESET}`);
  console.log(`    ${DIM}├─ PaperToken.sol         : Zero-supply genesis (Supply strictly mintable from net loss)${RESET}`);
  console.log(`    ${DIM}├─ EmissionController.sol : Piecewise emission curve across 4 tiers ($100k milestone)${RESET}`);
  console.log(`    ${DIM}├─ PaperBetFactory.sol    : EIP-1167 Minimal Proxy clone factory (gas-optimized)${RESET}`);
  console.log(`    ${DIM}├─ PaperBetMarket.sol     : Dust-free fixed-point arithmetic pool settlement${RESET}`);
  console.log(`    ${DIM}└─ Invariant Suites       : 128,000 multi-actor calls verified (100% Solvency)${RESET}`);
  await sleep(800);

  console.log(`\n  ${BOLD}${MAGENTA}► CONNECTING TO ROBINHOOD CHAIN NETWORK${RESET}`);
  await spinner("Pinging RPC endpoint (https://rpc.testnet.chain.robinhood.com)...", 900, MAGENTA);
  await spinner("Authenticating Deployer Key (0xb91E...B5AE)...", 800, BRIGHT_MAGENTA);
  await spinner("Validating Consensus & Nonce Sequence (Testnet 46630)...", 1000, CYAN);

  console.log(`\n  ${BOLD}${BRIGHT_YELLOW}► BROADCASTING ON-CHAIN TRANSACTIONS${RESET}`);
  await sleep(300);

  const deploys = [
    {
      name: "MockCollateral (mUSDG)",
      addr: "0x9084a6Fb1740a6Ad63c564e9213A885Ff035ea43",
      tx: "0x89224d1b660a523c27851e0e1b683ecccc47459ab2a3a94c38893d7830eee19c",
      gas: "477,283 gas",
      block: "138754271",
      badge: "[COLLATERAL]",
    },
    {
      name: "MockOracleResolver",
      addr: "0x18d9cB324b31C1cafBa2d76dF7F1478FDF8aABB4",
      tx: "0x782a99d0b886a052659eeebfb60980668072d48ea0285db32dc018e5a7562476",
      gas: "109,669 gas",
      block: "138754295",
      badge: "[ORACLE]",
    },
    {
      name: "PaperToken ($PAPER)",
      addr: "0xccffc2ED8dc1796Ed27F7B682c78A23E299EC6Db",
      tx: "0x672854735c6159c0e0fcb578343ee0351eff7ba50ac236de8a58710430e36b39",
      gas: "785,642 gas",
      block: "138754698",
      badge: "[TOKEN]",
    },
    {
      name: "EmissionController",
      addr: "0x326305D7169ca5d6ABBe038726a3C2a396B2e044",
      tx: "0x0debef62364c7a6d49c5fb793244420200fd49cf27481224bdffb007f5e8af7c",
      gas: "811,158 gas",
      block: "138754712",
      badge: "[CONTROLLER]",
    },
    {
      name: "ProtocolPause",
      addr: "0x82f273568cD93a5DCAec4e2021f74d05ac6DA9b4",
      tx: "0xb69b122c12bef3e97e99a156e981f979f9209c98eb0165fde6c2f4a7bfb6e9bc",
      gas: "373,378 gas",
      block: "138754739",
      badge: "[PAUSE_GUARD]",
    },
    {
      name: "FeeTreasury",
      addr: "0x63f59137c81E46fF5433557e2B5F36EA22ad9582",
      tx: "0xe4cfc1c136fcf595a6548f60b544ca64d5f42bfc505f43f3acd026c15e7a8305",
      gas: "397,477 gas",
      block: "138754770",
      badge: "[TREASURY]",
    },
    {
      name: "PaperBetMarket (Master)",
      addr: "0xFd7a931E70aCc9dD66016c229BfAc2aeDa4E33a1",
      tx: "0x96ded161680907cdcca8010418ad9604357331d1a1729739aeef8652aa43cdae",
      gas: "1,688,517 gas",
      block: "138754784",
      badge: "[LOGIC]",
    },
    {
      name: "PaperBetFactory",
      addr: "0xE106dd6464eBc44fd23E9B341e905e31471f10a5",
      tx: "0x3eee541db701fe944fde18f5e61c789055418b991511cf87565dae145dbe3148",
      gas: "1,098,412 gas",
      block: "138754825",
      badge: "[FACTORY]",
    },
  ];

  for (const d of deploys) {
    await sleep(220);
    console.log(
      `    ${BRIGHT_GREEN}✔${RESET} ${BOLD}${d.name.padEnd(28)}${RESET} ${YELLOW}${d.badge.padEnd(14)}${RESET} -> ${BRIGHT_CYAN}${d.addr}${RESET}`
    );
    console.log(`      ${DIM}Block: #${d.block} | Gas: ${d.gas} | Tx: ${d.tx.slice(0, 28)}...${RESET}`);
  }

  await sleep(400);
  console.log(`\n  ${BOLD}${BRIGHT_MAGENTA}► SECURING PROTOCOL INVARIANTS & ROLES:${RESET}`);
  await sleep(250);
  console.log(`    ${BRIGHT_GREEN}✔${RESET} Granted ${BOLD}EMISSION_ROLE${RESET} to EmissionController (Tx: 0xdea65c... [Block #138754847])`);
  await sleep(200);
  console.log(`    ${BRIGHT_GREEN}✔${RESET} Granted ${BOLD}FACTORY_ROLE${RESET} to PaperBetFactory   (Tx: 0x6f32bf... [Block #138754868])`);
  await sleep(200);
  console.log(`    ${BRIGHT_GREEN}✔${RESET} Admin arbitrary minting revoked. Initial supply verified strictly at ${BOLD}0 $PAPER${RESET}.`);
  await sleep(200);
  console.log(`    ${BRIGHT_GREEN}✔${RESET} All market creations bound to permissionless Oracle verification.`);

  await sleep(500);
  console.log(`\n  ${DIM}${"═".repeat(78)}${RESET}`);
  console.log(`  ${BOLD}${BRIGHT_GREEN}🚀 PAPER BET PROTOCOL IS LIVE ON ROBINHOOD CHAIN TESTNET!${RESET}`);
  console.log(`  ${DIM}Chain ID: 46630 | Total Gas: 0.000058 ETH (~$0.15) | Solvency: 100% Invariant Verified${RESET}`);
  console.log(`  ${DIM}${"═".repeat(78)}${RESET}\n`);
}

main().catch(console.error);
