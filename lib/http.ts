import { NextResponse } from "next/server";
import { MarketError } from "./engine/errors";

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  ADMIN_NOT_CONFIGURED: 500,
  PAUSED: 503,
};

export function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(err: unknown) {
  if (err instanceof MarketError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS_BY_CODE[err.code] ?? 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

/** bigint doesn't survive JSON.stringify natively; routes send amounts as strings. */
export function toJsonSafe(value: any): any {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v);
    return out;
  }
  return value;
}
