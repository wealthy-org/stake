"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createMarket, getPauseState, setPaused, getTreasury } from "@/lib/client/api";
import { collateralToNumber, dollarsToBaseUnits, usd } from "@/lib/client/format";

const ASSETS = ["ETH", "BTC", "SOL", "NVDA", "AAPL", "TSLA"] as const;
const ADMIN_KEY_STORAGE = "pb-admin-key";

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminKeyField({ adminKey, setAdminKey }: { adminKey: string; setAdminKey: (v: string) => void }) {
  return (
    <div className="full">
      <label>Admin key (x-admin-key, matches server ADMIN_API_KEY)</label>
      <input
        type="password"
        value={adminKey}
        onChange={(e) => {
          setAdminKey(e.target.value);
          try {
            localStorage.setItem(ADMIN_KEY_STORAGE, e.target.value);
          } catch {
            // ignore
          }
        }}
        style={{ width: "100%", padding: 8 }}
      />
    </div>
  );
}

function PauseControl({ adminKey }: { adminKey: string }) {
  const [paused, setPausedState] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPauseState().then((r) => setPausedState(r.paused)).catch(() => {});
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await setPaused(!paused, adminKey);
      setPausedState(res.paused);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle pause");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="blk" style={{ maxWidth: 480 }}>
      <h3>Protocol pause (brief §38)</h3>
      <p style={{ fontSize: 14 }}>
        Status: <b>{paused === null ? "…" : paused ? "PAUSED — new bets and market creation blocked" : "Running"}</b>.
        Claims and refunds are never blocked by this switch.
      </p>
      <button className="btn" disabled={busy || paused === null} onClick={toggle}>
        {paused ? "Resume" : "Pause protocol"}
      </button>
      {error && <p style={{ color: "var(--no)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function TreasuryPanel() {
  const [treasury, setTreasury] = useState<{ cumulativeFee: string; paused: boolean } | null>(null);

  useEffect(() => {
    getTreasury().then(setTreasury).catch(() => {});
  }, []);

  return (
    <div className="blk" style={{ maxWidth: 480 }}>
      <h3>Fee treasury (brief §36)</h3>
      <p style={{ fontSize: 14 }}>
        Cumulative protocol fee collected: <b>{treasury ? usd(collateralToNumber(treasury.cumulativeFee), 2) : "…"}</b>.
        No withdrawal endpoint yet — there is no real treasury wallet to withdraw to in this phase.
      </p>
    </div>
  );
}

export default function NewMarketPage() {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("ETH");
  const [strike, setStrike] = useState("5000");
  const [comparison, setComparison] = useState<"gt" | "gte" | "lt" | "lte">("gt");
  const [closesAt, setClosesAt] = useState(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [resolvesAt, setResolvesAt] = useState(toLocalInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [feeBps, setFeeBps] = useState("200");
  const [minBet, setMinBet] = useState("1");
  const [maxBet, setMaxBet] = useState("5000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_KEY_STORAGE);
      if (saved) setAdminKey(saved);
    } catch {
      // ignore
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const question = `Will ${asset} be ${comparison === "gt" || comparison === "gte" ? "above" : "below"} $${strike} at ${new Date(resolvesAt).toUTCString()}?`;
      const { id } = await createMarket(
        {
          question,
          assetSymbol: asset,
          oracleSource: `binance:${asset}USDT`,
          strikePrice: Number(strike),
          comparison,
          bettingOpensAt: new Date().toISOString(),
          bettingClosesAt: new Date(closesAt).toISOString(),
          resolutionTimestamp: new Date(resolvesAt).toISOString(),
          resolutionWindowSec: 300,
          protocolFeeBps: Number(feeBps),
          minBet: dollarsToBaseUnits(minBet),
          maxBet: dollarsToBaseUnits(maxBet),
        },
        adminKey
      );
      router.push(`/market/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create market");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sec" style={{ marginTop: 0 }}>
        <h2>Admin</h2>
      </div>
      <p className="note" style={{ marginBottom: 20 }}>
        Restricted by a single shared <code>ADMIN_API_KEY</code> (set as an env var on the server) — not a real
        multisig/role matrix (brief §37, §61). Good enough for testnet, not for anything beyond it.
      </p>

      <form onSubmit={submit} className="ctl" style={{ maxWidth: 480, marginBottom: 40 }}>
        <AdminKeyField adminKey={adminKey} setAdminKey={setAdminKey} />
        <div className="full">
          <label>Asset</label>
          <div className="seg">
            {ASSETS.map((a) => (
              <button type="button" key={a} className={asset === a ? "on" : ""} onClick={() => setAsset(a)}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label>Strike price (USD)</label>
          <input value={strike} onChange={(e) => setStrike(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label>Comparison</label>
          <select value={comparison} onChange={(e) => setComparison(e.target.value as any)} style={{ width: "100%", padding: 8 }}>
            <option value="gt">above (strict)</option>
            <option value="gte">above or equal</option>
            <option value="lt">below (strict)</option>
            <option value="lte">below or equal</option>
          </select>
        </div>
        <div>
          <label>Betting closes at</label>
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label>Resolution time</label>
          <input type="datetime-local" value={resolvesAt} onChange={(e) => setResolvesAt(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label>Protocol fee (bps, max 500)</label>
          <input value={feeBps} onChange={(e) => setFeeBps(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label>Min bet (USD)</label>
          <input value={minBet} onChange={(e) => setMinBet(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </div>
        <div>
          <label>Max bet (USD)</label>
          <input value={maxBet} onChange={(e) => setMaxBet(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </div>
        <div className="full">
          <button className="btn big block" disabled={busy}>
            {busy ? "Creating…" : "Create market"}
          </button>
        </div>
        {error && <p className="full" style={{ color: "var(--no)" }}>{error}</p>}
      </form>

      <PauseControl adminKey={adminKey} />
      <TreasuryPanel />
    </>
  );
}
