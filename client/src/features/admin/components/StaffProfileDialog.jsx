import { Dialog, DialogContent } from '@mui/material';
import StaffProfilePage from '../StaffProfilePage';

/**
 * StaffProfileDialog – opens a staff member's profile as a FULL-SCREEN dialog.
 * No route change: the caller simply passes the userId and closes with the ✕
 * button rendered inside the profile header.
 */
const StaffProfileDialog = ({ userId, onClose }) => (
  <Dialog
    open={!!userId}
    onClose={onClose}
    fullScreen
    PaperProps={{ sx: { bgcolor: 'background.default', borderRadius: 0 } }}
  >
    <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {userId && <StaffProfilePage userId={userId} onClose={onClose} />}
    </DialogContent>
  </Dialog>
);

export default StaffProfileDialog;
