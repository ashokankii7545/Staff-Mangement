import type { WithId } from '../../shared/repository/base-repository.js';
import type { LeaveRequestRow } from '../../db/schema/leave.schema.js';
import type { APPROVAL_STATUSES, LEAVE_TYPES } from '../../config/constants.js';

/** Leave request types – backed by Postgres/Drizzle. */
export interface ILeaveRequest {
  user: string;
  leaveType: (typeof LEAVE_TYPES)[number] | string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: (typeof APPROVAL_STATUSES)[number] | string;
  adminFeedback?: string;
  approvedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LeaveRequestDocument = WithId<LeaveRequestRow>;
