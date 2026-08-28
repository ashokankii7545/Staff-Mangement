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

  """Admin's request for a staff member to upload a document"""
  type DocumentRequest {
    id: ID!
    category: String!
    note: String
    status: String!
    requestedBy: User
    createdAt: DateTime
  }

  input DocumentRequestInput {
    category: String
    note: String
  }
`;
