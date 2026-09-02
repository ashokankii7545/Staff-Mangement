import { ValidationError } from '../../shared/errors/app.errors.js';
import { settingsRepository } from './settings.repository.js';
import { userRepository } from '../user/user.repository.js';
import type { SettingsDocument } from './settings.model.js';
import { saveBase64Image } from '../../shared/utils/file-upload.util.js';

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
    if (typeof input.appLogoBase64 === 'string') {
      const logoUrl = await saveBase64Image(input.appLogoBase64, `app-logo-${Date.now()}`);
      input.appLogo = logoUrl;
      delete input.appLogoBase64;
    }

    const current = await settingsRepository.queries.getOrCreate();
    const settings =
      (await settingsRepository.queries.updateById(String(current._id), input as never)) ?? current;
    // Org-level change – let every admin know something was touched.
    void import('../../shared/mail/mail.service.js').then(({ mailService }) =>
      mailService.sendSettingsChangeEmail(adminName),
    );

    // FINGERPRINT / BOTH mode: every staff who has NOT enrolled a fingerprint
    // gets an "Action Required: register your fingerprint" email right away,
    // exactly like the admin requested at hiring/setup time.
    if (input.attendanceMethod === 'FINGERPRINT' || input.attendanceMethod === 'BOTH') {
      void this.onboardFingerprintStaff();
    }
    return settings;
  }

  /** Fire-and-forget: email every active approved staff member without a passkey. */
  private async onboardFingerprintStaff(): Promise<void> {
    try {
      const { mailService } = await import('../../shared/mail/mail.service.js');
      const staff = await userRepository.queries.findUsersWithoutPasskeys();
      await Promise.allSettled(staff.map((u) => mailService.sendFingerprintReminderEmail(u)));
    } catch (error) {
      // Never block the settings save because an email failed.
      const { logger } = await import('../../shared/logger/logger.js');
      logger.error('Failed to send fingerprint onboarding emails', error);
    }
  }
}

export const settingsService = SettingsService.getInstance();
