import { describe, it, expect } from 'vitest';
import { settingsRepository } from './settings.repository.js';

/**
 * Settings is a single-row table. These tests operate on that shared row
 * (created lazily), so they do not delete it afterward.
 */
describe('SettingsRepository (Postgres)', () => {
  it('getOrCreate returns a row with defaults and jsonb sub-objects', async () => {
    const s = await settingsRepository.queries.getOrCreate();
    expect(s._id).toBeTruthy();
    expect(s.leavePolicy).toMatchObject({ casualPerMonth: expect.any(Number) });
    expect(s.accrualState).toHaveProperty('lastMonthlyCL');
    expect(Array.isArray(s.workingDays)).toBe(true);
  });

  it('findFirst returns the same singleton row', async () => {
    const a = await settingsRepository.queries.getOrCreate();
    const b = await settingsRepository.queries.findFirst();
    expect(b?._id).toBe(a._id);
  });

  it('updateAccrualState merges markers into the accrualState jsonb', async () => {
    const s = await settingsRepository.queries.getOrCreate();
    const marker = new Date().toISOString().slice(0, 7); // YYYY-MM
    await settingsRepository.queries.updateAccrualState(String(s._id), { lastMonthlyCL: marker });
    const after = await settingsRepository.queries.findFirst();
    expect(after?.accrualState.lastMonthlyCL).toBe(marker);
    // Other markers must remain intact (shallow merge, not overwrite).
    expect(after?.accrualState).toHaveProperty('lastAnnualSL');
  });

  it('updateById patches scalar columns', async () => {
    const s = await settingsRepository.queries.getOrCreate();
    const updated = await settingsRepository.queries.updateById(String(s._id), { geofenceRadius: 275 });
    expect(updated?.geofenceRadius).toBe(275);
  });
});
