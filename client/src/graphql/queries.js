import { gql } from '@apollo/client';

export const GET_ME = gql`
  query GetMe {
    me {
      id
      employeeId
      name
      email
      role
      avatar
      isActive
      themePreference
      restrictedPages
      attendanceMethod
      assignedOffice {
        id
        name
      }
      leaveBalances {
        casual
        sick
        earned
      }
      passkeys {
        id
        createdAt
        lastUsedAt
        deviceType
        backedUp
      }
    }
  }
`;

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    dashboardStats {
      totalStaff
      presentToday
      lateToday
      absentToday
      onLeaveToday
    }
  }
`;

export const GET_TODAY_STATUS = gql`
  query GetTodayStatus {
    todayStatus {
      date
      clockIn {
        id
        selfieUrl
        createdAt
        location {
          address
          branchName
          isCoverDuty


        }
      }
      clockOut {
        id
        selfieUrl
        createdAt
        location {
          address
          branchName
          isCoverDuty


        }
      }
      sessions {
        hours
        clockIn {
          id
          createdAt
          location {
            address
            branchName
          }
        }
        clockOut {
          id
          createdAt
          location {
            address
            branchName
          }
        }
      }
      sessionCount
      hasOpenSession
      totalHours
      status
    }
  }
`;

export const GET_WEEKLY_ATTENDANCE = gql`
  query GetWeeklyAttendance {
    weeklyAttendance {
      date
      status
      totalHours
    }
  }
`;

export const GET_MY_ATTENDANCE = gql`
  query GetMyAttendance($startDate: String, $endDate: String) {
    myAttendance(startDate: $startDate, endDate: $endDate) {
      date
      user {
        id
        name
        employeeId
      }
      clockIn {
        id
        selfieUrl
        createdAt
        location {
          latitude
          longitude
          address
          withinGeofence


        }
      }
      clockOut {
        id
        selfieUrl
        createdAt
        location {
          address
          branchName
          isCoverDuty
        }
      }
      sessions {
        hours
        clockIn {
          id
          selfieUrl
          createdAt
          approvalStatus
          faceMatched
          faceMatchScore
          location {
            latitude
            longitude
            address
            branchName
            withinGeofence
          }
        }
        clockOut {
          id
          selfieUrl
          createdAt
          approvalStatus
          faceMatched
          faceMatchScore
          location {
            latitude
            longitude
            address
            branchName
            withinGeofence
          }
        }
      }
      sessionCount
      hasOpenSession
      totalHours
      status
    }
  }
