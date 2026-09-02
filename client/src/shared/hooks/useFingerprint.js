import { useCallback, useMemo, useState } from 'react';
import { browserSupportsWebAuthn, startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useAppMutation } from './useAppMutation';
import {
  BEGIN_FINGERPRINT_REGISTRATION,
  COMPLETE_FINGERPRINT_REGISTRATION,
  BEGIN_FINGERPRINT_AUTHENTICATION,
  REMOVE_FINGERPRINT,
} from '../../graphql/mutations';

/**
 * useFingerprint – WebAuthn (passkey) ceremonies for FINGERPRINT attendance.
 *
 * The actual fingerprint/Face-ID/PIN scan is done BY THE DEVICE after the
 * browser shows its native prompt. This hook only drives the two round trips:
 *   1. begin → server mints a one-time challenge
 *   2. complete → the signed response is verified server-side
 *
 * Punch flow uses `authenticateFingerprint()` to obtain a JSON assertion which
 * is then passed straight into CLOCK_IN / CLOCK_OUT as `webauthnResponse`.
 */
export const useFingerprint = () => {
  const [beginRegistration] = useAppMutation(BEGIN_FINGERPRINT_REGISTRATION, { silentError: true });
  const [completeRegistration] = useAppMutation(COMPLETE_FINGERPRINT_REGISTRATION, { silentError: true });
  const [beginAuthentication] = useAppMutation(BEGIN_FINGERPRINT_AUTHENTICATION, { silentError: true });
  const [removeMutation] = useAppMutation(REMOVE_FINGERPRINT, { silentError: true });

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  /** Secure-context + WebCrypto + credential APIs present? */
  const browserSupported = useMemo(
    () => (typeof window !== 'undefined' ? browserSupportsWebAuthn() : false),
    [],
  );

  const clearError = useCallback(() => setErrorMessage(''), []);

  /**
   * Register this phone/laptop as an attendance fingerprint for the user.
   * Returns `{ success, message, passkeys } | null` (null → see errorMessage).
   */
  const registerFingerprint = useCallback(async () => {
    setBusy(true);
    setErrorMessage('');
    try {
      const beginResult = await beginRegistration();
      const payload = beginResult.data?.beginFingerprintRegistration;
      if (!payload || beginResult.error) {
        throw new Error(beginResult.error?.message || 'Could not start fingerprint registration.');
      }

      const optionsJSON = JSON.parse(payload.optionsJson);
      const attestationResponse = await startRegistration({ optionsJSON });

      const completeResult = await completeRegistration({
        variables: { responseJson: JSON.stringify(attestationResponse) },
      });
      const done = completeResult.data?.completeFingerprintRegistration;
      if (completeResult.error || !done?.success) {
        throw new Error(completeResult.error?.message || 'Fingerprint registration could not be verified.');
      }
      return done;
    } catch (err) {
      // User cancelled the native prompt → friendly message, not an error stack.
      setErrorMessage(err?.message || 'Fingerprint registration was cancelled or failed.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [beginRegistration, completeRegistration]);

  /**
   * Ask the device to verify the staff member's fingerprint/Face-ID/PIN.
   * Returns the server-ready assertion JSON string (pass to ClockInput.webauthnResponse)
   * or null → see errorMessage.
   */
  const authenticateFingerprint = useCallback(async () => {
    setBusy(true);
    setErrorMessage('');
    try {
      const beginResult = await beginAuthentication();
      const payload = beginResult.data?.beginFingerprintAuthentication;
      if (beginResult.error || !payload) {
        throw new Error(beginResult.error?.message || 'Could not start fingerprint check.');
      }
      if (!payload.hasPasskey) {
        throw new Error('No fingerprint registered on this account yet.');
      }

      const optionsJSON = JSON.parse(payload.optionsJson);
      const assertion = await startAuthentication({ optionsJSON });
      return JSON.stringify(assertion);
    } catch (err) {
      setErrorMessage(err?.message || 'Fingerprint verification was cancelled or failed.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [beginAuthentication]);

  /** Forget a specific device credential. Returns `removeFingerprint` payload. */
  const removeFingerprint = useCallback(
    async (credentialId) => {
      setBusy(true);
      setErrorMessage('');
      try {
        const result = await removeMutation({ variables: { credentialId } });
        if (result.error) throw new Error(result.error.message || 'Could not remove fingerprint.');
        return result.data?.removeFingerprint ?? null;
      } catch (err) {
        setErrorMessage(err?.message || 'Could not remove fingerprint.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [removeMutation],
  );

  return {
    registerFingerprint,
    authenticateFingerprint,
    removeFingerprint,
    browserSupported,
    busy,
    errorMessage,
    clearError,
  };
};

export default useFingerprint;