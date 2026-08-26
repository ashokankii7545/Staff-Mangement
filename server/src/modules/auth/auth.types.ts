export const authTypes = /* GraphQL */ `
  type SignupResult {
    success: Boolean!
    message: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
    role: Role
    officeId: ID
    avatarBase64: String
  }

  """Public self-signup – creates a PENDING account until an admin approves it"""
  input SignUpInput {
    name: String!
    email: String!
    password: String!
    avatarBase64: String
  }
`;
