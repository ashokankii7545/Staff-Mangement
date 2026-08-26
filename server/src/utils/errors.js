import { GraphQLError } from 'graphql';

export const AuthenticationError = (message = 'Authentication required') => {
  return new GraphQLError(message, {
    extensions: { code: 'UNAUTHENTICATED' },
  });
};

export const ForbiddenError = (message = 'Access denied') => {
  return new GraphQLError(message, {
    extensions: { code: 'FORBIDDEN' },
  });
};

export const ValidationError = (message = 'Validation failed') => {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT' },
  });
};

export const VPNDetectedError = (message = 'VPN or Proxy detected') => {
  return new GraphQLError(message, {
    extensions: { code: 'VPN_DETECTED' },
  });
};

export const GeofenceError = (message = 'Outside geofence boundary') => {
  return new GraphQLError(message, {
    extensions: { code: 'GEOFENCE_VIOLATION' },
  });
};
