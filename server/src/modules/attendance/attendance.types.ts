export const attendanceTypes = /* GraphQL */ `
  type Location {
    latitude: Float!
    longitude: Float!
    accuracy: Float
    address: String
    withinGeofence: Boolean!
    distanceFromOffice: Float
    branchName: String
    isCoverDuty: Boolean
  }

  type VPNCheckDetails {
    vpn: Boolean
    proxy: Boolean
    tor: Boolean
    webrtcMismatch: Boolean
    timezoneMismatch: Boolean
  }

  type Attendance {
    id: ID!
    user: User!
    type: PunchType!
    selfieUrl: String!
    location: Location!
    ipAddress: String
    vpnDetected: Boolean
    vpnCheckDetails: VPNCheckDetails
    browserTimezone: String
    date: String!
    approvalStatus: ApprovalStatus!
    approvedBy: User
    adminComments: String
    faceMatched: Boolean
    faceMatchScore: Float
    createdAt: DateTime
  }

  type AttendanceSummary {
    date: String!
    user: User!
    clockIn: Attendance
    clockOut: Attendance

    totalHours: Float
    status: AttendanceStatus!
  }

  type DashboardStats {
    totalStaff: Int!
    presentToday: Int!
    lateToday: Int!
    absentToday: Int!
    onLeaveToday: Int!
  }

  type DailyTrend {
    date: String!
    presentCount: Int!
    lateCount: Int!
    absentCount: Int!
  }

  type AttendanceResult {
    success: Boolean!
    message: String!
    attendance: Attendance
    vpnDetected: Boolean
    distanceFromOffice: Float
  }

  input ClockInput {
    selfieBase64: String!
    latitude: Float!
    longitude: Float!
    accuracy: Float!
    address: String
    browserTimezone: String!
    webRTCIPs: [String!]
    faceMatched: Boolean
    faceMatchScore: Float
  }
`;
