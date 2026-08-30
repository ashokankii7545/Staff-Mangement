import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env.js';
import * as schema from '../db/schema/index.js';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DRIZZLE / POSTGRES CLIENT – SINGLETON
 * ────────────────────────────────────────────────────────────────────────────
 * One postgres.js connection pool + Drizzle wrapper for the whole process.
 *
 * Supabase notes:
 *  - The pooled ("Transaction") endpoint on port 6543 runs pgbouncer, which is
 *    incompatible with prepared statements (`prepare:false`). The direct
 *    (:5432) endpoint supports them, so `prepare` is enabled there for the
 *    extra per-query speed.
 *  - `DATABASE_SSL=no-verify` relaxes certificate verification (Supabase serves
 *    a cert chain some environments don't trust out of the box).
 */

const buildSslOption = (): postgres.Options<Record<string, never>>['ssl'] => {
  const mode = env.databaseSsl;
  if (!mode) return undefined;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  if (mode === 'require' || mode === 'true') return 'require';
  return undefined;
};

const createClient = (): postgres.Sql => {
  const isDirect = /:\d*5432\//.test(env.databaseUrl) || env.databaseUrl.includes(':5432');
  return postgres(env.databaseUrl, {
    max: env.databasePoolMax,
    // pgbouncer (pooled :6543) cannot use prepared statements; the direct
    // (:5432) endpoint supports them – only enable there.
    prepare: isDirect,
    ssl: buildSslOption(),
    // Keep connections warm between requests. A pooled connection used to be
    // dropped after 20s of idle, and re-establishing it cost a ~160ms TLS
    // handshake (~1.6s cold) on the remote Supabase cluster per request.
    idle_timeout: 0,
    // Recycle connections after 30 min so a long-idle (or laptop-sleep) socket
    // can't go stale and hang a query for an hour before erroring.
    max_lifetime: 60 * 30,
    // Fail fast if a NEW connection can't be established (dead network / sleep),
    // instead of blocking the caller indefinitely.
    connect_timeout: 15,
  });
};

/** Singleton wrapper so hot-reload / repeated imports reuse one pool. */
class DrizzleClient {
  private static instance: DrizzleClient | null = null;

  public readonly sql: postgres.Sql;

  public readonly db: PostgresJsDatabase<typeof schema>;

  private constructor() {
    this.sql = createClient();
    this.db = drizzle(this.sql, { schema });
  }

  public static getInstance(): DrizzleClient {
    if (!DrizzleClient.instance) {
      DrizzleClient.instance = new DrizzleClient();
    }
    return DrizzleClient.instance;
  }
}

const client = DrizzleClient.getInstance();

/** Drizzle query builder – import this everywhere data access happens. */
export const db = client.db;

/** Raw postgres.js handle – for health checks / graceful shutdown only. */
export const sql = client.sql;

/** Schema namespace re-export for convenience. */
export { schema };
