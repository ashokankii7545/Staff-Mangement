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

  type PaginatedUsers {
    data: [User!]!
    pageInfo: PageInfo!
  }
`;
