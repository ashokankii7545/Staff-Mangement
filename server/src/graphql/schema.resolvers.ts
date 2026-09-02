import { authResolvers } from '../modules/auth/auth.resolver.js';
import { userResolvers } from '../modules/user/user.resolver.js';
import { attendanceResolvers } from '../modules/attendance/attendance.resolver.js';
import { officeResolvers } from '../modules/office/office.resolver.js';
import { holidayResolvers } from '../modules/holiday/holiday.resolver.js';
import { settingsResolvers } from '../modules/settings/settings.resolver.js';
import { leaveResolvers } from '../modules/leave/leave.resolver.js';
import { regularizationResolvers } from '../modules/regularization/regularization.resolver.js';
import { notificationResolvers } from '../modules/notification/notification.resolver.js';
import { medicineResolvers } from '../modules/medicine/medicine.resolver.js';
import { documentResolvers } from '../modules/document/document.resolver.js';
import { webauthnResolvers } from '../modules/webauthn/webauthn.resolver.js';
import { customScalars } from '../shared/graphql/scalars.js';

type ResolverSet = Record<string, Record<string, any>>;

/** Deep-merge several module resolver maps into one executable map. */
const mergeResolvers = (...resolverSets: ResolverSet[]): ResolverSet => {
  const merged: ResolverSet = {};
  for (const set of resolverSets) {
    for (const [typeName, fields] of Object.entries(set)) {
      if (!merged[typeName]) merged[typeName] = {};
      Object.assign(merged[typeName], fields);
    }
  }
  return merged;
};

export const resolvers = mergeResolvers(
  customScalars as unknown as ResolverSet[string],
  authResolvers,
  userResolvers,
  attendanceResolvers,
  officeResolvers,
  holidayResolvers,
  settingsResolvers,
  leaveResolvers,
  regularizationResolvers,
  notificationResolvers,
  medicineResolvers,
  documentResolvers,
  webauthnResolvers,
);
