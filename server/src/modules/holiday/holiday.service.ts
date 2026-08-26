import { mailService } from '../../shared/mail/mail.service.js';
import type { HolidayDocument } from './holiday.model.js';
import { holidayRepository } from './holiday.repository.js';

/**
 * HolidayService – SINGLETON for the holiday calendar.
 */
class HolidayService {
  private static instance: HolidayService | null = null;

  private constructor() {}

  public static getInstance(): HolidayService {
    if (!HolidayService.instance) {
      HolidayService.instance = new HolidayService();
    }
    return HolidayService.instance;
  }

  public listByYear(year?: number): Promise<HolidayDocument[]> {
    return holidayRepository.queries.listByYear(year);
  }

  public async create(input: {
    name: string;
    date: Date;
    description?: string;
    type?: 'NATIONAL' | 'OPTIONAL';
  }): Promise<HolidayDocument> {
    const holiday = await holidayRepository.queries.create(input);
    void mailService.sendHolidayChangeEmail({ action: 'added', holiday }).catch((e) => console.error(e));
    return holiday;
  }

  public async delete(id: string): Promise<boolean> {
    const holiday = await holidayRepository.queries.deleteById(id);
    if (holiday) {
      void mailService.sendHolidayChangeEmail({ action: 'removed', holiday }).catch((e) => console.error(e));
    }
    return true;
  }
}

export const holidayService = HolidayService.getInstance();
