import { useNotification } from '../../../shared/ui';
import AppButton from '../../../shared/ui/AppButton';
import GenericDialog from '../../../shared/ui/GenericDialog';
import SelfieCapture from '../../attendance/components/SelfieCapture';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import { useState } from 'react';

/**
 * StaffPhotoPicker – ONE consistent profile-photo widget for every
 * staff-onboarding dialog (Add Staff + Quick Onboard).
 *
 * Layout contract (always centred, always the same height rhythm):
 *   • No photo yet -> [ 📷 Click Image ] (Upload removed per user request)
 *   • Photo ready  -> 96px avatar preview + [Retake] [Remove]
 *   "Take Photo" opens the camera inside a nested dialog, so the form
 *   underneath never shifts or reflows while picking a picture.
 *
 * Props:
 *   value    – current data-url (or null)
 *   onChange – called with the new data-url, or null when removed
 *   disabled – freezes the control while a mutation is in flight
 */
const StaffPhotoPicker = ({ value, onChange, disabled = false }) => {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <Box sx={{ textAlign: 'center' }}>
      {!value ? (
        <Stack direction="row" spacing={1} justifyContent="center">
          <AppButton
            variant="outlined"
            color="primary"
            startIcon={<PhotoCameraIcon />}
            onClick={() => setCameraOpen(true)}
            disabled={disabled}
            fullWidth
          >
            Click Image (Live Camera)
          </AppButton>
        </Stack>
      ) : (
        <Stack alignItems="center" spacing={1}>
          <Avatar
            src={value}
            alt="Profile preview"
            sx={{ width: 96, height: 96, border: '2px solid', borderColor: 'primary.main' }}
          />
          <Stack direction="row" spacing={1} justifyContent="center">
            <AppButton
              size="small"
              variant="text"
              startIcon={<PhotoCameraIcon />}
              onClick={() => setCameraOpen(true)}
              disabled={disabled}
            >
              Retake
            </AppButton>
            <AppButton
              size="small"
              variant="text"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => onChange?.(null)}
              disabled={disabled}
            >
              Remove
            </AppButton>
          </Stack>
        </Stack>
      )}

      <GenericDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        title="Capture Profile Photo"
        maxWidth="xs"
      >
        <SelfieCapture
          onCapture={(pic) => { onChange?.(pic); setCameraOpen(false); }}
          isPunching={false}
          buttonText="Capture & Save"
          requireCenteredFace // staff baseline photo feeds punch-time face matching
        />
      </GenericDialog>
    </Box>
  );
};

export default StaffPhotoPicker;
