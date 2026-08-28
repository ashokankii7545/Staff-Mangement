import { z } from 'zod';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useAppMutation } from '../../../shared/hooks';
import { BROADCAST_EMAIL } from '../../../graphql/mutations';
import { GenericDialog, GenericFormEngine } from '../../../shared/ui';

const ANNOUNCEMENT_SCHEMA = z.object({
  subject: z.string().min(3, 'Subject needs at least 3 characters').max(120, 'Keep the subject under 120 characters'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message is too long (max 2000 characters)'),
});

const ANNOUNCEMENT_FIELDS = [
  {
    name: 'subject',
    type: 'text',
    label: 'Subject',
    placeholder: 'E.g., Office will be closed for Diwali',
    gridSize: { xs: 12 },
  },
  {
    name: 'message',
    type: 'multiline',
    label: 'Message',
    rows: 4,
    placeholder: 'Write the announcement body delivered to every staff member by email + in-app notification.',
    gridSize: { xs: 12 },
  },
];

/**
 * Admin-only "Send Announcement" dialog.
 * Calls the existing `broadcastEmail` mutation — every active staff member is
 * emailed AND receives an in-app notification (pushed server-side), so a
 * single compose form reaches the whole team.
 */
const SendAnnouncementDialog = ({ open, onClose }) => {
  const [sendAnnouncement, { loading: sending }] = useAppMutation(BROADCAST_EMAIL, {
    successMessage: (d) =>
      d?.broadcastEmail === true
        ? 'Announcement sent to all staff 📣'
        : 'Announcement dispatched',
    onCompleted: () => onClose?.(),
  });

  const handleSend = async (form) => {
    const result = await sendAnnouncement({
      variables: { subject: form.subject.trim(), message: form.message.trim() },
    });
    if (result.error) throw new Error(result.errorMessage); // surface inside the form
  };

  return (
    <GenericDialog
      open={open}
      onClose={() => !sending && onClose?.()}
      title="Send Announcement"
      maxWidth="sm"
    >
      <Stack spacing={2}>
        <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
          <Typography variant="body2">
            Delivered to every active staff member by <strong>email</strong> and as an{' '}
            <strong>in-app notification</strong>. It reaches everyone immediately.
          </Typography>
        </Alert>

        <GenericFormEngine
          fields={ANNOUNCEMENT_FIELDS}
          schema={ANNOUNCEMENT_SCHEMA}
          onSubmit={handleSend}
          submitLabel={sending ? 'Sending…' : 'Send to All Staff'}
          resetLabel="Clear"
          resetAfterSubmit
          hideReset={false}
        />
      </Stack>
    </GenericDialog>
  );
};

export default SendAnnouncementDialog;