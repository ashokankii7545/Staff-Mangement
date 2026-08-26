import AppButton from '../../../shared/ui/AppButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import GppBadIcon from '@mui/icons-material/GppBad';

const VPNWarningDialog = ({ open, onClose, message }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>
      <Stack direction="row" alignItems="center" spacing={1}>
        <GppBadIcon color="error" fontSize="large" />
        <Typography variant="h6">Security Alert</Typography>
      </Stack>
    </DialogTitle>
    <DialogContent>
      <Alert severity="error" sx={{ mb: 2 }}>
        {message || 'VPN or Proxy detected. Please disable your VPN to mark attendance.'}
      </Alert>
      <Typography variant="body2" color="text.secondary">
        For security purposes, attendance must be marked without any VPN, Proxy, or TOR connection.
        Please disconnect and try again.
      </Typography>
    </DialogContent>
    <DialogActions>
      <AppButton onClick={onClose} variant="contained" color="error">
        Understood
      </AppButton>
    </DialogActions>
  </Dialog>
);

export default VPNWarningDialog;



