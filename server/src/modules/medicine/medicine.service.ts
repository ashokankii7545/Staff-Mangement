import { ValidationError } from '../../shared/errors/app.errors.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { notificationService } from '../notification/notification.service.js';
import { notificationRepository } from '../notification/notification.repository.js';
import { saveBase64MedicineImage } from '../../shared/utils/file-upload.util.js';
import type { MedicineRequestDocument } from './medicine.model.js';
import { medicineRepository } from './medicine.repository.js';
import {
  MedicineCatalogRepository,
  medicineCatalogRepository,
} from './medicine.catalog.repository.js';
import type {
  IMedicineCatalog,
  MedicineCatalogDocument,
} from './medicine.catalog.model.js';

export interface MedicineRequestInputShape {
  medicineName?: string;
  /** Set when staff picks an existing catalogue entry instead of typing. */
  catalogMedicineId?: string;
  strength?: string;
  quantity: number;
  unit?: string;
  urgency?: string;
  notes?: string;
}

export interface MedicineCatalogInputShape {
  /** Brand / trade name, e.g. "Dolo 650" */
  name: string;
  /** Generic / salt composition, e.g. "Paracetamol 650mg" */
  genericName?: string;
  /** Manufacturer, e.g. "Micro Labs Ltd" */
  manufacturer?: string;
  /** Dosage form: Tablet, Capsule, Syrup… */
  dosageForm?: string;
  /** e.g. "650mg" */
  strength?: string;
  /** Packing, e.g. "Strip of 15 tablets" */
  packSize?: string;
  /** Therapeutic class */
  category?: string;
  /** OTC | H | H1 | X (Drugs & Cosmetics Act schedule) */
  schedule?: string;
  /** Uses / indication */
  uses?: string;
  /** WHEN to give, e.g. "1-0-1 after food" */
  dosageTiming?: string;
  /** HOW to give, e.g. "Swallow whole with water" */
  directionsForUse?: string;
  /** e.g. "Store below 25°C" */
  storage?: string;
  /** Side effects / warnings */
  sideEffects?: string;
  /** Optional base64 data-URI pack photo (JPG/PNG/WebP ≤3 MB). */
  imageBase64?: string | null;
  /** Selling rate per unit (MRP incl. tax) – billing uses this; never shown to staff */
  price: number;
  /** Purchase/cost rate per unit (optional) */
  purchaseRate?: number;
  /** GST slab: 0 | 5 | 12 */
  gstRate?: number;
  isActive?: boolean;
}

const STATUS_PILL: Record<string, { label: string; tone: 'success' | 'error' | 'info' }> = {
  ORDERED: { label: 'ORDERED', tone: 'info' },
  SUPPLIED: { label: 'SUPPLIED', tone: 'success' },
  REJECTED: { label: 'REJECTED', tone: 'error' },
};

/**
 * MedicineService – SINGLETON for the pharmacy stock-request workflow.
 */
class MedicineService {
  private static instance: MedicineService | null = null;

  private constructor() {}

  public static getInstance(): MedicineService {
    if (!MedicineService.instance) {
      MedicineService.instance = new MedicineService();
    }
    return MedicineService.instance;
  }

  public listMine(userId: string): Promise<MedicineRequestDocument[]> {
    return medicineRepository.queries.listMine(userId);
  }

  /**
   * Staff cancels their OWN request – only while still PENDING (once the owner
   * has ordered/supplied/rejected it, it's out of the staff member's hands).
   * Also closes the admins' "new request" notification so it leaves their inbox.
   */
  public async cancelMine(id: string, ownerId: string): Promise<boolean> {
    const request = await medicineRepository.queries.findById(id);
    if (!request) throw new ValidationError('Request not found.');
    if (String(request.requestedBy) !== String(ownerId)) {
      throw new ValidationError('You can only cancel your own requests.');
    }
    if (request.status !== 'PENDING') {
      throw new ValidationError('Only pending requests can be cancelled.');
    }
    await medicineRepository.queries.deleteById(id);
    await notificationRepository.queries.closeMetaNotifications(
      'MEDICINE_REQUEST',
      'medicineRequestId',
      String(request._id),
    );
    return true;
  }

