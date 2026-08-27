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

  private constructor() {
    super(settingsTable);
  }

  public static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  private async first(): Promise<SettingsDocument | null> {
    const rows = await this.db.select().from(settingsTable).limit(1);
    return this.withId(rows[0] ?? null) as SettingsDocument | null;
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
        return this.qInsert({}) as Promise<SettingsDocument>;
      }),

    /** Persist markers after an accrual pass (merge into the accrualState jsonb). */
    updateAccrualState: (settingsId: string, markers: Record<string, string>): Promise<unknown> =>
      this.exec('updateAccrualState', () =>
        this.db
          .update(settingsTable)
          .set({
            // Shallow-merge the provided markers into the existing jsonb object.
            accrualState: sql`${settingsTable.accrualState} || ${JSON.stringify(markers)}::jsonb`,
            updatedAt: new Date(),
          })
          .where(sql`${settingsTable.id} = ${settingsId}`),
      ),

    /** Patch arbitrary settings columns (used by the admin settings form). */
    updateById: (id: string, patch: Partial<ISettings>): Promise<SettingsDocument | null> =>
      this.exec('updateById', () => this.qUpdateById(id, patch) as Promise<SettingsDocument | null>),
  };
}

export const settingsRepository = SettingsRepository.getInstance();
