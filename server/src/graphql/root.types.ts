/**
 * ────────────────────────────────────────────────────────────────────────────
 * ROOT API CONTRACT – the single source of truth for Query / Mutation /
 * Subscription. Entity & input types live beside their modules; this file is
 * the API surface the client sees.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const rootTypes = /* GraphQL */ `
  type Query {
    me: User
    users(pagination: PaginationInput, isActive: Boolean): PaginatedUsers!
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
    """Master medicine catalogue – staff get active-only, admins see all"""
    medicines(search: String, includeInactive: Boolean): [MedicineCatalog!]!
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

    """Master medicine catalogue – admin managed"""
    createMedicine(input: MedicineCatalogInput!): MedicineCatalog!
    updateMedicine(id: ID!, input: MedicineCatalogInput!): MedicineCatalog!
    removeMedicine(id: ID!): Boolean!
    restoreMedicine(id: ID!): MedicineCatalog!
    uploadDocument(input: UploadDocumentInput!): StaffDocument!
    deleteMyDocument(id: ID!): Boolean!
    reviewDocument(id: ID!, status: ApprovalStatus!, adminFeedback: String): StaffDocument!
    """Public self-signup – account stays PENDING until an admin approves it"""
    signup(input: SignUpInput!): SignupResult!
    reviewUserSignup(id: ID!, status: ApprovalStatus!, note: String, officeId: ID): User!
    setThemePreference(mode: String!): User!

    """Temporary duty – punch at another site for a date range"""
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
