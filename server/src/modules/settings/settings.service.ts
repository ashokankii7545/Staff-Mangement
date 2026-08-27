import { ValidationError } from '../../shared/errors/app.errors.js';
import { settingsRepository } from './settings.repository.js';
import type { SettingsDocument } from './settings.model.js';

/**
 * SettingsService – SINGLETON for org-wide configuration.
 */
class SettingsService {
  private static instance: SettingsService | null = null;

  private constructor() {}

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /** Always returns a row – lazily creates defaults on first read. */
  public getOrCreate(): Promise<SettingsDocument> {
    return settingsRepository.queries.getOrCreate();
  }

  public async update(
    input: Record<string, unknown>,
    adminName: string,
  ): Promise<SettingsDocument> {
    const current = await settingsRepository.queries.getOrCreate();
    const settings =
      (await settingsRepository.queries.updateById(String(current._id), input as never)) ?? current;
    // Org-level change – let every admin know something was touched.
    void import('../../shared/mail/mail.service.js').then(({ mailService }) =>
      mailService.sendSettingsChangeEmail(adminName),
    );
    return settings;
  }
}

export const settingsService = SettingsService.getInstance();
