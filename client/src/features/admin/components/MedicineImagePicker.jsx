import { useNotification, GenericDialog } from '../../../shared/ui';
import AppButton from '../../../shared/ui/AppButton';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import { useRef, useState } from 'react';
import Webcam from 'react-webcam';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

// Must mirror the server contract in server/src/shared/utils/file-upload.util.ts
// (saveBase64MedicineImage): only jpeg/png/webp payloads, 3 MB decoded ceiling.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * MedicineImagePicker – product-photo widget for the medicine catalogue form.
 * OPTIONAL by design: staff never need a photo to raise a stock request.
 *
 * Props:
 *   value    – current data-url (or null)
 *   onChange – called with the new data-url, or null when removed
 *   disabled – freezes the control while a mutation is in flight
 */
const MedicineImagePicker = ({ value, onChange, disabled = false }) => {
  const notify = useNotification();
  const fileInputRef = useRef(null);
  const webcamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');

  // Snap the current webcam frame → data-url. Works on desktop (Mac webcam)
  // and mobile alike, unlike `capture` which desktops ignore.
  const takeSnapshot = () => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) {
      notify.warning('Could not capture the photo. Please allow camera access and try again.');
      return;
    }
    setCameraOpen(false);
    onChange?.(shot);
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      notify.warning('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <AppButton
            fullWidth
            variant="outlined"
            color="primary"
            startIcon={<AddPhotoAlternateIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Upload Image
          </AppButton>
          <AppButton
            fullWidth
            variant="outlined"
            color="primary"
            startIcon={<PhotoCameraIcon />}
            onClick={() => setCameraOpen(true)}
            disabled={disabled}
          >
            Take Photo
          </AppButton>
        </Stack>
      ) : (
        <Stack alignItems="center" spacing={1}>
          <Avatar
            src={value}
            alt="Medicine preview"
            variant="rounded"
            sx={{ width: 96, height: 96, border: '2px solid', borderColor: 'primary.main' }}
          />
          <AppButton
            size="small"
            variant="text"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => onChange?.(null)}
            disabled={disabled}
          >
            Remove Image
          </AppButton>
        </Stack>
      )}
      {!value && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Upload a file or snap a live photo · max 3 MB
        </Typography>
      )}

      {/* Gallery / file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {/* Live camera capture – real webcam (works on desktop + mobile) */}
      <GenericDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        title="Take Photo"
        maxWidth="xs"
        actions={
          <>
            <AppButton variant="text" onClick={() => setCameraOpen(false)}>Cancel</AppButton>
            <AppButton variant="contained" startIcon={<PhotoCameraIcon fontSize="small" />} onClick={takeSnapshot}>
              Capture
            </AppButton>
          </>
        }
      >
        <Box sx={{ textAlign: 'center' }}>
          <Paper
            elevation={0}
            sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden', bgcolor: 'text.primary', border: '1px solid', borderColor: 'divider' }}
          >
            {cameraOpen && (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <IconButton
              size="small"
              onClick={() => setFacingMode((p) => (p === 'user' ? 'environment' : 'user'))}
              sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
              aria-label="Switch camera"
            >
              <CameraswitchIcon fontSize="small" />
            </IconButton>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Allow camera access, frame the medicine pack, then Capture.
          </Typography>
        </Box>
      </GenericDialog>
    </Box>
  );
};

export default MedicineImagePicker;
