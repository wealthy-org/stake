import dns from "node:dns";
import pg from "pg";
const { Pool } = pg;
type Pool = pg.Pool;

// Node's "happy eyeballs" dual-stack resolution can race an IPv6 route to
// Neon that's slow or blackholed on this network before falling back to
// IPv4 — that race is exactly what made every query hang until the
// client-side timeout, even though a fresh one-off script (same host,
// same DNS) connected instantly moments apart. Forcing IPv4 first removes
// the race.
dns.setDefaultResultOrder("ipv4first");

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Point it at your NeonDB connection string.");
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
      // Neon (and most serverless Postgres) closes idle connections from
      // its side without warning. Without these, a client sitting on a
      // socket Neon already dropped just hangs forever on the next query
      // instead of erroring — that's what made every DB route stall for
      // 40-50s before failing.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      query_timeout: 15_000,
      statement_timeout: 15_000,
      max: 10,
    });
    // An idle client whose socket died server-side emits 'error' instead of
    // throwing where anyone can catch it. Without this handler, that crashes
    // the whole Node process (unhandled 'error' event on EventEmitter).
    pool.on("error", (err) => {
      console.error("[db] idle client error (connection dropped, pool will reconnect):", err.message);
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const { rows } = await getPool().query(text, params);
  return rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
