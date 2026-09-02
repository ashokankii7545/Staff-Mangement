import { useAppMutation, useAppQuery } from '../../../shared/hooks';
import React, { useState, useEffect, useCallback } from 'react';


import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import AdvancedLoader from '../../../shared/ui/AdvancedLoader';
import StatusBadge from '../../../shared/ui/StatusBadge';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import CloseIcon from '@mui/icons-material/Close';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import FaceIcon from '@mui/icons-material/Face';
import IconButton from '@mui/material/IconButton';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SelfieCapture from './SelfieCapture';
import FingerprintCapture from './FingerprintCapture';
import VPNWarningDialog from './VPNWarningDialog';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import { getWebRTCIPs } from '../../../shared/hooks/useWebRTC';
import { useFaceRecognition } from '../../../shared/hooks/useFaceRecognition';
import { useFingerprint } from '../../../shared/hooks/useFingerprint';
import { useAuth } from '../../../shared/auth/AuthContext';
import { CLOCK_IN, CLOCK_OUT } from '../../../graphql/mutations';
import { GET_TODAY_STATUS, GET_DASHBOARD_STATS, GET_WEEKLY_ATTENDANCE, GET_MY_ATTENDANCE, GET_PUBLIC_CONFIG } from '../../../graphql/queries';
import { useNotification } from '../../../shared/ui';

