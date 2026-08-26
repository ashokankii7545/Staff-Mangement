import { useAppMutation } from '../../../shared/hooks';
import React, { useState, useEffect, useCallback } from 'react';


import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import AdvancedLoader from '../../../shared/ui/AdvancedLoader';
import StatusBadge from '../../../shared/ui/StatusBadge';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SelfieCapture from './SelfieCapture';
import VPNWarningDialog from './VPNWarningDialog';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import { getWebRTCIPs } from '../../../shared/hooks/useWebRTC';
import { useFaceRecognition } from '../../../shared/hooks/useFaceRecognition';
import { useAuth } from '../../../shared/auth/AuthContext';
import { CLOCK_IN, CLOCK_OUT } from '../../../graphql/mutations';
import { GET_TODAY_STATUS, GET_DASHBOARD_STATS, GET_WEEKLY_ATTENDANCE, GET_MY_ATTENDANCE } from '../../../graphql/queries';
import { useNotification } from '../../../shared/ui';

const AttendanceDialog = ({ open, onClose, type = 'CLOCK_IN' }) => {
  const notify = useNotification();
  const { location, error: _geoError, loading: _geoLoading, requestLocation } = useGeolocation();
  const { verifyFace } = useFaceRecognition();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [verifyingMsg, setVerifyingMsg] = useState('');
  const [vpnWarning, setVpnWarning] = useState({ open: false, message: '' });

  const mutation = type === 'CLOCK_IN' ? CLOCK_IN : CLOCK_OUT;
  const [submitAttendance] = useAppMutation(mutation, {
    refetchQueries: [GET_TODAY_STATUS, GET_DASHBOARD_STATS, GET_WEEKLY_ATTENDANCE, GET_MY_ATTENDANCE],
  });

  const isClockIn = type === 'CLOCK_IN';

  // Request GPS as soon as modal opens for instant readiness
  useEffect(() => {
    if (open) {
      requestLocation();
    }
  }, [open, requestLocation]);

  // Fast 3-Second Punch: Snapshot + Immediate Auto Submit
  const handleCaptureAndPunch = useCallback(async (imageSrc) => {
    if (!imageSrc) return;

    setSubmitting(true);
    setVerifyingMsg('Verifying your identity...');

    try {
      // 1. Verify Face Identity
      const verification = await verifyFace(imageSrc, user?.avatar);

      const noFaceInCapture = typeof verification.error === 'string'
        && verification.error.startsWith('No face detected');

      if (!verification.match && noFaceInCapture) {
        // Useless capture - no face in frame at all, cannot attribute to a human
        setSubmitting(false);
        setVerifyingMsg('');
        notify.error(verification.error || 'No face detected. Please retake the photo.');
        return;
      }

      if (!verification.match) {
        // Mismatch / unreadable avatar -> do NOT hard-block (false positives lock
        // out genuine staff). Punch proceeds but server force-flags it PENDING.
        notify.warning('Face did not clearly match your profile photo. Punch recorded - an ADMIN will manually verify it.');
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
            faceMatched: !!verification.match,
            faceMatchScore: typeof verification.distance === 'number' ? verification.distance : null,
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
        notify.success(result.message || 'Attendance verified & marked successfully!');
        onClose();
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

            {/* Live Camera View with 1-Click Capture & Auto-Submit */}
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
            ) : (
              <SelfieCapture 
                onCapture={handleCaptureAndPunch} 
                isPunching={submitting} 
                allowUpload={false}
                requireCenteredFace={true}
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





