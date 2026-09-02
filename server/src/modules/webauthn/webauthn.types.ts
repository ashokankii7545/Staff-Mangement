export const webauthnTypes = /* GraphQL */ `
  "One registered fingerprint/passkey credential (public info only – never the key)."
  type PasskeyInfo {
    id: String!
    createdAt: DateTime!
    lastUsedAt: DateTime
    deviceType: String
    backedUp: Boolean
  }

  "JSON-transported options for navigator.credentials.create()/get()."
  type WebAuthnOptionsPayload {
    "JSON-serialized PublicKeyCredentialCreationOptions / RequestOptions."
    optionsJson: String!
    "True when the account already has a usable passkey (auth ceremony only)."
    hasPasskey: Boolean
  }

  type WebAuthnVerifyResult {
    success: Boolean!
    message: String!
    passkeys: [PasskeyInfo!]!
  }

  extend type User {
    passkeys: [PasskeyInfo!]!
  }
`;
