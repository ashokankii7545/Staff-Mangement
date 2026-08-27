import type { WithId } from '../../shared/repository/base-repository.js';
import type { AttendanceRow, PunchLocationJson, VpnCheckDetailsJson } from '../../db/schema/attendance.schema.js';
import type { PUNCH_TYPES, REVIEWABLE_STATUSES } from '../../config/constants.js';

/** Re-export the jsonb shapes under the module's historical names. */
export type IPunchLocation = PunchLocationJson;
export type IVpnCheckDetails = VpnCheckDetailsJson;

/** Attendance punch types – backed by Postgres/Drizzle. */
export interface IAttendance {
  user: string;
  punchedOffice?: string | null;
  isCoverDuty: boolean;
  type: (typeof PUNCH_TYPES)[number] | string;
  selfieUrl: string;
  location: IPunchLocation;
  ipAddress: string;
  vpnDetected: boolean;
  vpnCheckDetails?: IVpnCheckDetails | null;
  browserTimezone: string;
  date: string;
  approvalStatus: (typeof REVIEWABLE_STATUSES)[number] | string;
  approvedBy?: string | null;
  adminComments?: string | null;
  faceMatched?: boolean;
  faceMatchScore?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AttendanceDocument = WithId<AttendanceRow>;
