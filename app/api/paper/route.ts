import { queryOne } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/schema";
import { previewRateAt } from "@/lib/engine/emission";
import { toBigInt } from "@/lib/engine/units";
import { ok, fail, toJsonSafe } from "@/lib/http";

// Backing data for the brief §45 /paper genesis dashboard.
export async function GET() {
  try {
    await ensureSchema();
    const state = await queryOne<any>(`SELECT * FROM emission_state WHERE id = 1`);
    const cumulativeLoss = toBigInt(state.cumulative_realized_loss);

    return ok(
      toJsonSafe({
        supply: state.cumulative_paper_minted,
        genesisSupply: "0",
        cumulativeRealizedLoss: state.cumulative_realized_loss,
        currentEmissionRatePerDollar: previewRateAt(cumulativeLoss),
        transfersEnabled: state.transfers_enabled,
      })
    );
  } catch (err) {
    return fail(err);
  }
}
