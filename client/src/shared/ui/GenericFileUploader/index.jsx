import React, { useRef, useState } from 'react';
import { Box, Typography, IconButton, LinearProgress, Stack, Paper, List, ListItem } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useDrop, useUnmount } from '../../hooks';

/**
 * GenericFileUploader – Enterprise drop-zone uploader.
 *
 * Features:
 *  - Drag & drop via ahooks `useDrop` (no manual event juggling)
 *  - Single or multiple file selection
 *  - Size + extension validation with friendly inline errors
 *  - Image previews (object URLs auto-revoked on unmount)
 *  - Uploading progress slot for parent-driven uploads
 */
export const GenericFileUploader = ({
  onFilesSelect,
  multiple = false,
  maxSizeMB = 5,
  acceptedTypes = 'image/*,application/pdf',
  title = 'Upload File',
  subtitle,
  uploading = false,
  progress = 0,
}) => {
  const inputRef = useRef(null);
  const objectUrlsRef = useRef([]);
  const [selected, setSelected] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);

  // ahooks useUnmount – revoke preview URLs deterministically
  useUnmount(() => {
    objectUrlsRef.current.forEach((url) => url && URL.revokeObjectURL(url));
  });

  const getValidationError = (file) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `"${file.name}" exceeds the ${maxSizeMB}MB limit.`;
    }
    if (acceptedTypes && !isAccepted(file, acceptedTypes)) {
      return `"${file.name}" is not an accepted file type.`;
    }
    return null;
  };

  // ahooks useDrop – declarative drag & drop state machine
  const [dropProps, { isHovering }] = useDrop({
    onFiles: (files) => handleFiles(Array.from(files || [])),
  });

  const handleFiles = (incoming) => {
    if (!incoming?.length) return;
    const errors = [];
    const valid = [];
    incoming.forEach((file) => {
      const err = getValidationError(file);
      if (err) errors.push(err);
      else valid.push(file);
    });

    setValidationErrors(errors);

    if (!valid.length) {
      setSelected([]);
      onFilesSelect?.(multiple ? [] : null);
      return;
    }

    const next = multiple ? valid : valid.slice(0, 1);
    setSelected(next);
    onFilesSelect?.(multiple ? next : next[0]);
  };

  const removeFile = (index) => {
    const next = selected.filter((_, i) => i !== index);
    setSelected(next);
    setValidationErrors([]);
    onFilesSelect?.(multiple ? next : next[0] ?? null);
    if (inputRef.current && next.length === 0) inputRef.current.value = '';
  };

  const previewFor = (file, idx) => {
    if (!file.type.startsWith('image/')) {
      return (
        <Box sx={{ p: 0.75, bgcolor: 'action.hover', borderRadius: 1.5, display: 'flex' }}>
          <InsertDriveFileOutlinedIcon color="primary" fontSize="small" />
        </Box>
      );
    }
    let url = objectUrlsRef.current[idx];
    if (!url) {
      url = URL.createObjectURL(file);
      objectUrlsRef.current[idx] = url;
    }
    return (
      <Box
        component="img"
        src={url}
        alt={file.name}
        sx={{ width: 44, height: 44, borderRadius: 1.5, objectFit: 'cover', border: '1px solid', borderColor: 'divider' }}
      />
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        variant="outlined"
        {...dropProps}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        sx={{
          p: selected.length ? 2 : 3,
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isHovering ? 'primary.main' : 'divider',
          bgcolor: isHovering ? 'action.hover' : 'background.paper',
          cursor: uploading ? 'progress' : 'pointer',
          textAlign: selected.length ? 'left' : 'center',
          transition: 'all 0.2s ease',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes}
          multiple={multiple}
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          style={{ display: 'none' }}
        />

        {!selected.length ? (
          <Stack spacing={1} alignItems="center">
            <CloudUploadIcon color="primary" sx={{ fontSize: 40, opacity: 0.85 }} />
            <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle || (multiple ? 'Drag & drop files or click to browse' : 'Drag & drop a file or click to browse')}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
              Max {maxSizeMB}MB per file{multiple ? '' : ' • single file'}
            </Typography>
          </Stack>
        ) : (
          <List dense disablePadding>
            {selected.map((file, idx) => (
              <ListItem
                key={`${file.name}-${idx}`}
                secondaryAction={
                  !uploading ? (
                    <IconButton size="small" edge="end" onClick={() => removeFile(idx)} aria-label={`Remove ${file.name}`}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  ) : null
                }
              >
                {previewFor(file, idx)}
                <Box sx={{ flex: 1, minWidth: 0, ml: 1.5 }}>
                  <Typography variant="body2" fontWeight={500} noWrap>{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                  {uploading && (
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, Math.max(0, progress))}
                      sx={{ mt: 0.75, height: 6, borderRadius: 3 }}
                    />
                  )}
                </Box>
              </ListItem>
            ))}
            {multiple && (
              <ListItem
                button
                component="div"
                onClick={() => inputRef.current?.click()}
                sx={{ justifyContent: 'center', mt: 0.5 }}
              >
                <Typography variant="caption" color="primary">+ Add more</Typography>
              </ListItem>
            )}
          </List>
        )}
      </Paper>

      {validationErrors.map((err) => (
        <Typography key={err} color="error" variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          {err}
        </Typography>
      ))}
    </Box>
  );

};

/** Checks a File against an HTML accept-string ("image/*,application/pdf,.docx") */
const isAccepted = (file, accept) => {
  const tokens = accept.split(',').map((t) => t.trim().toLowerCase());
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return tokens.some((token) => {
    if (!token) return false;
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
};

export default GenericFileUploader;