  public listAll(status?: string): Promise<MedicineRequestDocument[]> {
    return medicineRepository.queries.listAll(status);
  }

  /** Staff flags a missing / short medicine → lands in the admin's inbox. */
  public async request(
    input: MedicineRequestInputShape,
    requesterId: string,
  ): Promise<MedicineRequestDocument> {
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new ValidationError('Quantity must be at least 1.');
    }

    // ── Resolve against the master catalogue ────────────────────────────────
    // 1. Explicit pick from the searchable list (staff selected an option).
    let linked: MedicineCatalogDocument | null = null;
    if (input.catalogMedicineId) {
      linked = await medicineCatalogRepository.queries.findById(String(input.catalogMedicineId));
      if (!linked || !linked.isActive) {
        throw new ValidationError('Selected medicine is no longer available in the catalogue.');
      }
    }

    const typedName = String(input.medicineName || '').trim();

    // 2. Free-typed name – silently link when the owner already stocks it.
    if (!linked && typedName) {
      linked = await medicineCatalogRepository.queries.findByNameExact(typedName);
      if (linked && !linked.isActive) linked = null;
    }

    if (!linked && !typedName) {
      throw new ValidationError('Select a medicine from the list or type its name.');
    }

    const isNewMedicine = !linked;

    const created = await medicineRepository.queries.create({
      requestedBy: requesterId as never,
      medicineName: linked ? linked.name : typedName,
      strength: String(input.strength || '').trim() || linked?.strength || '',
      quantity,
      unit: input.unit || 'Strips',
      urgency: ['LOW', 'NORMAL', 'URGENT'].includes(input.urgency ?? '') ? input.urgency! : 'NORMAL',
      notes: String(input.notes || '').trim(),
      status: 'PENDING',
      catalogMedicine: (linked?._id ?? null) as never,
      isNewMedicine,
    });
    const request =
      (await medicineRepository.queries.findByIdPopulatedRequestedBy(String(created._id))) ?? created;
    const staffName = (request.requestedBy as unknown as { name: string })?.name;

    // In-app notification to all admins (requester included if they are an admin).
    await notificationService.push({
      type: 'MEDICINE_REQUEST',
      adminBroadcast: true,
      title: isNewMedicine
        ? `🆕 New medicine requested: ${request.medicineName}`
        : `Stock needed: ${request.medicineName}`,
      message: isNewMedicine
        ? `${staffName} needs ${request.quantity} ${String(request.unit).toLowerCase()} of "${request.medicineName}" – this medicine is NOT in your catalogue yet. Add it from the Medicine Catalog.`
        : `${staffName} needs ${request.quantity} ${String(request.unit).toLowerCase()} of ${request.medicineName}${request.strength ? ` (${request.strength})` : ''}`,
      link: '/stock',
      meta: { medicineRequestId: String(request._id), isNewMedicine },
    });

    // Branded alert email to admins (fire-and-forget).
    void mailService.sendStockRequestEmail(request).catch(() => undefined);

