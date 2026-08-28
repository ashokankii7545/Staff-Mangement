export const salaryTypes = /* GraphQL */ `
  """Employer-issued payroll record for one month (admin-managed, staff read-only)"""
  type SalaryRecord {
    id: ID!
    userId: ID!
    """Payroll month in YYYY-MM format"""
    month: String!
    basic: Float!
    hra: Float!
    allowances: Float!
    deductions: Float!
    """Server-computed: basic + hra + allowances - deductions"""
    netPay: Float!
    notes: String
    createdAt: DateTime
  }

  input SalaryRecordInput {
    month: String!
    basic: Float!
    hra: Float
    allowances: Float
    deductions: Float
    notes: String
  }

  """Employer-issued one-time bonus (admin-managed, staff read-only)"""
  type BonusRecord {
    id: ID!
    userId: ID!
    """Bonus month in YYYY-MM format"""
    month: String!
    amount: Float!
    reason: String
    createdAt: DateTime
  }

  input BonusRecordInput {
    month: String!
    amount: Float!
    reason: String
  }
`;
