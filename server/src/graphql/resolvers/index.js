import authResolvers from './auth.resolvers.js';
import attendanceResolvers from './attendance.resolvers.js';
import userResolvers from './user.resolvers.js';
import settingsResolvers from './settings.resolvers.js';
import officeResolvers from './office.resolvers.js';
import holidayResolvers from './holiday.resolvers.js';
import leaveResolvers from './leave.resolvers.js';
import regularizationResolvers from './regularization.resolvers.js';
import notificationResolvers from './notification.resolvers.js';
import medicineResolvers from './medicine.resolvers.js';
import documentResolvers from './document.resolvers.js';

// Deep merge resolvers
const mergeResolvers = (...resolverSets) => {
  const merged = {};
  for (const resolvers of resolverSets) {
    for (const [type, fields] of Object.entries(resolvers)) {
      if (!merged[type]) merged[type] = {};
      Object.assign(merged[type], fields);
    }
  }
  return merged;
};

export default mergeResolvers(
  authResolvers,
  attendanceResolvers,
  userResolvers,
  settingsResolvers,
  officeResolvers,
  holidayResolvers,
  leaveResolvers,
  regularizationResolvers,
  notificationResolvers,
  medicineResolvers,
  documentResolvers
);
