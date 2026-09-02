import AppButton from '../../../shared/ui/AppButton';
import React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import FingerprintIcon from '@mui/icons-material/Fingerprint';

/**
 * FingerprintCapture – the identity step for FINGERPRINT-mode punches.
 *
 * The actual biometric scan happens in the DEVICE's native prompt (phone
 * fingerprint / Face ID / Windows Hello / PIN). This component just drives the
 * flow and shows crystal-clear guidance:
 *   - tap the button → native scan prompt appears
 *   - done → onScanVerified(webauthnResponseJson) is called → punch submits
 *
 * When the browser has no secure-context / credential APIs we surface a
 * warning instead of a dead button so the staff member knows to switch to Face.
 */
const FingerprintCapture = ({
  onScanVerified,
  isScanning = false,
  browserSupported = true,
  buttonText = 'Scan Fingerprint & Punch',
}) => {
  return (
    <Stack spacing={2}>
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          p: 3,
          textAlign: 'center',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          borderColor: isScanning ? 'primary.main' : 'divider',
          boxShadow: isScanning ? '0 0 24px rgba(25,118,210,0.25)' : 'none',
        }}
      >
        <FingerprintIcon
          sx={{
            fontSize: 72,
            mb: 1,
            color: isScanning ? 'primary.main' : 'text.disabled',
            animation: isScanning ? 'fp-pulse 1.2s ease-in-out infinite' : 'none',
            '@keyframes fp-pulse': {
              '0%, 100%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.08)' },
            },
          }}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          {isScanning
            ? 'Waiting for your fingerprint…'
            : 'A device prompt will appear – scan your fingerprint to confirm identity'}
        </Typography>
        {!browserSupported && (
          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
            Your browser/device does not support fingerprint scanning. Ask your admin to switch your
            attendance method to Face, or use a phone/laptop with a fingerprint or Face ID sensor.
          </Alert>
        )}
      </Paper>

      <AppButton
        fullWidth
        variant="contained"
        onClick={onScanVerified}
        disabled={isScanning}
        loading={isScanning}
        sx={{
          bgcolor: 'primary.main',
          color: 'background.paper',
          fontWeight: 700,
          py: 1.2,
          fontSize: '0.9375rem',
          borderRadius: 2,
        }}
      >
        <FingerprintIcon sx={{ fontSize: 18, mr: 1, verticalAlign: 'text-bottom' }} />
        {isScanning ? 'Scanning…' : buttonText}
      </AppButton>
    </Stack>
  );
};

export default FingerprintCapture;