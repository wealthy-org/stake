// CLI: tsx scripts/faucet.ts <address> <amount-in-whole-dollars>
import { faucetTopUp } from "../lib/engine/market";
import { toBaseUnits } from "../lib/engine/units";
import { getPool } from "../lib/db/client";

const [address, amount] = process.argv.slice(2);
if (!address || !amount) {
  console.error("usage: tsx scripts/faucet.ts <address> <amount-in-whole-dollars>");
  process.exit(1);
}

faucetTopUp(address.toLowerCase(), toBaseUnits(amount, 6))
  .then(async () => {
    console.log(`topped up ${address} by ${amount}`);
    await getPool().end();
  })
  .catch(async (err) => {
    console.error(err);
    await getPool().end();
    process.exit(1);
  });
