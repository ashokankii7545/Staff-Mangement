import { useAppMutation } from '../../../shared/hooks';
import React, { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import AppButton from '../../../shared/ui/AppButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';


import dayjs from 'dayjs';
import { REQUEST_REGULARIZATION } from '../../../graphql/mutations';
import { GET_MY_REGULARIZATIONS, GET_ALL_REGULARIZATIONS, GET_MY_ATTENDANCE } from '../../../graphql/queries';
import GenericDialog from '../../../shared/ui/GenericDialog';
import { useNotification } from '../../../shared/ui';

const RegularizeAttendanceModal = ({ open, onClose, defaultDate = null, onSuccess }) => {
  const notify = useNotification();

  const [form, setForm] = useState({
    date: defaultDate || dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    checkInTime: '09:00',
    checkOutTime: '18:00',
    reason: '',
  });

  const [requestRegularization, { loading }] = useAppMutation(REQUEST_REGULARIZATION, {
    refetchQueries: [
      { query: GET_MY_REGULARIZATIONS },
      { query: GET_ALL_REGULARIZATIONS, variables: { status: 'PENDING' } },
      { query: GET_MY_ATTENDANCE },
    ],
    successMessage: 'Attendance regularization request submitted to Admin! 🕒',
    onCompleted: () => {
      setForm({
        date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
        checkInTime: '09:00',
        checkOutTime: '18:00',
        reason: '',
      });
      onSuccess?.();
      onClose();
    },
    onError: (err) => notify.error(err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.date) {
      notify.warning('Please select a date (*)');
      return;
    }
    if (!form.reason.trim()) {
      notify.warning('Please state the reason for regularization (*)');
      return;
    }

    requestRegularization({
      variables: {
        input: {
          date: form.date,
          checkInTime: form.checkInTime,
          checkOutTime: form.checkOutTime,
          reason: form.reason.trim(),
        },
      },
    });
  };

  return (
    <GenericDialog
      open={open}
      onClose={onClose}
      title="Attendance Regularization / Missed Punch"
      maxWidth="sm"
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
      }}
      actions={
        <>
          <AppButton variant="outlined" color="inherit" onClick={onClose} disabled={loading}>
            Cancel
          </AppButton>
          <AppButton
            type="submit"
            color="primary"
            loading={loading}
          >
            Submit Request
          </AppButton>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'action.selected',
            border: '1px solid', borderColor: 'primary.light',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
          }}
        >
          <InfoOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 500, lineHeight: 1.4 }}>
            Forgot to punch, device error, or on-field client duty? Submit your correct working hours for Admin approval.
          </Typography>
        </Box>

        <TextField
          type="date"
          required
          label="Attendance Date to Regularize"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
          helperText="Select the date where punch was missed or inaccurate"
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            type="time"
            required
            label="Actual Clock-in Time"
            value={form.checkInTime}
            onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            type="time"
            required
            label="Actual Clock-out Time"
            value={form.checkOutTime}
            onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>

        <TextField
          required
          label="Reason for Regularization"
          multiline
          rows={3}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="E.g., Client meeting at field site / Biometric mobile camera error..."
          fullWidth
        />
      </Stack>
    </GenericDialog>
  );
};

export default RegularizeAttendanceModal;







