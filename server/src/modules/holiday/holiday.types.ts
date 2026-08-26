export const holidayTypes = /* GraphQL */ `
  type Holiday {
    id: ID!
    name: String!
    date: Date!
    description: String
    type: HolidayType!
    isActive: Boolean!
    createdAt: DateTime
  }

  input HolidayInput {
    name: String!
    date: Date!
    description: String
    type: HolidayType
  }
`;
