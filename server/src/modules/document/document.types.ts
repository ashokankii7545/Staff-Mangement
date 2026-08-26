export const documentTypes = /* GraphQL */ `
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
`;
