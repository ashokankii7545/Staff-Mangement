import type { WithId } from '../../shared/repository/base-repository.js';
import type { SettingsRow } from '../../db/schema/settings.schema.js';

/** Settings sub-object shapes (jsonb columns). */
export interface IEmailNotificationPrefs {
  userUpdates: boolean;
  broadcasts: boolean;
  adminAlerts: boolean;
}
export interface ILeavePolicy {
  casualPerMonth: number;
  sickAnnual: number;
  earnedAnnual: number;
}
export interface IAccrualState {
  lastMonthlyCL: string;
  lastAnnualSL: string;
  lastAnnualEL: string;
}

/** Plain column shape of the settings row. */
export interface ISettings {
  organizationName: string;
  officeLatitude: number;
  officeLongitude: number;
  officeName: string;
  geofenceRadius: number;
  shiftStartTime: string;
  shiftEndTime: string;
  lateThresholdMinutes: number;
  workingDays: string[];
  vpnStrictMode: boolean;
  regularizationAutoApproveDays: number;
  autoApproveAttendance: boolean;
  emailNotifications: IEmailNotificationPrefs;
  leavePolicy: ILeavePolicy;
  accrualState: IAccrualState;
  mailFromName: string;
  mailFromAddress: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SettingsDocument = WithId<SettingsRow>;
