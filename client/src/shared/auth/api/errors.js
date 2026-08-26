/**
 * Standardized Apollo Error Mapper
 */

export const mapApolloError = (error) => {
  if (!error) return null;

  // If it's a network error
  if (error.networkError) {
    return {
      type: 'NETWORK_ERROR',
      message: 'Network connection failed. Please check your internet connection.',
      originalError: error.networkError,
    };
  }

  // If there are GraphQL errors
  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    const firstError = error.graphQLErrors[0];
    const extensions = firstError.extensions || {};
    
    // Check for authorization issues
    if (extensions.code === 'UNAUTHENTICATED' || firstError.message.toLowerCase().includes('not authenticated')) {
      return {
        type: 'AUTH_ERROR',
        message: 'Your session has expired. Please log in again.',
        code: extensions.code,
      };
    }

    return {
      type: 'GRAPHQL_ERROR',
      message: firstError.message || 'An error occurred while processing your request.',
      code: extensions.code || 'UNKNOWN',
    };
  }

  // Fallback
  return {
    type: 'UNKNOWN_ERROR',
    message: error.message || 'An unexpected error occurred.',
  };
};

