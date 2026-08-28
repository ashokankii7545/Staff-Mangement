import { gql } from '@apollo/client';

export const LOGIN = gql`
  mutation Login($employeeId: String!, $password: String!) {
    login(employeeId: $employeeId, password: $password) {
      token
      user {
        id
        employeeId
        name
        role
        avatar
        themePreference
        restrictedPages
        approvalStatus
      }
    }
  }
`;

export const GOOGLE_LOGIN = gql`
  mutation GoogleLogin($credential: String!) {
    googleLogin(credential: $credential) {
      token
      user {
        id
        employeeId
        name
        role
        avatar
        themePreference
        restrictedPages
        approvalStatus
      }
    }
  }
`;

export const CLOCK_IN = gql`
  mutation ClockIn($input: ClockInput!) {
    clockIn(input: $input) {
      success
      message
      attendance {
        id
        type
        selfieUrl
        createdAt
        location {
          branchName
          isCoverDuty
          latitude
          longitude
          address
          withinGeofence


        }
      }
      vpnDetected


    }
  }
`;

export const CLOCK_OUT = gql`
  mutation ClockOut($input: ClockInput!) {
    clockOut(input: $input) {
      success
      message
      attendance {
        id
        type
        selfieUrl
        createdAt
      }
      vpnDetected


    }
  }
`;

export const REGISTER_STAFF = gql`
  mutation RegisterStaff($input: RegisterInput!) {
    registerStaff(input: $input) {
      id
      employeeId
      name
      email
      role
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      name
      email
      role
      restrictedPages
      assignedOffice {
        id
        name
      }
    }
  }
`;

export const TOGGLE_USER_ACTIVE = gql`
  mutation ToggleUserActive($userId: ID!) {
    toggleUserActive(userId: $userId) {
      id
      isActive
    }
  }
`;

export const UPDATE_SETTINGS = gql`
  mutation UpdateSettings($input: SettingsInput!) {
    updateSettings(input: $input) {
      id
      organizationName
      appLogo
      officeLatitude
      officeLongitude
      officeName
      geofenceRadius
      shiftStartTime
      shiftEndTime
      lateThresholdMinutes
      workingDays
      vpnStrictMode
      autoApproveAttendance
      regularizationAutoApproveDays
      mailFromName
      mailFromAddress
      emailNotifications {
        userUpdates
        broadcasts
        adminAlerts
      }
      leavePolicy {
        casualPerMonth
        sickAnnual
        earnedAnnual
      }
    }
  }
`;

export const CREATE_OFFICE = gql`
  mutation CreateOffice($input: OfficeInput!) {
    createOffice(input: $input) {
      id
      name
      address
      latitude
      longitude
      geofenceRadius
      isActive
    }
  }
`;

export const UPDATE_OFFICE = gql`
  mutation UpdateOffice($id: ID!, $input: OfficeInput!) {
    updateOffice(id: $id, input: $input) {
      id
      name
      address
      latitude
      longitude
      geofenceRadius
      isActive
    }
  }
`;

export const DELETE_OFFICE = gql`
  mutation DeleteOffice($id: ID!) {
    deleteOffice(id: $id)
  }
`;

export const CREATE_HOLIDAY = gql`
  mutation CreateHoliday($input: HolidayInput!) {
    createHoliday(input: $input) {
      id
      name
      date
      description
      type
      isActive
    }
  }
`;

export const DELETE_HOLIDAY = gql`
  mutation DeleteHoliday($id: ID!) {
    deleteHoliday(id: $id)
  }
`;

export const APPLY_FOR_LEAVE = gql`
  mutation ApplyForLeave($input: LeaveRequestInput!) {
    applyForLeave(input: $input) {
      id
      leaveType
      startDate
      endDate
      reason
      status
    }
  }
`;

export const REVIEW_LEAVE_REQUEST = gql`
  mutation ReviewLeaveRequest($id: ID!, $status: ApprovalStatus!, $adminFeedback: String) {
    reviewLeaveRequest(id: $id, status: $status, adminFeedback: $adminFeedback) {
      id
      status
      adminFeedback
      approvedBy {
        id
        name
      }
    }
  }
`;

