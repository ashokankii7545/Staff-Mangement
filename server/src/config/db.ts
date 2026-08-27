import { sql } from './drizzle.js';
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

  /** Verify connectivity once at boot (postgres.js connects lazily/pools). */
  public async connect(): Promise<void> {
    if (this.connected) return;
    try {
      await sql`SELECT 1`;
      this.connected = true;
      logger.info('Postgres (Supabase) connected');
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
