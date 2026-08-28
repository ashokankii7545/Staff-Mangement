export const authTypes = /* GraphQL */ `
  type SignupResult {
    success: Boolean!
    message: String!
  }

  """Generic success/message envelope for simple mutations (OTP verify/resend)."""
  type DefaultResponse {
    success: Boolean!
    message: String!
  }

  type AuthPayload {
    token: String!
    """Long-lived token used to silently renew the session (30 days)."""
    refreshToken: String!
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
