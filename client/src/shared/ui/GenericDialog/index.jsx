import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { AdvancedLoader } from '../AdvancedLoader';

/**
 * GenericDialog – Enterprise-grade modal dialog system.
 *
 * Supports standard modals, fullscreen on mobile, multi-step wizards,
 * loading overlays, and header action slots.
 *
 * Usage:
 *   // Basic
 *   <GenericDialog open={open} onClose={close} title="Edit Staff">
 *     <form>...</form>
 *   </GenericDialog>
 *
 *   // With loading overlay
 *   <GenericDialog open={open} onClose={close} title="Processing" loading={saving}>
 *     ...
 *   </GenericDialog>
 *
 *   // Multi-step wizard
 *   <GenericDialog
 *     open={open}
 *     onClose={close}
 *     title="Setup Wizard"
 *     steps={['Account', 'Profile', 'Confirm']}
 *     activeStep={step}
 *   >
 *     {step === 0 && <AccountForm />}
 *     {step === 1 && <ProfileForm />}
 *     {step === 2 && <ConfirmForm />}
 *   </GenericDialog>
 *
 *   // Fullscreen on mobile (auto)
 *   <GenericDialog open={open} onClose={close} title="Details" mobileFullscreen>
 *     ...
 *   </GenericDialog>
 */
const GenericDialog = forwardRef(({
  open,
  onClose,
  title,
  subtitle,
  headerActions,
  children,
  actions,
  dividers = true,
  maxWidth = 'sm',
  fullWidth = true,

  // Enterprise features
  loading = false,
  mobileFullscreen = false,
  disableCloseOnLoading = true,

  // Stepper / Wizard mode
  steps,
  activeStep = 0,

  // Styling
  sx,
  contentSx,
  ...dialogProps
}, ref) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const useFullscreen = mobileFullscreen && isMobile;

  const handleClose = (...args) => {
    if (loading && disableCloseOnLoading) return;
    onClose?.(...args);
  };

  return (
    <Dialog
      ref={ref}
      open={open}
      onClose={handleClose}
      maxWidth={useFullscreen ? false : maxWidth}
      fullWidth={fullWidth}
      fullScreen={useFullscreen}
      PaperProps={{
        sx: {
          borderRadius: useFullscreen ? 0 : 2.5,
          position: 'relative',
          overflow: 'hidden',
          ...sx,
        },
        ...dialogProps.PaperProps,
      }}
      {...dialogProps}
    >
      {/* LOADING OVERLAY – enterprise frosted loader */}
      <Fade in={loading} unmountOnExit>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.7)',
            zIndex: 10,
            backdropFilter: 'blur(2px)',
            ...theme.applyStyles?.('dark', {
              bgcolor: 'rgba(0,0,0,0.5)',
            }),
          }}
        >
          <AdvancedLoader isLoading variant="gradient" size={36} />
        </Box>
      </Fade>

      {/* HEADER SECTION */}
      {title && (
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            p: 2.5,
            pb: steps ? 1.5 : 2.5,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" component="div" noWrap sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, flexShrink: 0 }}>
            {headerActions}
            {onClose && (
              <IconButton
                aria-label="close dialog"
                onClick={handleClose}
                disabled={loading && disableCloseOnLoading}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </DialogTitle>
      )}

      {/* STEPPER (Wizard Mode) */}
      {steps && steps.length > 0 && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Stepper activeStep={activeStep} alternativeLabel={steps.length > 4}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {/* CONTENT SECTION */}
      <DialogContent dividers={dividers} sx={{ p: 3, ...contentSx }}>
        {children}
      </DialogContent>

      {/* ACTIONS/FOOTER SECTION */}
      {actions && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
});

GenericDialog.displayName = 'GenericDialog';

GenericDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  title: PropTypes.node,
  subtitle: PropTypes.node,
  headerActions: PropTypes.node,
  children: PropTypes.node,
  actions: PropTypes.node,
  dividers: PropTypes.bool,
  maxWidth: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', false]),
  fullWidth: PropTypes.bool,
  loading: PropTypes.bool,
  mobileFullscreen: PropTypes.bool,
  disableCloseOnLoading: PropTypes.bool,
  steps: PropTypes.arrayOf(PropTypes.string),
  activeStep: PropTypes.number,
  sx: PropTypes.object,
  contentSx: PropTypes.object,
};

export default GenericDialog;
