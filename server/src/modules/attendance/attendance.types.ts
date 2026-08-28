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

  """One check-in → check-out pair within a day (Zoho-style multi-session)."""
  type AttendanceSession {
    clockIn: Attendance!
    """Null while the session is still open (clocked in, not yet out)."""
    clockOut: Attendance
    """Duration of this session in hours (0 while still open)."""
    hours: Float!
  }

  type AttendanceSummary {
    date: String!
    user: User!
    """First clock-in of the day (kept for backward compatibility)."""
    clockIn: Attendance
    """Last clock-out of the day (kept for backward compatibility)."""
    clockOut: Attendance
    """Every check-in/out session for the day, in time order."""
    sessions: [AttendanceSession!]!
    """Number of sessions (open or completed)."""
    sessionCount: Int!
    """True when the last punch was a clock-in with no matching clock-out yet."""
    hasOpenSession: Boolean!
    """Sum of all completed session durations, in hours."""
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
    """Burst of base64 frames for server-side head-turn liveness."""
    livenessFrames: [String!]
  }
`;
