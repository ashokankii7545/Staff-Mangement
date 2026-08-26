import { GraphQLDate, GraphQLDateTime } from 'graphql-scalars';
import type { GraphQLScalarType } from 'graphql';

/**
 * Scalar implementations for the SDL-declared Date / DateTime leaf types.
 * graphql-scalars handles ISO parsing & serialization consistently.
 */
export const customScalars: Record<string, GraphQLScalarType> = {
  DateTime: GraphQLDateTime,
  Date: GraphQLDate,
};