    return request;
  }

  // ── MASTER MEDICINE CATALOGUE (admin-managed) ────────────────────────────

  /** Active list for staff autocomplete; admins may include deactivated rows. */
  public listMedicines(
    search: string | undefined,
    includeInactive: boolean,
    viewerIsAdmin: boolean,
  ): Promise<MedicineCatalogDocument[]> {
    if (viewerIsAdmin) {
      return search
        ? medicineCatalogRepository.queries.search(search)
        : medicineCatalogRepository.queries.listAll(includeInactive);
    }
    // Staff only ever see active entries.
    return medicineCatalogRepository.queries.search(search);
  }

  /** Admin grid – server-side paginated + searchable catalogue. */
  public listMedicinesPaginated(
    pagination: { page?: number; limit?: number; search?: string } | undefined,
    includeInactive: boolean,
  ) {
    return medicineCatalogRepository.queries.listPaginated(pagination ?? {}, includeInactive);
  }

  /** Admin adds a medicine to the master catalogue. */
  public async createMedicine(
    input: MedicineCatalogInputShape,
    adminId: string,
  ): Promise<MedicineCatalogDocument> {
    const patch = this.normalizeCatalogPatch(input, true);

    const duplicate = await medicineCatalogRepository.queries.findByNameExact(patch.name!);
    if (duplicate) {
      throw new ValidationError(`"${duplicate.name}" already exists in your medicine catalogue.`);
    }

    const doc = await medicineCatalogRepository.queries.create({
      ...patch,
      createdBy: adminId,
    } as Partial<IMedicineCatalog> & { createdBy: string });

    return this.attachImage(doc, input.imageBase64);
  }

  /** Admin edits a catalogue entry (image replaced only when a new one is sent). */
  public async updateMedicine(
    id: string,
    input: MedicineCatalogInputShape,
  ): Promise<MedicineCatalogDocument> {
    const existing = await medicineCatalogRepository.queries.findById(id);
    if (!existing) throw new ValidationError('Medicine not found.');

    const patch = this.normalizeCatalogPatch(input, false);
    if (patch.name) {
      const duplicate = await medicineCatalogRepository.queries.findByNameExact(patch.name);
      if (duplicate && String(duplicate._id) !== String(id)) {
        throw new ValidationError(`"${duplicate.name}" already exists in your medicine catalogue.`);
      }
    }

    let updated = await medicineCatalogRepository.queries.update(id, patch);
    if (!updated) throw new ValidationError('Medicine not found.');

    if (input.imageBase64) {
      updated = await this.attachImage(updated, input.imageBase64);
    }
    return updated;
  }

  /** Soft delete – keeps history intact but hides it from staff search. */
  public async removeMedicine(id: string): Promise<boolean> {
    const existing = await medicineCatalogRepository.queries.findById(id);
    if (!existing) throw new ValidationError('Medicine not found.');
    await medicineCatalogRepository.deactivate(id);
    return true;
  }

  /** Re-activate a previously removed medicine. */
  public async restoreMedicine(id: string): Promise<MedicineCatalogDocument> {
    const doc = await medicineCatalogRepository.queries.update(id, { isActive: true });
    if (!doc) throw new ValidationError('Medicine not found.');
    return doc;
  }

  // ── catalogue helpers ─────────────────────────────────────────────────────

  private normalizeCatalogPatch(
    input: MedicineCatalogInputShape,
    isCreate: boolean,
  ): Partial<IMedicineCatalog> {
    const name = MedicineCatalogRepository.assertName(input.name);
    const price = Number(input.price);
    if ((isCreate || input.price !== undefined) && (!Number.isFinite(price) || price < 0)) {
      throw new ValidationError('Price must be 0 or more.');
    }
    const purchaseRate = Number(input.purchaseRate);
    if (
      input.purchaseRate !== undefined &&
      input.purchaseRate !== null &&
      (!Number.isFinite(purchaseRate) || purchaseRate < 0)
    ) {
      throw new ValidationError('Purchase rate must be 0 or more.');
    }
    const gstRate = Number(input.gstRate);
    if (input.gstRate !== undefined && ![0, 5, 12].includes(gstRate)) {
      throw new ValidationError('GST rate must be 0, 5 or 12.');
    }

    const patch: Partial<IMedicineCatalog> = { name };
    const str = (v: unknown) => String(v ?? '').trim();
    if (input.genericName !== undefined) patch.genericName = str(input.genericName);
    if (input.manufacturer !== undefined) patch.manufacturer = str(input.manufacturer);
    if (input.dosageForm !== undefined) patch.dosageForm = str(input.dosageForm);
    if (input.strength !== undefined) patch.strength = str(input.strength);
    if (input.packSize !== undefined) patch.packSize = str(input.packSize);
    if (input.category !== undefined) patch.category = str(input.category);
    if (input.schedule !== undefined) patch.schedule = str(input.schedule) || 'OTC';
    if (input.uses !== undefined) patch.uses = str(input.uses);
    if (input.dosageTiming !== undefined) patch.dosageTiming = str(input.dosageTiming);
    if (input.directionsForUse !== undefined) patch.directionsForUse = str(input.directionsForUse);
    if (input.storage !== undefined) patch.storage = str(input.storage);
    if (input.sideEffects !== undefined) patch.sideEffects = str(input.sideEffects);
    if (Number.isFinite(price) && input.price !== undefined) patch.price = price;
    if (Number.isFinite(purchaseRate) && input.purchaseRate !== undefined) {
      patch.purchaseRate = purchaseRate;
    }
    if (input.gstRate !== undefined && [0, 5, 12].includes(gstRate)) patch.gstRate = gstRate;
    if (typeof input.isActive === 'boolean') patch.isActive = input.isActive;
    return patch;
  }

  /** Persist an uploaded photo under a stable per-medicine filename. */
  private async attachImage(
    doc: MedicineCatalogDocument,
    imageBase64?: string | null,
  ): Promise<MedicineCatalogDocument> {
    if (!imageBase64) return doc;
    const url = await saveBase64MedicineImage(imageBase64, `med_${String(doc._id)}`);
    const updated = await medicineCatalogRepository.queries.update(String(doc._id), { image: url });
    return updated ?? { ...doc, image: url };
  }

  /** Admin moves a request through ORDERED → SUPPLIED (or REJECTS it). */
  public async review(
    id: string,
    status: string,
    adminFeedback: string | null | undefined,
    handler: { id: string },
  ): Promise<MedicineRequestDocument> {
    const allowed = ['PENDING', 'ORDERED', 'SUPPLIED', 'REJECTED'];
    if (!allowed.includes(status)) {
      throw new ValidationError(`Invalid status "${status}".`);
    }

    const request = await medicineRepository.queries.findByIdPopulatedRequestedBy(id);
    if (!request) throw new ValidationError('Medicine request not found');

    const updatedRequest =
      (await medicineRepository.queries.updateById(String(request._id), {
        status: status as MedicineRequestDocument['status'],
        adminFeedback: adminFeedback ?? '',
        handledBy: handler.id,
      })) ?? request;

    // Close the original request notification in every admin's inbox.
    await notificationRepository.queries.closeMetaNotifications(
      'MEDICINE_REQUEST',
      'medicineRequestId',
      String(updatedRequest._id),
    );

    const requester = request.requestedBy as unknown as { _id: unknown; name?: string; email?: string };
    const medicineName = String(request.medicineName);

    // Self-handled guard – reviewer never pings themselves.
    const isSelf = String(requester._id) === String(handler.id);

    if (!isSelf && status !== 'PENDING') {
      await notificationService.push({
        recipientIds: [String(requester._id)],
        type: 'MEDICINE_DECISION',
        title:
          status === 'SUPPLIED'
            ? `${medicineName} supplied`
            : status === 'ORDERED'
              ? `${medicineName} ordered`
              : `${medicineName} request rejected`,
        message: adminFeedback || `Status updated to ${status}.`,
        link: '/stock',
        meta: { medicineRequestId: String(request._id) },
      });

      void mailService
        .sendUserUpdateEmail(
          { email: requester.email, name: requester.name },
          {
            subject:
              status === 'SUPPLIED'
                ? `Stock update: ${medicineName} has been supplied`
                : status === 'ORDERED'
                  ? `Stock update: ${medicineName} has been ordered`
                  : `Stock update: ${medicineName} request was not approved`,
            heading:
              status === 'SUPPLIED'
                ? 'Medicine Supplied'
                : status === 'ORDERED'
                  ? 'Medicine Ordered'
                  : 'Request Rejected',
            pill: STATUS_PILL[status] ?? null,
            introText:
              status === 'SUPPLIED'
                ? 'Good news - the requested medicine has been supplied to the shop and should now be available on the counter.'
                : status === 'ORDERED'
                  ? 'The requested medicine has been ordered from the distributor and will reach the shop shortly.'
                  : 'Your stock request could not be approved at this time.',
            lines: [
              `<strong>Medicine:</strong> <strong>${medicineName}</strong>${request.strength ? ` · ${request.strength}` : ''}`,
              `<strong>Quantity:</strong> ${request.quantity} ${request.unit}`,
              ...(adminFeedback ? [`<strong>Note From Owner:</strong> ${adminFeedback}`] : []),
            ],
            buttonText: 'View Stock Requests',
            buttonPath: '/stock',
          },
        )
        .catch(() => undefined);
    }

    return updatedRequest;
  }
}

export const medicineService = MedicineService.getInstance();
