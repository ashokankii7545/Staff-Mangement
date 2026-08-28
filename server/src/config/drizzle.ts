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
 *    incompatible with prepared statements, so we disable them (`prepare:false`).
 *    This is harmless on the direct (5432) endpoint too, so we keep it always
 *    off for portability across both connection strings.
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
    // pgbouncer (pooled mode) cannot use prepared statements.
    prepare: false,
    ssl: buildSslOption(),
    // Idle timeout keeps serverless functions from holding connections open.
    idle_timeout: isDirect ? 0 : 20,
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