export const REVIEW_ATTENDANCE = gql`
  mutation ReviewAttendance($id: ID!, $status: ApprovalStatus!, $adminComments: String) {
    reviewAttendance(id: $id, status: $status, adminComments: $adminComments) {
      id
      approvalStatus
      adminComments
      approvedBy {
        id
        name
      }
    }
  }
`;

export const REQUEST_REGULARIZATION = gql`
  mutation RequestRegularization($input: RegularizationInput!) {
    requestRegularization(input: $input) {
      id
      date
      checkInTime
      checkOutTime
      reason
      status
      createdAt
    }
  }
`;

export const CANCEL_MY_LEAVE = gql`
  mutation CancelMyLeave($id: ID!) {
    cancelMyLeave(id: $id) {
      id
      status
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

export const UPLOAD_DOCUMENT = gql`
  mutation UploadDocument($input: UploadDocumentInput!) {
    uploadDocument(input: $input) {
      id
      title
      status
      createdAt
    }
  }
`;

export const DELETE_MY_DOCUMENT = gql`
  mutation DeleteMyDocument($id: ID!) {
    deleteMyDocument(id: $id)
  }
`;

export const REVIEW_DOCUMENT = gql`
  mutation ReviewDocument($id: ID!, $status: ApprovalStatus!, $adminFeedback: String) {
    reviewDocument(id: $id, status: $status, adminFeedback: $adminFeedback) {
      id
      status
      adminFeedback
    }
  }
`;

export const REQUEST_MEDICINE = gql`
  mutation RequestMedicine($input: MedicineRequestInput!) {
    requestMedicine(input: $input) {
      id
      medicineName
      strength
      quantity
      unit
      urgency
      status
      isNewMedicine
      createdAt
    }
  }
`;

export const REVIEW_MEDICINE_REQUEST = gql`
  mutation ReviewMedicineRequest($id: ID!, $status: String!, $adminFeedback: String) {
    reviewMedicineRequest(id: $id, status: $status, adminFeedback: $adminFeedback) {
      id
      medicineName
      status
      adminFeedback
    }
  }
`;

// Staff cancels their own still-PENDING stock request.
export const CANCEL_MY_MEDICINE_REQUEST = gql`
  mutation CancelMyMedicineRequest($id: ID!) {
    cancelMyMedicineRequest(id: $id)
  }
`;

// ── Master medicine catalogue (admin-managed) ────────────────────────────────
export const CREATE_MEDICINE = gql`
  mutation CreateMedicine($input: MedicineCatalogInput!) {
    createMedicine(input: $input) {
      id
      name
      genericName
      manufacturer
      dosageForm
      strength
      packSize
      category
      schedule
      uses
      dosageTiming
      directionsForUse
      storage
      sideEffects
      image
      price
      purchaseRate
      gstRate
      isActive
      createdAt
    }
  }
`;

export const UPDATE_MEDICINE = gql`
  mutation UpdateMedicine($id: ID!, $input: MedicineCatalogInput!) {
    updateMedicine(id: $id, input: $input) {
      id
      name
      genericName
      manufacturer
      dosageForm
      strength
      packSize
      category
      schedule
      uses
      dosageTiming
      directionsForUse
      storage
      sideEffects
      image
      price
      purchaseRate
      gstRate
      isActive
    }
  }
`;

export const REMOVE_MEDICINE = gql`
  mutation RemoveMedicine($id: ID!) {
    removeMedicine(id: $id)
  }
`;

export const RESTORE_MEDICINE = gql`
  mutation RestoreMedicine($id: ID!) {
    restoreMedicine(id: $id) {
      id
      isActive
    }
  }
`;

export const REVIEW_REGULARIZATION = gql`
  mutation ReviewRegularization($id: ID!, $status: ApprovalStatus!, $adminFeedback: String) {
    reviewRegularization(id: $id, status: $status, adminFeedback: $adminFeedback) {
      id
      status
      adminFeedback
      approvedBy {
        id
        name
      }
    }
  }
`;





export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      isRead
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export const CLEAR_READ_NOTIFICATIONS = gql`
  mutation ClearReadNotifications {
    clearReadNotifications
  }
