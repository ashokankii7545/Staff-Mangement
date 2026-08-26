import { ValidationError } from '../../shared/errors/app.errors.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { notificationService } from '../notification/notification.service.js';
import { notificationRepository } from '../notification/notification.repository.js';
import type { MedicineRequestDocument } from './medicine.model.js';
import { medicineRepository } from './medicine.repository.js';

export interface MedicineRequestInputShape {
  medicineName: string;
  strength?: string;
  quantity: number;
  unit?: string;
  urgency?: string;
  notes?: string;
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

  public listAll(status?: string): Promise<MedicineRequestDocument[]> {
    return medicineRepository.queries.listAll(status);
  }

  /** Staff flags a missing / short medicine → lands in the admin's inbox. */
  public async request(
    input: MedicineRequestInputShape,
    requesterId: string,
  ): Promise<MedicineRequestDocument> {
    const medicineName = String(input.medicineName || '').trim();
    const quantity = Number(input.quantity);
    if (!medicineName) throw new ValidationError('Medicine name is required.');
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new ValidationError('Quantity must be at least 1.');
    }

    const request = await medicineRepository.queries.create({
      requestedBy: requesterId as never,
      medicineName,
      strength: String(input.strength || '').trim(),
      quantity,
      unit: input.unit || 'Strips',
      urgency: ['LOW', 'NORMAL', 'URGENT'].includes(input.urgency ?? '') ? input.urgency! : 'NORMAL',
      notes: String(input.notes || '').trim(),
      status: 'PENDING',
    });
    await request.populate('requestedBy');
    const staffName = (request.requestedBy as unknown as { name: string })?.name;

    // In-app notification to all admins (requester included if they are an admin).
    await notificationService.push({
      type: 'MEDICINE_REQUEST',
      adminBroadcast: true,
      title: `Stock needed: ${request.medicineName}`,
      message: `${staffName} needs ${request.quantity} ${String(request.unit).toLowerCase()} of ${request.medicineName}${request.strength ? ` (${request.strength})` : ''}`,
      link: '/stock',
      meta: { medicineRequestId: String(request._id) },
    });

    // Branded alert email to admins (fire-and-forget).
    void mailService.sendStockRequestEmail(request).catch(() => undefined);

    return request;
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

    request.status = status as MedicineRequestDocument['status'];
    request.adminFeedback = adminFeedback ?? '';
    request.handledBy = handler.id as never;
    await request.save();
    await request.populate(['requestedBy', 'handledBy']);

    // Close the original request notification in every admin's inbox.
    await notificationRepository.queries.closeMetaNotifications(
      'MEDICINE_REQUEST',
      'medicineRequestId',
      String(request._id),
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
          },
        )
        .catch(() => undefined);
    }

    return request;
  }
}

export const medicineService = MedicineService.getInstance();