const AttendanceDialog = ({ open, onClose, type = 'CLOCK_IN' }) => {
  const notify = useNotification();
  const { location, error: _geoError, loading: _geoLoading, requestLocation } = useGeolocation();
  const { verifyFace } = useFaceRecognition();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [verifyingMsg, setVerifyingMsg] = useState('');
  const [vpnWarning, setVpnWarning] = useState({ open: false, message: '' });

  // Org-wide punch method (FACE / FINGERPRINT / BOTH) from public settings.
  const { data: configData } = useAppQuery(GET_PUBLIC_CONFIG);
  const attendanceMethod = user?.attendanceMethod || configData?.publicConfig?.attendanceMethod || 'FACE';

  // Which identity step to show when the admin allows BOTH.
  const [mode, setMode] = useState('FACE');
  useEffect(() => {
    if (open) setMode(attendanceMethod === 'FINGERPRINT' ? 'FINGERPRINT' : 'FACE');
  }, [open, attendanceMethod]);

  const {
    authenticateFingerprint,
    busy: scanning,
    browserSupported: fpSupported,
    errorMessage: fpError,
    clearError: clearFpError,
  } = useFingerprint();

  // Surface fingerprint errors (cancel, no passkey registered, etc.) once.
  useEffect(() => {
    if (fpError) {
      notify.error(fpError);
      clearFpError();
    }
  }, [fpError, notify.error, clearFpError]);

  const mutation = type === 'CLOCK_IN' ? CLOCK_IN : CLOCK_OUT;
  const [submitAttendance] = useAppMutation(mutation, {
    refetchQueries: [GET_TODAY_STATUS, GET_DASHBOARD_STATS, GET_WEEKLY_ATTENDANCE, GET_MY_ATTENDANCE],
    // Wait for todayStatus to refetch BEFORE the mutation resolves so the
    // ClockWidget flips to the correct Clock In/Out button immediately. Without
    // this there was a stale window where "Clock In" stayed visible after a
    // successful punch, letting a second click hit the server's
    // "You are already clocked in" guard.
    awaitRefetchQueries: true,
  });

  const isClockIn = type === 'CLOCK_IN';

  // Request GPS as soon as modal opens for instant readiness
  useEffect(() => {
    if (open) {
      requestLocation();
    }
  }, [open, requestLocation]);

  // Fast 3-Second Punch: Snapshot + Immediate Auto Submit.
  // `livenessFrames` is the head-turn burst SelfieCapture collects; the server
  // uses it for active liveness (browser no longer decides liveness).
  const handleCaptureAndPunch = useCallback(async (imageSrc, livenessFrames = []) => {
    if (!imageSrc) return;

    setSubmitting(true);
    setVerifyingMsg('Verifying your identity...');

    try {
      // Identity matching is decided SERVER-SIDE by the SFace face-service
      // (reliable, commercial-safe). The old browser face-api check against the
      // avatar was unreliable and wrongly flagged genuine staff, so it no longer
      // gates the punch. We keep ONE light client check: reject a capture with
      // NO detectable face at all (a useless frame), and prompt a retake.
      const presence = await verifyFace(imageSrc, user?.avatar);
      const noFaceInCapture =
        typeof presence.error === 'string' && presence.error.startsWith('No face detected');
      if (noFaceInCapture) {
        setSubmitting(false);
        setVerifyingMsg('');
        notify.error('No face detected. Please look at the camera and retake the photo.');
        return;
      }

      setVerifyingMsg('Acquiring secure location...');

      // Ensure GPS is ready
      let currentLoc = location;
      if (!currentLoc) {
        currentLoc = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            return reject(new Error('Geolocation is not supported by your browser'));
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
            (err) => reject(new Error(err.message || 'Please enable GPS/Location')),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }

      setVerifyingMsg('Checking VPN and Network...');

      // Collect WebRTC IPs for VPN check
      const webRTCIPs = await getWebRTCIPs();
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      setVerifyingMsg('Submitting punch...');
      const { data, error, errorMessage } = await submitAttendance({
        variables: {
          input: {
            selfieBase64: imageSrc,
            latitude: currentLoc.latitude,
            longitude: currentLoc.longitude,
            accuracy: currentLoc.accuracy || 20,
            browserTimezone,
            webRTCIPs,
            // Let the SERVER (SFace) decide the match. Sending null instead of the
            // browser's weak verdict so the server's result is authoritative.
            faceMatched: null,
            faceMatchScore: null,
            livenessFrames: Array.isArray(livenessFrames) ? livenessFrames : [],
          },
        },
      });

      if (error) {
        throw new Error(errorMessage || 'Failed to submit attendance');
      }

      const result = isClockIn ? data?.clockIn : data?.clockOut;
      if (!result) {
         throw new Error('Failed to parse backend response (data is null).');
      }

      if (result.success) {
        // Unique key defeats preventDuplicate so repeated punches always toast.
        notify.success(result.message || 'Attendance verified & marked successfully!', {
          key: `punch-${Date.now()}`,
        });
        // Close AFTER the snackbar is enqueued so an immediate unmount doesn't
        // swallow the confirmation toast.
        setTimeout(() => onClose(), 150);
      } else {
        // Punch call returned success:false (shouldn't normally happen, but
        // never leave the user without feedback).
        notify.warning(result.message || 'Punch could not be completed. Please try again.', {
          key: `punch-warn-${Date.now()}`,
        });
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to submit attendance';
      if (errorMsg.toLowerCase().includes('vpn') || errorMsg.toLowerCase().includes('proxy')) {
        setVpnWarning({ open: true, message: errorMsg });
      } else {
        notify.error(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [location, submitAttendance, isClockIn, notify.show, onClose]);

  // FINGERPRINT-mode punch: the DEVICE verifies the biometric (WebAuthn
  // assertion) and we submit the same GPS/VPN context as the face flow, with
  // the assertion in `webauthnResponse` (server re-verifies + updates lastUsed).
  const handleFingerprintPunch = useCallback(async () => {
    setSubmitting(true);
    setVerifyingMsg('Waiting for fingerprint...');
    try {
      const assertion = await authenticateFingerprint();
      if (!assertion) {
        // The fpError effect already surfaced the reason (cancel / no
        // passkey / unsupported browser). Just reset the local UI state.
        setSubmitting(false);
        setVerifyingMsg('');
        return;
      }

      setVerifyingMsg('Acquiring secure location...');

      // Ensure GPS is ready (same flow as the face punch)
      let currentLoc = location;
      if (!currentLoc) {
        currentLoc = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            return reject(new Error('Geolocation is not supported by your browser'));
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
            (err) => reject(new Error(err.message || 'Please enable GPS/Location')),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }

      setVerifyingMsg('Checking VPN and Network...');
      const webRTCIPs = await getWebRTCIPs();
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      setVerifyingMsg('Submitting punch...');
      const { data, error, errorMessage } = await submitAttendance({
        variables: {
          input: {
            latitude: currentLoc.latitude,
            longitude: currentLoc.longitude,
            accuracy: currentLoc.accuracy || 20,
            browserTimezone,
            webRTCIPs,
            // No selfie needed – the fingerprint assertion IS the identity.
            webauthnResponse: assertion,
          },
        },
      });

      if (error) {
        throw new Error(errorMessage || 'Failed to submit attendance');
      }

      const result = isClockIn ? data?.clockIn : data?.clockOut;
      if (!result) {
        throw new Error('Failed to parse backend response (data is null).');
      }

      if (result.success) {
        notify.success(result.message || 'Attendance verified & marked successfully!', {
          key: `punch-${Date.now()}`,
        });
        setTimeout(() => onClose(), 150);
      } else {
        notify.warning(result.message || 'Punch could not be completed. Please try again.', {
          key: `punch-warn-${Date.now()}`,
        });
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to submit attendance';
      if (errorMsg.toLowerCase().includes('vpn') || errorMsg.toLowerCase().includes('proxy')) {
        setVpnWarning({ open: true, message: errorMsg });
      } else {
        notify.error(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [authenticateFingerprint, location, submitAttendance, isClockIn, notify.show, notify.error, onClose]);

  return (
    <>
      <Dialog
        open={open}
        onClose={submitting ? undefined : onClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  bgcolor: isClockIn ? 'success.light' : 'warning.light',
                  color: isClockIn ? 'success.dark' : 'warning.dark',
                  p: 0.75,
                  borderRadius: 1.5,
                  display: 'flex',
                }}
              >
                {isClockIn ? <LoginIcon fontSize="small" /> : <LogoutIcon fontSize="small" />}
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'text.primary', lineHeight: 1.2 }}>
                  {isClockIn ? 'Shop Clock-In' : 'Shop Clock-Out'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  3-Second Fast Geofenced Punch
                </Typography>
              </Box>
            </Stack>
            {!submitting && (
              <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ px: 2, pb: 2, pt: 0 }}>
          <Stack spacing={1.5}>
            {/* GPS Live Status Pill */}
            <Box
              sx={{
                p: 1,
                borderRadius: 1.5,
                bgcolor: location ? 'success.light' : 'background.default',
                border: '1px solid',
                borderColor: location ? 'success.light' : 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                <LocationOnIcon sx={{ color: location ? 'success.main' : 'text.secondary', fontSize: 16 }} />
                <Typography variant="caption" sx={{ color: location ? 'success.dark' : 'text.secondary', fontWeight: 600 }}>
                  {location ? 'Store GPS Locked (High Accuracy)' : 'Locating Nearest Store...'}
                </Typography>
              </Stack>
              <StatusBadge
                label="Geofence Active"
                status="ACTIVE"
                size="small"
              />
            </Box>

            {/* Identity step: admin-chosen method (FACE / FINGERPRINT / BOTH).
                In BOTH mode staff can flip between the two at punch time. */}
            {attendanceMethod === 'BOTH' && !submitting && (
              <Stack direction="row" spacing={1} justifyContent="center">
                <Chip
                  icon={<FaceIcon />}
                  label="Face"
                  onClick={() => setMode('FACE')}
                  color={mode === 'FACE' ? 'primary' : 'default'}
                  variant={mode === 'FACE' ? 'filled' : 'outlined'}
                  size="small"
                />
                <Chip
                  icon={<FingerprintIcon />}
                  label="Fingerprint"
                  onClick={() => setMode('FINGERPRINT')}
                  color={mode === 'FINGERPRINT' ? 'primary' : 'default'}
                  variant={mode === 'FINGERPRINT' ? 'filled' : 'outlined'}
                  size="small"
                />
              </Stack>
            )}

            {submitting ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <AdvancedLoader isLoading={true} variant="spinner" size={36} sx={{ color: 'primary.main', mb: 2 }} />
                <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary' }}>
                  {verifyingMsg || 'Recording Punch...'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Please hold on for a moment
                </Typography>
              </Box>
            ) : attendanceMethod === 'FINGERPRINT' || (attendanceMethod === 'BOTH' && mode === 'FINGERPRINT') ? (
              <FingerprintCapture
                onScanVerified={handleFingerprintPunch}
                isScanning={scanning || submitting}
                browserSupported={fpSupported}
              />
            ) : (
              <SelfieCapture 
                onCapture={handleCaptureAndPunch} 
                isPunching={submitting} 
                allowUpload={false}
                requireCenteredFace={true}
                requireLiveness={true}
              />
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* VPN Warning Dialog */}
      <VPNWarningDialog
        open={vpnWarning.open}
        onClose={() => setVpnWarning({ open: false, message: '' })}
        message={vpnWarning.message}
      />
    </>
  );
};

export default AttendanceDialog;





