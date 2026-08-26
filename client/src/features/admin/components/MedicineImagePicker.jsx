import { useNotification } from '../../../shared/ui';
import AppButton from '../../../shared/ui/AppButton';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
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
        <AppButton
          fullWidth
          variant="outlined"
          color="primary"
          startIcon={<AddPhotoAlternateIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          Upload Image (Optional)
        </AppButton>
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
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          JPG, PNG or WebP · max 3 MB
        </Typography>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </Box>
  );
};

export default MedicineImagePicker;
