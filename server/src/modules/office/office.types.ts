export const officeTypes = /* GraphQL */ `
  type Office {
    id: ID!
    name: String!
    address: String
    latitude: Float!
    longitude: Float!
    geofenceRadius: Int!
    isActive: Boolean!
  }

  input OfficeInput {
    name: String!
    address: String
    latitude: Float!
    longitude: Float!
    geofenceRadius: Int
  }
`;
