import { NextRequest } from "next/server";
import { createMarket } from "@/lib/engine/market";
import { requireAdmin } from "@/lib/engine/admin";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/schema";
import { ok, fail, toJsonSafe } from "@/lib/http";

export async function GET() {
  try {
    await ensureSchema();
    const markets = await query(
      `SELECT m.*, COALESCE(b.bettor_count, 0) AS bettor_count
       FROM markets m
       LEFT JOIN (
         SELECT market_id, COUNT(DISTINCT address) AS bettor_count FROM bets GROUP BY market_id
       ) b ON b.market_id = m.id
       ORDER BY m.created_at DESC`
    );
    return ok(toJsonSafe(markets));
  } catch (err) {
    return fail(err);
  }
}

// Brief §20/§37 — V1 market creation is restricted to an approved creator, not permissionless.
export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const id = await createMarket({
      question: body.question,
      assetSymbol: body.assetSymbol,
      oracleSource: body.oracleSource, // e.g. "binance:ETHUSDT"
      strikePrice: Number(body.strikePrice),
      comparison: body.comparison,
      bettingOpensAt: new Date(body.bettingOpensAt),
      bettingClosesAt: new Date(body.bettingClosesAt),
      resolutionTimestamp: new Date(body.resolutionTimestamp),
      resolutionWindowSec: Number(body.resolutionWindowSec),
      protocolFeeBps: Number(body.protocolFeeBps),
      minBet: BigInt(body.minBet),
      maxBet: BigInt(body.maxBet),
    });
    return ok({ id }, 201);
  } catch (err) {
    return fail(err);
  }
}