`;

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($id: ID!) {
    deleteNotification(id: $id)
  }
`;

// ── Auth approval workflow ──────────────────────────────────────────────────
export const SIGNUP = gql`
  mutation Signup($input: SignUpInput!) {
    signup(input: $input) {
      success
      message
    }
  }
`;

export const VERIFY_EMAIL_OTP = gql`
  mutation VerifyEmailOTP($email: String!, $otp: String!) {
    verifyEmailOTP(email: $email, otp: $otp) {
      success
      message
    }
  }
`;

export const RESEND_EMAIL_OTP = gql`
  mutation ResendEmailOTP($email: String!) {
    resendEmailOTP(email: $email) {
      success
      message
    }
  }
`;

export const REVIEW_USER_SIGNUP = gql`
  mutation ReviewUserSignup($id: ID!, $status: ApprovalStatus!, $note: String) {
    reviewUserSignup(id: $id, status: $status, note: $note) {
      id
      employeeId
      name
      email
      approvalStatus
      approvalNote
      createdAt
    }
  }
`;

// ── Theme persistence across devices/re-logins ──────────────────────────────
export const SET_THEME_PREFERENCE = gql`
  mutation SetThemePreference($mode: String!) {
    setThemePreference(mode: $mode) {
      id
      themePreference
    }
  }
`;

// ── Temporary duty & day-off controls ───────────────────────────────────────
export const ASSIGN_TEMP_DUTY = gql`
  mutation AssignTemporaryDuty(
    $userId: ID!
    $officeId: ID!
    $startDate: DateTime!
    $endDate: DateTime!
    $reason: String
  ) {
    assignTemporaryDuty(userId: $userId, officeId: $officeId, startDate: $startDate, endDate: $endDate, reason: $reason) {
      id
      temporaryAssignment {
        office {
          id
          name
        }
        startDate
        endDate
        reason
      }
    }
  }
`;

export const CLEAR_TEMP_DUTY = gql`
  mutation ClearTemporaryDuty($userId: ID!) {
    clearTemporaryDuty(userId: $userId) {
      id
    }
  }
`;

export const GRANT_DAY_OFF = gql`
  mutation GrantDayOff($userId: ID!, $date: Date!, $reason: String) {
    grantDayOff(userId: $userId, date: $date, reason: $reason) {
      id
      date
      reason
      user {
        id
        name
      }
    }
  }
`;

export const REVOKE_DAY_OFF = gql`
  mutation RevokeDayOff($id: ID!) {
    revokeDayOff(id: $id)
  }
`;

// ── Admin announcement broadcast ─────────────────────────────────────────────
// Sends an org-wide announcement email to every active staff member AND pushes
// an in-app notification into each staff account's inbox.
export const BROADCAST_EMAIL = gql`
  mutation BroadcastEmail($subject: String!, $message: String!) {
    broadcastEmail(subject: $subject, message: $message)
  }
`;

// ── Staff Profile dialog (admin) ─────────────────────────────────────────────
// Compensation + document-request operations used by StaffProfileDialog.
// NOTE: these require matching backend resolvers/schema — they do not exist yet
// on the server and will error until the API is extended.
export const UPDATE_SALARY = gql`
  mutation UpdateSalary($userId: ID!, $input: SalaryInput!) {
    updateSalary(userId: $userId, input: $input) {
      id
      salary {
        ctc
        basic
        hra
        allowances
        deductions
        currency
        effectiveFrom
      }
    }
  }
`;

export const UPDATE_BONUS = gql`
  mutation UpdateBonus($userId: ID!, $input: BonusInput!) {
    updateBonus(userId: $userId, input: $input) {
      id
      bonus {
        amount
        reason
        payoutDate
        frequency
      }
    }
  }
`;

// "Ask Doc" — asks a specific staff member to upload a named document.
export const REQUEST_DOCUMENT = gql`
  mutation RequestDocument($userId: ID!, $title: String!, $note: String) {
    requestDocument(userId: $userId, title: $title, note: $note) {
      success
      message
    }
  }
`;
