import { useQuery } from '@apollo/client';
import { useMemo, useRef, useEffect } from 'react';
import { mapApolloError } from '../auth/api/errors';

/**
 * useAppQuery – Enterprise wrapper around Apollo's `useQuery`.
 *
 * Adds on top of Apollo:
 *  - Normalized structured error (`{ type, message, code }`) via mapApolloError
 *  - `errorMessage` convenience string
 *  - Optional automatic retry with linear backoff for transient failures
 *
 * @example
 *   const { data, loading, errorMessage } = useAppQuery(GET_USERS, { retry: 2 });
 *
 * @param {DocumentNode} query - GraphQL query document
 * @param {object} [options]
 * @param {number}  [options.retry=0]                – Max automatic retries per failure streak
 * @param {boolean} [options.retryNetworkOnly=true] – Only retry network-level errors when true
 * @param {...any}  rest                             – Any Apollo `useQuery` option (passthrough)
 *
 * @returns Apollo result object + { error: structuredError|null, errorMessage: string }
 */
export function useAppQuery(query, options = {}) {
  const { retry = 0, retryNetworkOnly = true, ...apolloOptions } = options;

  const result = useQuery(query, apolloOptions);
  const { error, refetch } = result;
  const retryCountRef = useRef(0);

  useEffect(() => {
    // Recovered → reset the retry budget for the next failure streak.
    if (!error) {
      retryCountRef.current = 0;
      return undefined;
    }

    if (retryCountRef.current >= retry) return undefined;

    const isNetworkError = Boolean(error.networkError);
    if (retryNetworkOnly && !isNetworkError) return undefined;

    retryCountRef.current += 1;
    const timer = setTimeout(() => refetch?.(), 800 * retryCountRef.current);

    return () => clearTimeout(timer);
  }, [error, retry, retryNetworkOnly, refetch]);

  const structuredError = useMemo(
    () => (result.error ? mapApolloError(result.error) : null),
    [result.error]
  );

  return {
    ...result,
    error: structuredError,
    errorMessage: structuredError?.message ?? '',
  };
}

export default useAppQuery;