`;

export const GET_ALL_ATTENDANCE = gql`
  query GetAllAttendance($startDate: String, $endDate: String, $userId: ID) {
    allAttendance(startDate: $startDate, endDate: $endDate, userId: $userId) {
      date
      user {
        id
        name
        employeeId
        avatar
      }
      clockIn {
        id
        selfieUrl
        createdAt
        approvalStatus
        adminComments
        vpnDetected
        faceMatched
        faceMatchScore
        location {
          address
          branchName
          isCoverDuty
          withinGeofence




        }
      }
      clockOut {
        id
        selfieUrl
        createdAt
        location {
          address
          branchName
          isCoverDuty
        }
      }
      sessions {
        hours
        clockIn {
          id
          selfieUrl
          createdAt
          approvalStatus
          adminComments
          vpnDetected
          faceMatched
          faceMatchScore
          location {
            latitude
            longitude
            address
            branchName
            withinGeofence
          }
        }
        clockOut {
          id
          selfieUrl
          createdAt
          approvalStatus
          adminComments
          vpnDetected
          faceMatched
          faceMatchScore
          location {
            latitude
            longitude
            address
            branchName
            withinGeofence
          }
        }
      }
      sessionCount
      hasOpenSession
      totalHours
      status
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers($isActive: Boolean, $pagination: PaginationInput) {
    users(isActive: $isActive, pagination: $pagination) {
      data {
        id
        employeeId
        name
        email
        role
        restrictedPages
        attendanceMethod
        isActive
        approvalStatus
        avatar
        createdAt
        assignedOffice {
          id
          name
        }
        temporaryAssignment {
          office {
            id
            name
          }
          startDate
          endDate
          reason
        }
        leaveBalances {
          casual
          sick
          earned
        }
      }
      pageInfo {
        totalCount
        currentPage
        totalPages
        hasNextPage
      }
    }
  }
`;

export const GET_PENDING_USERS = gql`
  query GetPendingUsers {
    pendingUsers {
      id
      employeeId
      name
      email
      loginMethod
      approvalStatus
      approvalNote
      createdAt
    }
  }
`;

export const GET_EXEMPTIONS = gql`
  query GetExemptions($startDate: String, $endDate: String) {
    exemptions(startDate: $startDate, endDate: $endDate) {
      id
      date
      reason
      createdAt
      user {
        id
        name
        employeeId
      }
      createdBy {
        id
        name
      }
    }
  }
`;

export const GET_OFFICES = gql`
  query GetOffices {
    offices {
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

export const GET_PUBLIC_CONFIG = gql`
  query GetPublicConfig {
    publicConfig {
      organizationName
      appLogo
      attendanceMethod
    }
  }
`;

export const GET_SETTINGS = gql`
  query GetSettings {
    settings {
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
      attendanceMethod
      vpnStrictMode
      autoApproveAttendance
      mailFromName
      mailFromAddress
      regularizationAutoApproveDays
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

export const GET_MONTHLY_TREND = gql`
  query GetMonthlyTrend($month: Int!, $year: Int!) {
    monthlyTrend(month: $month, year: $year) {
      date
      presentCount
      lateCount
      absentCount
    }
  }
`;

export const GET_RECENT_ACTIVITY = gql`
  query GetRecentActivity($limit: Int) {
    recentActivity(limit: $limit) {
      id
      type
      selfieUrl
      createdAt
      user {
        id
        name
        employeeId
        avatar
      }
      location {
          address
          branchName
          isCoverDuty
      }
    }
  }
`;

export const GET_HOLIDAYS = gql`
  query GetHolidays($year: Int) {
    holidays(year: $year) {
      id
      name
      date
      description
      type
      isActive
    }
  }
`;

export const GET_MY_LEAVE_REQUESTS = gql`
  query GetMyLeaveRequests {
    myLeaveRequests {
      id
      leaveType
      startDate
      endDate
      reason
      status
      adminFeedback
      createdAt
      approvedBy {
        id
        name
      }
    }
  }
`;

export const GET_ALL_LEAVE_REQUESTS = gql`
  query GetAllLeaveRequests($status: ApprovalStatus) {
    allLeaveRequests(status: $status) {
      id
      leaveType
      startDate
      endDate
      reason
      status
      adminFeedback
      createdAt
      user {
        id
        name
        employeeId
      }
      approvedBy {
        id
        name
      }
    }
  }
`;

export const GET_PENDING_APPROVALS_COUNT = gql`
  query GetPendingApprovalsCount {
    pendingApprovalsCount
  }
`;

export const GET_MY_REGULARIZATIONS = gql`
  query GetMyRegularizations {
    myRegularizations {
      id
      date
      checkInTime
      checkOutTime
      reason
      status
      adminFeedback
      createdAt
      approvedBy {
        id
        name
      }
    }
  }
`;

export const GET_MY_DOCUMENTS = gql`
  query GetMyDocuments {
    myDocuments {
      id
      title
      category
      fileUrl
      status
      adminFeedback
      createdAt
    }
  }
`;

export const GET_ALL_DOCUMENTS = gql`
  query GetAllDocuments {
    allDocuments {
      id
      title
      category
      fileUrl
      status
      adminFeedback
      createdAt
      uploadedBy {
        id
        name
        employeeId
      }
      reviewedBy {
        name
      }
    }
  }
`;

export const GET_MY_MEDICINE_REQUESTS = gql`
  query GetMyMedicineRequests {
    myMedicineRequests {
      id
      medicineName
      strength
      quantity
      unit
      urgency
      notes
      status
      adminFeedback
      isNewMedicine
      createdAt
      handledBy {
        name
      }
    }
  }
`;

export const GET_ALL_MEDICINE_REQUESTS = gql`
  query GetAllMedicineRequests($status: String) {
    allMedicineRequests(status: $status) {
      id
      medicineName
      strength
      quantity
      unit
      urgency
      notes
      status
      adminFeedback
      isNewMedicine
      createdAt
      requestedBy {
        id
        name
        employeeId
      }
      handledBy {
        name
      }
    }
  }
`;

/**
 * Master medicine catalogue – powers the staff request autocomplete AND the
 * admin catalog page. NOTE: staff-facing callers must NOT select `price`.
 */
export const GET_MEDICINES = gql`
  query GetMedicines($search: String, $includeInactive: Boolean) {
    medicines(search: $search, includeInactive: $includeInactive) {
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

// Admin catalogue grid – server-side paginated + searchable.
export const GET_MEDICINES_PAGINATED = gql`
  query GetMedicinesPaginated($pagination: PaginationInput, $includeInactive: Boolean) {
    medicinesPaginated(pagination: $pagination, includeInactive: $includeInactive) {
      data {
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
      pageInfo {
        totalCount
        currentPage
        totalPages
        hasNextPage
      }
    }
  }
`;

export const GET_ALL_REGULARIZATIONS = gql`
  query GetAllRegularizations($status: ApprovalStatus) {
    allRegularizations(status: $status) {
      id
      date
      checkInTime
      checkOutTime
      reason
      status
      adminFeedback
      createdAt
      user {
        id
        name
        employeeId
      }
      approvedBy {
        id
        name
      }
    }
  }
`;

export const GET_MY_NOTIFICATIONS = gql`
  query GetMyNotifications($limit: Int, $unreadOnly: Boolean) {
    myNotifications(limit: $limit, unreadOnly: $unreadOnly) {
      id
      type
      title
      message
      link
      isRead
      createdAt
    }
  }
`;

export const GET_UNREAD_NOTIFICATIONS_COUNT = gql`
  query GetUnreadNotificationsCount {
    unreadNotificationsCount
  }
`;



// ── Staff Profile dialog (admin) ─────────────────────────────────────────────
// Full single-user profile. Includes per-user shift overrides and compensation
// (salary / bonus) that the list query does not carry.
// NOTE: `user(id)`, `shiftStartTime`/`shiftEndTime` on the user, and the
// `salary`/`bonus` sub-objects require matching backend resolvers/schema.
export const GET_STAFF_PROFILE = gql`
  query GetStaffProfile($id: ID!) {
    user(id: $id) {
      id
      employeeId
      name
      email
      role
      avatar
      isActive
      approvalStatus
      restrictedPages
      createdAt
      shiftStartTime
      shiftEndTime
      attendanceMethod
      assignedOffice {
        id
        name
      }
      leaveBalances {
        casual
        sick
        earned
      }
      salary {
        ctc
        basic
        hra
        allowances
        deductions
        currency
        effectiveFrom
      }
      bonus {
        amount
        reason
        payoutDate
        frequency
      }
      passkeys {
        id
        createdAt
        lastUsedAt
        deviceType
        backedUp
      }
    }
  }
`;

// Self-view profile (staff). Uses the auth-gated `me` query, which already
// exposes salary/bonus/shift on the User type.
export const GET_MY_PROFILE = gql`
  query GetMyProfile {
    me {
      id
      employeeId
      name
      email
      role
      avatar
      isActive
      approvalStatus
      restrictedPages
      createdAt
      shiftStartTime
      shiftEndTime
      assignedOffice {
        id
        name
      }
      leaveBalances {
        casual
        sick
        earned
      }
      salary {
        ctc
        basic
        hra
        allowances
        deductions
        currency
        effectiveFrom
      }
      bonus {
        amount
        reason
        payoutDate
        frequency
      }
      passkeys {
        id
        createdAt
        lastUsedAt
        deviceType
        backedUp
      }
    }
  }
`;

// Documents uploaded by a specific staff member (admin view).
export const GET_USER_DOCUMENTS = gql`
  query GetUserDocuments($userId: ID!) {
    userDocuments(userId: $userId) {
      id
      title
      category
      fileUrl
      status
      adminFeedback
      createdAt
    }
  }
`;
