import { makeExecutableSchema } from '@graphql-tools/schema';
import type { IResolvers } from '@graphql-tools/utils';
import { commonTypes } from '../shared/graphql/common.types.js';
import { officeTypes } from '../modules/office/office.types.js';
import { userTypes } from '../modules/user/user.types.js';
import { authTypes } from '../modules/auth/auth.types.js';
import { attendanceTypes } from '../modules/attendance/attendance.types.js';
import { settingsTypes } from '../modules/settings/settings.types.js';
import { holidayTypes } from '../modules/holiday/holiday.types.js';
import { leaveTypes } from '../modules/leave/leave.types.js';
import { medicineTypes } from '../modules/medicine/medicine.types.js';
import { documentTypes } from '../modules/document/document.types.js';
import { regularizationTypes } from '../modules/regularization/regularization.types.js';
import { notificationTypes } from '../modules/notification/notification.types.js';
import { webauthnTypes } from '../modules/webauthn/webauthn.types.js';
import { rootTypes } from './root.types.js';
import { resolvers } from './schema.resolvers.js';

/**
 * Executable GraphQL schema – SDL is assembled module-by-module so every
 * feature owns its own type definitions. `makeExecutableSchema` merges
 * repeated definitions across the array safely.
 */
export const schema = makeExecutableSchema({
  typeDefs: [
    commonTypes,
    officeTypes,
    userTypes,
    authTypes,
    attendanceTypes,
    settingsTypes,
    holidayTypes,
    leaveTypes,
    medicineTypes,
    documentTypes,
    regularizationTypes,
    notificationTypes,
    webauthnTypes,
    rootTypes,
  ],
  resolvers: resolvers as IResolvers,
});
