export const medicineTypes = /* GraphQL */ `
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
`;
