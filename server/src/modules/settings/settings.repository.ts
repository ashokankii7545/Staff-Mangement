import { sql } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { settings as settingsTable } from '../../db/schema/settings.schema.js';
import type { ISettings, SettingsDocument } from './settings.model.js';

/**
 * SettingsRepository – single-row org configuration store (Postgres/Drizzle).
 * `getOrCreate` guarantees a row exists before any policy read.
 */
export class SettingsRepository extends BaseRepository<typeof settingsTable> {
  private static instance: SettingsRepository | null = null;

  /** Short-TTL cache for the singleton org-config row (see `first()` below). */
  private static readonly CACHE_TTL_MS = 15_000;
  private cached: { data: SettingsDocument | null; at: number } | null = null;

  private constructor() {
    super(settingsTable);
  }

  public static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  private invalidateCache(): void {
    this.cached = null;
  }

  /**
   * Read the singleton org-config row, served from a 15s in-process cache when
   * fresh. `findFirstLean` is the hottest read in the app – every punch,
   * history/dashboard render and policy job used to pay one full DB round-trip
   * (~160ms against the remote Supabase cluster) for the same single row.
   * Every write path below invalidates the cache, so admin settings edits are
   * picked up immediately.
   */
  private async first(): Promise<SettingsDocument | null> {
    if (this.cached && Date.now() - this.cached.at < SettingsRepository.CACHE_TTL_MS) {
      return this.cached.data;
    }
    const rows = await this.db.select().from(settingsTable).limit(1);
    const row = this.withId(rows[0] ?? null) as SettingsDocument | null;
    this.cached = { data: row, at: Date.now() };
    return row;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    findFirst: (): Promise<SettingsDocument | null> =>
      this.exec('findFirst', () => this.first()),

    /** Kept for API parity – returns the plain row (no _id difference here). */
    findFirstLean: (): Promise<ISettings | null> =>
      this.exec('findFirstLean', () => this.first() as Promise<ISettings | null>),

    /** Returns the singleton settings row, creating defaults on first touch. */
    getOrCreate: (): Promise<SettingsDocument> =>
      this.exec('getOrCreate', async () => {
        const existing = await this.first();
        if (existing) return existing;
        this.invalidateCache();
        return this.qInsert({}) as Promise<SettingsDocument>;
      }),

    /** Persist markers after an accrual pass (merge into the accrualState jsonb). */
    updateAccrualState: (settingsId: string, markers: Record<string, string>): Promise<unknown> =>
      this.exec('updateAccrualState', async () => {
        const result = await this.db
          .update(settingsTable)
          .set({
            // Shallow-merge the provided markers into the existing jsonb object.
            accrualState: sql`${settingsTable.accrualState} || ${JSON.stringify(markers)}::jsonb`,
            updatedAt: new Date(),
          })
          .where(sql`${settingsTable.id} = ${settingsId}`);
        this.invalidateCache();
        return result;
      }),

    /** Patch arbitrary settings columns (used by the admin settings form). */
    updateById: (id: string, patch: Partial<ISettings>): Promise<SettingsDocument | null> =>
      this.exec('updateById', async () => {
        const result = await this.qUpdateById(id, patch) as Promise<SettingsDocument | null>;
        this.invalidateCache();
        return result;
      }),
  };
}

export const settingsRepository = SettingsRepository.getInstance();
