import { GraphQLError, Kind, GraphQLScalarType } from 'graphql';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * LENIENT DATE SCALARS – migration-safe replacements for graphql-scalars
 * ────────────────────────────────────────────────────────────────────────────
 * The OLD backend declared Date/DateTime as bare pass-through scalars, so the
 * client could send "YYYY-MM-DD", full ISO, anything. Swapping in strict
 * library scalars silently BROKE temp-duty/leave/holiday forms that submit
 * plain dates. These versions:
 *   • ACCEPT  date-only ("2026-08-26") AND full ISO ("2026-08-26T09:30:00Z")
 *   • RETURN  real Date objects to resolvers/mongoose (same as before)
 *   • SERIALIZE back to ISO strings (same wire format clients already render)
 */

const toDate = (value: unknown, scalarName: string): Date => {
  if (value instanceof Date) return value;
  const raw = typeof value === 'number' ? new Date(value) : new Date(String(value).trim());
  if (Number.isNaN(raw.getTime())) {
    throw new GraphQLError(`${scalarName} cannot represent an invalid date: ${String(value)}`);
  }
  return raw;
};

const parseLiteralValue = (ast: any, scalarName: string): Date => {
  if (ast.kind === Kind.STRING) return toDate(ast.value, scalarName);
  if (ast.kind === Kind.INT) return toDate(Number(ast.value), scalarName);
  throw new GraphQLError(`${scalarName} must be provided as a string`);
};

/** Accepts date-only or full ISO; hands a Date to resolvers; emits ISO. */
export const GraphQLDateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO datetime – date-only strings ("YYYY-MM-DD") are also accepted',
  parseValue: (value) => toDate(value, 'DateTime'),
  serialize: (value) => toDate(value, 'DateTime').toISOString(),
  parseLiteral: (ast) => parseLiteralValue(ast, 'DateTime'),
});

/** Same contract as DateTime – kept separate so SDL stays self-documenting. */
export const GraphQLDate = new GraphQLScalarType({
  name: 'Date',
  description: 'Calendar date – accepts "YYYY-MM-DD" or full ISO timestamps',
  parseValue: (value) => toDate(value, 'Date'),
  serialize: (value) => toDate(value, 'Date').toISOString(),
  parseLiteral: (ast) => parseLiteralValue(ast, 'Date'),
});

export const customScalars: Record<string, GraphQLScalarType> = {
  DateTime: GraphQLDateTime,
  Date: GraphQLDate,
};

