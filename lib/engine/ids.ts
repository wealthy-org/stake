import { randomBytes } from "node:crypto";

export function newMarketId(): string {
  return `mkt_${randomBytes(8).toString("hex")}`;
}
