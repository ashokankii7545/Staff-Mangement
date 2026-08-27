import React from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';
import {
  Typography,
  IconButton,
  Alert,
  AlertTitle,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

export const useNotification = () => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const theme = useTheme();

  const show = (message, options = {}) => {
    const {
      variant = 'default',
      autoHideDuration = 5000,
      persist = false,
      action,
      anchorOrigin,
      title,
      key,
    } = options;

    const getIcon = () => {
      switch (variant) {
        case 'success':
          return <CheckCircleIcon fontSize="small" />;
        case 'error':
          return <ErrorIcon fontSize="small" />;
        case 'warning':
          return <WarningIcon fontSize="small" />;
        case 'info':
          return <InfoIcon fontSize="small" />;
        default:
          return null;
      }
    };

    const content = (
      <Alert
        severity={variant === 'default' ? 'info' : variant}
        icon={getIcon()}
        sx={{
          alignItems: 'center',
          boxShadow: theme.shadows[4],
          borderRadius: 1,
          minWidth: 300,
          pointerEvents: 'auto'
        }}
        action={
          action || (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                closeSnackbar();
              }}
              color="inherit"
              aria-label="close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )
        }
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        <Typography variant="body2">{message}</Typography>
      </Alert>
    );

    enqueueSnackbar(message, {
      variant,
      // A caller-supplied key defeats the provider's preventDuplicate so that
      // repeating the SAME message (e.g. two punches in a row) still toasts.
      ...(key !== undefined ? { key, preventDuplicate: false } : {}),
      autoHideDuration: persist ? null : autoHideDuration,
      anchorOrigin: anchorOrigin || { vertical: 'top', horizontal: 'right' },
      content: (snackKey) => React.cloneElement(content, {
        onClick: () => closeSnackbar(snackKey),
      }),
    });
  };

  const success = (message, options) => show(message, { ...options, variant: 'success' });
  const error = (message, options) => show(message, { ...options, variant: 'error' });
  const warning = (message, options) => show(message, { ...options, variant: 'warning' });
  const info = (message, options) => show(message, { ...options, variant: 'info' });
  const default_ = (message, options) => show(message, { ...options, variant: 'default' });

  return { show, success, error, warning, info, default: default_, closeSnackbar };
};

export const AppNotificationProvider = ({ children }) => {
  return (
    <SnackbarProvider
      maxSnack={5}
      autoHideDuration={5000}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      preventDuplicate
      dense
      style={{ pointerEvents: 'none' }}
    >
      {children}
    </SnackbarProvider>
  );
};
