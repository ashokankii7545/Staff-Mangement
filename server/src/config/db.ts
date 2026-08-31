import { sql } from './drizzle.js';
import { env } from './env.js';
import { logger } from '../shared/logger/logger.js';

/**
 * Database – SINGLETON lifecycle wrapper around the Postgres (postgres.js)
 * connection used by Drizzle. Keeps the same public surface the app already
 * relies on (`connect()` at boot, `disconnect()` on graceful shutdown) so the
 * server bootstrap is unchanged after the MongoDB → Supabase migration.
 */
class Database {
  private static instance: Database | null = null;

  private connected = false;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Verify connectivity once at boot AND pre-open a few pool connections.
   *
   * postgres.js creates connections lazily, so a fresh boot used to leave the
   * pool almost empty. The very first page-load fires 4-8 queries in parallel
   * and every one of them paid a full TCP + TLS handshake (~1.8s cold / ~0.4s
   * warm) to the remote Supabase cluster on-demand – that single burst was the
   * "first request is 2+ seconds" slowness. Opening a handful of connections
   * here – before the HTTP server starts accepting traffic – moves that cost
   * into startup so the first real request reuses warm sockets.
   * `idle_timeout: 0` (drizzle.ts) then keeps them available indefinitely.
   */
  public async connect(): Promise<void> {
    if (this.connected) return;
    try {
      const warmCount = Math.min(Math.max(1, env.databasePoolMax || 10), 8);
      const results = await Promise.allSettled(
        Array.from({ length: warmCount }, () => sql`SELECT 1`),
      );
      // Fail fast if NOT A SINGLE pool connection could be established.
      const anyOk = results.some((r) => r.status === 'fulfilled');
      if (!anyOk) {
        const firstError = results.find((r) => r.status === 'rejected');
        throw firstError ? (firstError as PromiseRejectedResult).reason : new Error('connect failed');
      }
      this.connected = true;
      logger.info(`Postgres (Supabase) connected – pool warmed with ${warmCount} connection(s)`);
    } catch (error) {
      logger.error('Postgres initial connection failed', error as Error);
      process.exit(1);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.connected) return;
    await sql.end({ timeout: 5 });
    this.connected = false;
    logger.info('Postgres connection closed');
  }
}

export const database = Database.getInstance();
