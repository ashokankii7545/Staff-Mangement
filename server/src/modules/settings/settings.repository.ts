import { BaseRepository } from '../../shared/repository/base-repository.js';
import { SettingsModel, type ISettings, type SettingsDocument } from './settings.model.js';

/**
 * SettingsRepository – single-row org configuration store.
 * `getOrCreate` guarantees a document exists before any policy read.
 */
export class SettingsRepository extends BaseRepository<ISettings> {
  private static instance: SettingsRepository | null = null;

  private constructor() {
    super(SettingsModel);
  }

  public static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    findFirst: (): Promise<SettingsDocument | null> =>
      this.exec('findFirst', () => this.qFindOne({}) as Promise<SettingsDocument | null>),

    findFirstLean: (): Promise<ISettings | null> =>
      this.exec('findFirstLean', () =>
        SettingsModel.findOne().lean<ISettings | null>(),
      ),

    /** Returns the singleton settings row, creating defaults on first touch. */
    getOrCreate: (): Promise<SettingsDocument> =>
      this.exec('getOrCreate', async () => {
        const existing = await SettingsModel.findOne();
        return existing ?? ((await SettingsModel.create({})) as SettingsDocument);
      }),

    /** Persist markers after an accrual pass (partial dot-path updates). */
    updateAccrualState: (
      settingsId: string,
      markers: Record<string, string>,
    ): Promise<unknown> =>
      this.exec('updateAccrualState', () =>
        SettingsModel.updateOne(
          { _id: settingsId },
          {
            $set: Object.fromEntries(
              Object.entries(markers).map(([k, v]) => [`accrualState.${k}`, v]),
            ),
          },
        ),
      ),
  };
}

export const settingsRepository = SettingsRepository.getInstance();
