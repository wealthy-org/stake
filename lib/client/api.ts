import type {
  ActivityEvent,
  MarketRow,
  PaperSummary,
  PositionRow,
  ProtocolStats,
  WalletSummary,
} from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ? `${body.error}${body.code ? ` (${body.code})` : ""}` : `request failed: ${res.status}`);
  }
  return body as T;
}

export function listMarkets(): Promise<MarketRow[]> {
  return req("/api/markets");
}

export function getMarket(id: string): Promise<{ market: MarketRow; positions: PositionRow[]; bets: any[] }> {
  return req(`/api/markets/${id}`);
}

export function placeBet(marketId: string, address: string, side: "yes" | "no", amountBaseUnits: string) {
  return req(`/api/markets/${marketId}/bet`, {
    method: "POST",
    body: JSON.stringify({ address, side, amount: amountBaseUnits }),
  });
}

export function claimPayout(marketId: string, address: string): Promise<{ amount: string }> {
  return req(`/api/markets/${marketId}/claim`, { method: "POST", body: JSON.stringify({ address }) });
}

export function claimPaper(marketId: string, address: string): Promise<{ realizedLoss: string; paperMinted: string }> {
  return req(`/api/markets/${marketId}/claim-paper`, { method: "POST", body: JSON.stringify({ address }) });
}

export function faucet(address: string, amountBaseUnits: string) {
  return req(`/api/faucet`, { method: "POST", body: JSON.stringify({ address, amount: amountBaseUnits }) });
}

export function getWallet(address: string): Promise<WalletSummary> {
  return req(`/api/wallets/${address}`);
}

export function getPaperSummary(): Promise<PaperSummary> {
  return req("/api/paper");
}

export function getStats(): Promise<ProtocolStats> {
  return req("/api/stats");
}

export function getActivity(limit?: number): Promise<ActivityEvent[]> {
  return req(limit ? `/api/activity?limit=${limit}` : "/api/activity");
}

export function createMarket(input: Record<string, any>, adminKey: string): Promise<{ id: string }> {
  return req("/api/markets", {
    method: "POST",
    headers: { "x-admin-key": adminKey },
    body: JSON.stringify(input),
  });
}

export function setPaused(paused: boolean, adminKey: string): Promise<{ paused: boolean }> {
  return req("/api/admin/pause", {
    method: "POST",
    headers: { "x-admin-key": adminKey },
    body: JSON.stringify({ paused }),
  });
}

export function getPauseState(): Promise<{ paused: boolean }> {
  return req("/api/admin/pause");
}

export function cancelMarket(marketId: string, reason: string, adminKey: string) {
  return req(`/api/markets/${marketId}/cancel`, {
    method: "POST",
    headers: { "x-admin-key": adminKey },
    body: JSON.stringify({ reason }),
  });
}

export function getTreasury(): Promise<{ cumulativeFee: string; paused: boolean }> {
  return req("/api/treasury");
}
