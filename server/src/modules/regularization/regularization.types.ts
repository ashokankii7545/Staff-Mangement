export const regularizationTypes = /* GraphQL */ `
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
`;
