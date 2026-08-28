export const userTypes = /* GraphQL */ `
  type LeaveBalances {
    casual: Int!
    sick: Int!
    earned: Int!
  }

  type User {
    id: ID!
    employeeId: String
    name: String
    email: String
    role: Role
    department: String
    assignedOffice: Office
    avatar: String
    isActive: Boolean
    approvalStatus: ApprovalStatus
    approvalNote: String
    themePreference: String
    """Route keys this account may NOT open (withdrawn by admin). Empty = full access."""
    restrictedPages: [String!]
    loginMethod: String
    temporaryAssignment: TempAssignment
    leaveBalances: LeaveBalances
    shiftStartTime: String
    shiftEndTime: String
    salary: Salary
    bonus: Bonus
    createdAt: DateTime
  }

  """Admin-managed compensation for a staff member."""
  type Salary {
    ctc: Float
    basic: Float
    hra: Float
    allowances: Float
    deductions: Float
    currency: String
    effectiveFrom: DateTime
  }

  """Admin-managed bonus for a staff member."""
  type Bonus {
    amount: Float
    reason: String
    frequency: String
    payoutDate: DateTime
  }

  input SalaryInput {
    ctc: Float
    basic: Float
    hra: Float
    allowances: Float
    deductions: Float
    currency: String
    effectiveFrom: String
  }

  input BonusInput {
    amount: Float
    reason: String
    frequency: String
    payoutDate: String
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
    """Base64 profile photo – when provided, replaces avatar and re-enrolls the face."""
    avatarBase64: String
  }

  type PaginatedUsers {
    data: [User!]!
    pageInfo: PageInfo!
  }
`;
