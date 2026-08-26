export const settingsTypes = /* GraphQL */ `
  type Settings {
    id: ID!
    organizationName: String!
    officeLatitude: Float!
    officeLongitude: Float!
    officeName: String
    geofenceRadius: Int!
    shiftStartTime: String!
    shiftEndTime: String!
    lateThresholdMinutes: Int!
    workingDays: [String!]!
    vpnStrictMode: Boolean!
    autoApproveAttendance: Boolean!
    mailFromName: String!
    mailFromAddress: String
    regularizationAutoApproveDays: Int!
    emailNotifications: EmailNotificationPrefs!
    leavePolicy: LeavePolicy!
  }

  """Indian-standard accrual policy: CL monthly · SL annual upfront · EL annual"""
  type LeavePolicy {
    casualPerMonth: Int!
    sickAnnual: Int!
    earnedAnnual: Int!
  }

  """Master switches for outbound email categories (password resets ALWAYS send)"""
  type EmailNotificationPrefs {
    userUpdates: Boolean!
    broadcasts: Boolean!
    adminAlerts: Boolean!
  }

  input SettingsInput {
    organizationName: String
    officeLatitude: Float
    officeLongitude: Float
    officeName: String
    geofenceRadius: Int
    shiftStartTime: String
    shiftEndTime: String
    lateThresholdMinutes: Int
    workingDays: [String!]
    vpnStrictMode: Boolean
    autoApproveAttendance: Boolean
    mailFromName: String
    mailFromAddress: String
    regularizationAutoApproveDays: Int
    emailNotifications: EmailNotificationPrefsInput
    leavePolicy: LeavePolicyInput
  }

  input LeavePolicyInput {
    casualPerMonth: Int
    sickAnnual: Int
    earnedAnnual: Int
  }

  input EmailNotificationPrefsInput {
    userUpdates: Boolean
    broadcasts: Boolean
    adminAlerts: Boolean
  }
`;
