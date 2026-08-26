export const leaveTypes = /* GraphQL */ `
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

  input LeaveRequestInput {
    userId: ID
    leaveType: LeaveType!
    startDate: Date!
    endDate: Date!
    reason: String!
  }
`;
