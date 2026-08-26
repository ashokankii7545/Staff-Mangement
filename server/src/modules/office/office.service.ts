import { NotFoundError, ValidationError } from '../../shared/errors/app.errors.js';
import { mailService } from '../../shared/mail/mail.service.js';
import type { OfficeDocument } from './office.model.js';
import { officeRepository } from './office.repository.js';

/**
 * OfficeService – SINGLETON for site/branch management.
 */
class OfficeService {
  private static instance: OfficeService | null = null;

  private constructor() {}

  public static getInstance(): OfficeService {
    if (!OfficeService.instance) {
      OfficeService.instance = new OfficeService();
    }
    return OfficeService.instance;
  }

  public listActive(): Promise<OfficeDocument[]> {
    return officeRepository.queries.listActive();
  }

  public getById(id: string): Promise<OfficeDocument | null> {
    return officeRepository.queries.findById(id);
  }

  public async create(input: Partial<OfficeDocument>): Promise<OfficeDocument> {
    const office = await officeRepository.queries.create(input);
    // Every site change is an org-level update – email all admins.
    void mailService.sendOfficeChangeEmail({ action: 'added', office }).catch((e) => console.error(e));
    return office;
  }

  public async update(id: string, input: Partial<OfficeDocument>): Promise<OfficeDocument> {
    const office = await officeRepository.queries.updateById(id, input);
    if (!office) throw new NotFoundError('Office not found');
    void mailService.sendOfficeChangeEmail({ action: 'updated', office }).catch((e) => console.error(e));
    return office;
  }

  public async softDelete(id: string): Promise<boolean> {
    const office = await officeRepository.queries.softDelete(id);
    if (office) {
      void mailService.sendOfficeChangeEmail({ action: 'deleted', office }).catch((e) => console.error(e));
    }
    return true;
  }
}

export const officeService = OfficeService.getInstance();
