const typeDefs = `#graphql
  scalar DateTime
  scalar Date

  enum Role {
    STAFF
    ADMIN
  }

  enum PunchType {
    CLOCK_IN
    CLOCK_OUT
  }

  enum AttendanceStatus {
    PRESENT
    LATE
    HALF_DAY
    ABSENT
    HOLIDAY
    EXEMPT
    PENDING
    REJECTED
  }

  type Office {
    id: ID!
    name: String!
    address: String
    latitude: Float!
    longitude: Float!
    geofenceRadius: Int!
    isActive: Boolean!
  }

  enum ApprovalStatus {
    PENDING
    APPROVED
    REJECTED
    CANCELLED
  }

  enum LeaveType {
    CASUAL
    SICK
    EARNED
  }

  enum HolidayType {
    NATIONAL
    OPTIONAL
  }

  type LeaveBalances {
    casual: Int!
    sick: Int!
    earned: Int!
  }

  type User {
    id: ID!
    employeeId: String!
    name: String!
    email: String!
    role: Role!
    department: String
    assignedOffice: Office
    avatar: String
    isActive: Boolean!
    approvalStatus: ApprovalStatus!
    approvalNote: String
    themePreference: String
    """Route keys this account may NOT open (withdrawn by admin). Empty = full access."""
    restrictedPages: [String!]
    loginMethod: String
    temporaryAssignment: TempAssignment
    leaveBalances: LeaveBalances
    shiftStartTime: String
    shiftEndTime: String
    createdAt: DateTime
  }

  """Time-bound duty at another site – overrides assignedOffice between dates"""
  type TempAssignment {
    office: Office
    startDate: DateTime
    endDate: DateTime
    reason: String
  }

  type Exemption {
    id: ID!
    user: User!
    date: String!
    reason: String
    createdBy: User
    createdAt: DateTime
  }

  enum NotificationType {
    LEAVE_REQUEST
    LEAVE_DECISION
    REGULARIZATION_REQUEST
    REGULARIZATION_DECISION
    ATTENDANCE_FLAGGED
    ATTENDANCE_DECISION
    SIGNUP_REQUEST
    SIGNUP_DECISION
    TEMP_DUTY
    DAY_OFF
    MEDICINE_REQUEST
    MEDICINE_DECISION
    GENERIC
  }

  type Notification {
    id: ID!
    recipient: User!
    type: NotificationType!
    title: String!
    message: String
    link: String
    isRead: Boolean!
    createdAt: DateTime
  }

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

  type SignupResult {
    success: Boolean!
    message: String!
  }

  type AuthPayload {
    token: String!
    user: User!
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

  input RegisterInput {
    name: String!
    email: String!
    password: String!
    role: Role
    officeId: ID
    avatarBase64: String
  }

  """Public self-signup – creates a PENDING account until an admin approves it"""
  input SignUpInput {
    name: String!
    email: String!
    password: String!
    avatarBase64: String
  }

  input LeaveBalancesInput {
    casual: Int
    sick: Int
    earned: Int
  }

  input UpdateUserInput {
    name: String
    email: String
    department: String
    role: Role
    officeId: ID
    leaveBalances: LeaveBalancesInput
    shiftStartTime: String
    shiftEndTime: String
    restrictedPages: [String!]
  }

  input OfficeInput {
    name: String!
    address: String
    latitude: Float!
    longitude: Float!
    geofenceRadius: Int
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

  type Holiday {
    id: ID!
    name: String!
    date: Date!
    description: String
    type: HolidayType!
    isActive: Boolean!
  }

  type LeaveRequest {
    id: ID!
    user: User!
    leaveType: LeaveType!
    startDate: Date!
    endDate: Date!
    reason: String!
    status: ApprovalStatus!
    adminFeedback: String
    approvedBy: User
    createdAt: DateTime
  }

  input HolidayInput {
    name: String!
    date: Date!
    description: String
    type: HolidayType
  }

  input LeaveRequestInput {
    userId: ID
    leaveType: LeaveType!
    startDate: Date!
    endDate: Date!
    reason: String!
  }

  """Medicine stock request raised by pharmacy staff for the owner/admin"""
  type MedicineRequest {
    id: ID!
    requestedBy: User!
    medicineName: String!
    strength: String
    quantity: Int!
    unit: String!
    urgency: String!
    notes: String
    status: String!
    adminFeedback: String
    handledBy: User
    createdAt: DateTime
    updatedAt: DateTime
  }

  input MedicineRequestInput {
    medicineName: String!
    strength: String
    quantity: Int!
    unit: String
    urgency: String
    notes: String
  }

  """Staff-uploaded document (ID proof, certificate) – optional, admin-verified"""
  type StaffDocument {
    id: ID!
    uploadedBy: User!
    title: String!
    category: String!
    fileUrl: String!
    status: ApprovalStatus!
    adminFeedback: String
    reviewedBy: User
    createdAt: DateTime
  }

  input UploadDocumentInput {
    title: String!
    category: String
    fileBase64: String!
  }

  type RegularizationRequest {
    id: ID!
    user: User!
    date: String!
    checkInTime: String!
    checkOutTime: String!
    reason: String!
    status: ApprovalStatus!
    adminFeedback: String
    approvedBy: User
    createdAt: DateTime
  }

  input RegularizationInput {
    date: String!
    checkInTime: String!
    checkOutTime: String!
    reason: String!
  }

  type Query {
    me: User
    users(department: String, isActive: Boolean): [User!]!
    user(id: ID!): User
    """Public: resolve a login identifier (email/employee ID) to an avatar URL"""
    checkAvatar(identifier: String!): String
    offices: [Office!]!
    office(id: ID!): Office
    myAttendance(startDate: String, endDate: String): [AttendanceSummary!]!
    allAttendance(startDate: String, endDate: String, userId: ID): [AttendanceSummary!]!
    dashboardStats: DashboardStats!
    todayStatus: AttendanceSummary
    weeklyAttendance: [AttendanceSummary!]!
    myDocuments: [StaffDocument!]!
    allDocuments: [StaffDocument!]!
    monthlyTrend(month: Int!, year: Int!): [DailyTrend!]!
    settings: Settings!
    recentActivity(limit: Int): [Attendance!]!
    holidays(year: Int): [Holiday!]!
    myLeaveRequests: [LeaveRequest!]!
    allLeaveRequests(status: ApprovalStatus): [LeaveRequest!]!
    pendingApprovalsCount: Int!
    myRegularizations: [RegularizationRequest!]!
    allRegularizations(status: ApprovalStatus): [RegularizationRequest!]!
    myMedicineRequests: [MedicineRequest!]!
    allMedicineRequests(status: String): [MedicineRequest!]!
    pendingUsers: [User!]!
    myNotifications(limit: Int, unreadOnly: Boolean): [Notification!]!
    unreadNotificationsCount: Int!
    exemptions(startDate: String, endDate: String): [Exemption!]!
  }

  type Mutation {
    login(employeeId: String!, password: String!): AuthPayload!
    googleLogin(credential: String!): AuthPayload!
    requestPasswordReset(email: String!): Boolean!
    changePassword(currentPassword: String, newPassword: String!): Boolean!
    registerStaff(input: RegisterInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    toggleUserActive(userId: ID!): User!
    createOffice(input: OfficeInput!): Office!
    updateOffice(id: ID!, input: OfficeInput!): Office!
    deleteOffice(id: ID!): Boolean!
    clockIn(input: ClockInput!): AttendanceResult!
    clockOut(input: ClockInput!): AttendanceResult!
    updateSettings(input: SettingsInput!): Settings!
    createHoliday(input: HolidayInput!): Holiday!
    deleteHoliday(id: ID!): Boolean!
    applyForLeave(input: LeaveRequestInput!): LeaveRequest!
    reviewLeaveRequest(id: ID!, status: ApprovalStatus!, adminFeedback: String): LeaveRequest!
    cancelMyLeave(id: ID!): LeaveRequest!
    reviewAttendance(id: ID!, status: ApprovalStatus!, adminComments: String): Attendance!
    requestRegularization(input: RegularizationInput!): RegularizationRequest!
    reviewRegularization(id: ID!, status: ApprovalStatus!, adminFeedback: String): RegularizationRequest!
    requestMedicine(input: MedicineRequestInput!): MedicineRequest!
    reviewMedicineRequest(id: ID!, status: String!, adminFeedback: String): MedicineRequest!
    uploadDocument(input: UploadDocumentInput!): StaffDocument!
    deleteMyDocument(id: ID!): Boolean!
    reviewDocument(id: ID!, status: ApprovalStatus!, adminFeedback: String): StaffDocument!
    """Public self-signup – account stays PENDING until an admin approves it"""
    signup(input: SignUpInput!): SignupResult!
    reviewUserSignup(id: ID!, status: ApprovalStatus!, note: String, officeId: ID): User!
    setThemePreference(mode: String!): User!

    """Temporary duty – punch at another site for a date range, permanent site untouched"""
    assignTemporaryDuty(userId: ID!, officeId: ID!, startDate: DateTime!, endDate: DateTime!, reason: String): User!
    clearTemporaryDuty(userId: ID!): User!

    """Grant/remove a staff member's day off on a specific date"""
    grantDayOff(userId: ID!, date: Date!, reason: String): Exemption!
    revokeDayOff(id: ID!): Boolean!

    markNotificationRead(id: ID!): Notification
    markAllNotificationsRead: Int!
    deleteNotification(id: ID!): Boolean!
    clearReadNotifications: Int!
    broadcastEmail(subject: String!, message: String!): Boolean!
  }

  type Subscription {
    leaveRequestAdded: LeaveRequest!
    leaveRequestUpdated: LeaveRequest!
    regularizationAdded: RegularizationRequest!
    regularizationUpdated: RegularizationRequest!
    """Per-user real-time notification stream (requires authenticated WS)"""
    notificationAdded: Notification!
  }
`;

export default typeDefs;



