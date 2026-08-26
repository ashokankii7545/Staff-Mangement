import { useNotification } from '../../../shared/ui';
import AppButton from '../../../shared/ui/AppButton';
import GenericDialog from '../../../shared/ui/GenericDialog';
import SelfieCapture from '../../attendance/components/SelfieCapture';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import {useRef,useState} from 'react';
// Must mirror the server contract in server/src/utils/fileUpload.js (saveBase64Image):
// only jpeg/png/webp payloads, 3 MB decoded ceiling per image.
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * StaffPhotoPicker – ONE consistent profile-photo widget for every
 * staff-onboarding dialog (Add Staff + Quick Onboard).
 *
 * Layout contract (always centred, always the same height rhythm):
 *   • No photo yet → two EQUAL-WIDTH buttons in one row:
 *       [ 📷 Take Photo ]  [ 📤 Upload Image ]
 *   • Photo ready  → 96px avatar preview + [Retake] [Remove]
 *   "Take Photo" opens the camera inside a nested dialog, so the form
 *   underneath never shifts or reflows while picking a picture.
 *
 * Props:
 *   value    – current data-url (or null)
 *   onChange – called with the new data-url, or null when removed
 *   disabled – freezes the control while a mutation is in flight
 */
const StaffPhotoPicker = ({ value, onChange, disabled = false }) => {
  const notify = useNotification();
  const fileInputRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  /** Device-upload path – same data-url pipeline as the camera */
  const handlePhotoFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    // Guard against files the server would reject (saveBase64Image throws otherwise)
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      notify.warning('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      notify.warning(`"${file.name}" is too large – maximum allowed size is 3 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange?.(reader.result);
    reader.onerror = () => notify.error('Could not read the selected image. Please try another file.');
    reader.readAsDataURL(file);
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      {!value ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center">
          <AppButton
            variant="outlined"
            color="primary"
            startIcon={<PhotoCameraIcon />}
            onClick={() => setCameraOpen(true)}
            disabled={disabled}
            sx={{ flex: 1 }}
          >
            Click Image
          </AppButton>
          <AppButton
            variant="outlined"
            color="primary"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            sx={{ flex: 1 }}
          >
            Upload Image
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handlePhotoFile}
      />

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
