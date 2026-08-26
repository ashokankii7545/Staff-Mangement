/** Shared scalars & enums used across every module's SDL. */
export const commonTypes = /* GraphQL */ `
  "ISO datetime"
  scalar DateTime
  "Local calendar date (YYYY-MM-DD)"
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
`;
