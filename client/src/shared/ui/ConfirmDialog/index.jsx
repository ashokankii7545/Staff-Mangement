import React, { useState, forwardRef } from 'react';
import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import AppButton from '../AppButton';

/**
 * ConfirmDialog – "Are you sure?" action confirmation modal.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={confirmOpen}
 *     onClose={() => setConfirmOpen(false)}
 *     onConfirm={handleDelete}
 *     title="Delete Holiday"
 *     description="This holiday will be permanently removed. This action cannot be undone."
 *     confirmText="Delete"
 *     variant="danger"
 *     loading={deleting}
 *   />
 */
const ConfirmDialog = forwardRef(({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed? This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  inputConfirmation = '',
  loading = false,
  icon: CustomIcon,
  children,
  sx,
  ...rest
}, ref) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';
  const isInfo = variant === 'info';
  const isSuccess = variant === 'success';

  const defaultIcon = isSuccess
    ? CheckCircleOutlineIcon
    : isInfo
      ? InfoOutlinedIcon
      : WarningAmberIcon;
  const Icon = CustomIcon || defaultIcon;

  const getIconColors = () => {
    if (isWarning) return { bg: 'warning.lighter', color: 'warning.main' };
    if (isInfo) return { bg: 'info.lighter', color: 'info.main' };
    if (isSuccess) return { bg: 'success.lighter', color: 'success.main' };
    return { bg: 'error.lighter', color: 'error.main' };
  };
  const iconColors = getIconColors();

  const handleConfirm = async (e) => {
    if (typeof onConfirm !== 'function') return;
    const result = onConfirm(e);
    if (result instanceof Promise) {
      setInternalLoading(true);
      try {
        await result;
      } finally {
        setInternalLoading(false);
        if (onClose && inputConfirmation) setInputValue(''); // reset input after successful confirm
      }
    }
  };

  const handleClose = (e, reason) => {
    if (internalLoading || loading) return;
    setInputValue('');
    if (onClose) onClose(e, reason);
  };

  const isConfirmDisabled = (inputConfirmation && inputValue !== inputConfirmation) || internalLoading || loading;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, ...sx } }}
      ref={ref}
      {...rest}
    >
      <DialogTitle sx={{ pb: 0.5, pt: 2.5, px: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              bgcolor: iconColors.bg,
              color: iconColors.color,
              p: 1,
              borderRadius: 1.5,
              display: 'flex',
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Typography variant="h6" fontWeight={600} sx={{ color: 'text.primary' }}>
            {title}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 1.5, pb: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: inputConfirmation || children ? 2 : 0 }}>
          {description}
        </Typography>
        {/* Extra content between the message and the actions (extra fields etc.) */}
        {children}
        {inputConfirmation && (
          <TextField
            fullWidth
            size="small"
            placeholder={`Type "${inputConfirmation}" to confirm`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={internalLoading || loading}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <AppButton
          variant="outlined"
          color="inherit"
          onClick={handleClose}
          disabled={internalLoading || loading}
        >
          {cancelText}
        </AppButton>
        <AppButton
          color={isDanger ? 'error' : isWarning ? 'warning' : isSuccess ? 'success' : 'primary'}
          loading={internalLoading || loading}
          onClick={handleConfirm}
          disabled={isConfirmDisabled}
        >
          {confirmText}
        </AppButton>
      </DialogActions>
    </Dialog>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.node,
  description: PropTypes.node,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.oneOf(['danger', 'warning', 'info', 'success']),
  inputConfirmation: PropTypes.string,
  loading: PropTypes.bool,
  icon: PropTypes.elementType,
  children: PropTypes.node,
  sx: PropTypes.object,
};

export default ConfirmDialog;
