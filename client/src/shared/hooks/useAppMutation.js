import { useMutation } from '@apollo/client';
import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { mapApolloError } from '../auth/api/errors';

/**
 * useAppMutation – Enterprise wrapper around Apollo's `useMutation`.
 *
 * Adds on top of Apollo:
 *  - Normalized structured error (`{ type, message, code }`) + `errorMessage` string
 *  - Auto success-toast when `successMessage` is provided (static string or `(data) => string`)
 *  - Auto error-toast whenever the caller does NOT supply its own `onError`
 *    (fully backward compatible: existing manual `onError` handlers keep working untouched)
 *  - The execute function RESOLVES to `{ data, error, errorMessage }` – callers
 *    never need try/catch or `result.error` checking boilerplate.
 *
 * @example
 *   const [createStaff] = useAppMutation(REGISTER_STAFF, {
 *     successMessage: (d) => `${d.registerStaff.name} added successfully`,
 *     onCompleted: () => refetch(),        // still plain Apollo passthrough
 *   });
 *   const { error } = await createStaff({ variables }); // toast already shown
 *
 * @param {DocumentNode} mutation - GraphQL mutation document
 * @param {object} [options]
 * @param {string|Function} [options.successMessage] – Auto-toast text on success
 * @param {string} [options.successVariant='success']
 * @param {boolean} [options.silentError=false]      – Force-suppress auto error toast
 * @param {Function} [options.onSuccess]             – Called with response data after success
 * @param {...any} rest                               – Any Apollo `useMutation` option (onCompleted, refetchQueries, update…)
 *
 * @returns {[executeFn, result]}
 */
export function useAppMutation(mutation, options = {}) {
  const {
    successMessage,
    successVariant = 'success',
    silentError = false,
    onSuccess,
    ...apolloOptions
  } = options;

  // Respect a caller-provided onError: they own error UX in that case.
  const callerOwnsErrors = typeof options.onError === 'function';

  const { enqueueSnackbar } = useSnackbar();
  const [executeMutation, result] = useMutation(mutation, apolloOptions);

  const execute = useCallback(
    async (mutationOptions = {}) => {
      try {
        const response = await executeMutation(mutationOptions);
        const data = response?.data ?? null;

        if (successMessage && data) {
          enqueueSnackbar(
            typeof successMessage === 'function' ? successMessage(data) : successMessage,
            { variant: successVariant }
          );
        }
        onSuccess?.(data);

        return { data, error: null, errorMessage: '' };
      } catch (err) {
        const structuredError = mapApolloError(err);

        if (!silentError && !callerOwnsErrors) {
          enqueueSnackbar(structuredError.message, { variant: 'error' });
        }

        return {
          data: null,
          error: structuredError,
          errorMessage: structuredError.message,
        };
      }
    },
    [
      executeMutation,
      successMessage,
      successVariant,
      silentError,
      onSuccess,
      callerOwnsErrors,
      enqueueSnackbar,
    ]
  );

  const mappedResultError = result.error ? mapApolloError(result.error) : null;

  return [
    execute,
    {
      ...result,
      error: mappedResultError,
      errorMessage: mappedResultError ? mappedResultError.message : '',
    },
  ];
}

export default useAppMutation;
