import { useAppQuery, useAppMutation } from '../../../shared/hooks';
import React, { useState, useEffect } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import AppButton from '../../../shared/ui/AppButton';


import dayjs from 'dayjs';
import { APPLY_FOR_LEAVE } from '../../../graphql/mutations';
import { GET_USERS, GET_ALL_LEAVE_REQUESTS, GET_MY_LEAVE_REQUESTS, GET_DASHBOARD_STATS, GET_ME } from '../../../graphql/queries';
import { useAuth } from '../../../shared/auth/AuthContext';
import GenericDialog from '../../../shared/ui/GenericDialog';
import DateRangePicker from '../../../shared/ui/DateRangePicker';
import { useNotification } from '../../../shared/ui';

const ApplyLeaveModal = ({ open, onClose, targetUserId = null, onSuccess }) => {
  const { user: authUser, isAdmin } = useAuth();
  const notify = useNotification();

  // Queries
  const { data: usersData } = useAppQuery(GET_USERS, {
    variables: { isActive: true },
    skip: !isAdmin,
  });

  const { data: meData } = useAppQuery(GET_ME, {
    skip: isAdmin,
    fetchPolicy: 'cache-and-network',
  });

  const [form, setForm] = useState({
    userId: targetUserId || (isAdmin ? '' : authUser?.id || ''),
    leaveType: 'CASUAL',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    reason: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        userId: targetUserId || (isAdmin ? '' : authUser?.id || ''),
        leaveType: 'CASUAL',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
        reason: '',
      });
    }
  }, [open, targetUserId, isAdmin, authUser]);

  const [applyLeave, { loading }] = useAppMutation(APPLY_FOR_LEAVE, {
    refetchQueries: [
      { query: GET_ALL_LEAVE_REQUESTS, variables: { status: 'PENDING' } },
      { query: GET_MY_LEAVE_REQUESTS },
      { query: GET_DASHBOARD_STATS },
    ],
    successMessage: (_data) =>
      isAdmin
        ? 'Leave request submitted on behalf of staff member! 📅'
        : 'Leave application submitted successfully! 📅',
    onCompleted: () => {
      onSuccess?.();
      onClose();
    },
    onError: (err) => notify.error(err.message),
  });

  const staffUsers = (usersData?.users?.data || []).filter((u) => u.role === 'STAFF');
  const selectedUser = isAdmin
    ? staffUsers.find((u) => u.id === form.userId)
    : meData?.me || authUser;

  const balances = selectedUser?.leaveBalances || { casual: 12, sick: 6, earned: 0 };

  // Live guard – show a warning BEFORE the server rejects the request
  const selectedDays = dayjs(form.endDate).diff(dayjs(form.startDate), 'day') + 1;
  const typeBalance = balances[form.leaveType.toLowerCase()] ?? 0;
  const exceedsBalance = selectedDays > typeBalance;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isAdmin && !form.userId) {
      notify.warning('Please select an employee (*)');
      return;
    }
    if (!form.reason.trim()) {
      notify.warning('Please provide a reason for the leave (*)');
      return;
    }

    const payload = {
      userId: isAdmin ? form.userId : undefined,
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason.trim(),
    };

    applyLeave({ variables: { input: payload } });
  };

  return (
    <GenericDialog
      open={open}
      onClose={onClose}
      title={isAdmin ? 'Apply Leave on Behalf of Staff' : 'Apply for Leave'}
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
            {isAdmin ? 'Submit Leave' : 'Submit Request'}
          </AppButton>
        </>
      }
    >
      <Stack spacing={2.5}>
        {/* Admin only: Select Staff member */}
        {isAdmin && (
          <TextField
            select
            required
            label="Select Staff Member"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
            fullWidth
            helperText={selectedUser ? `Department: ${selectedUser.department || 'General'}` : 'Choose employee'}
          >
            {staffUsers.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name} ({u.employeeId})
              </MenuItem>
            ))}
          </TextField>
        )}

        {/* Leave Type with dynamic live balances */}
        <TextField
          select
          required
          label="Leave Type"
          value={form.leaveType}
          onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
          fullWidth
          helperText={
            selectedUser
              ? `Available: Casual: ${balances.casual} | Sick: ${balances.sick} | Earned: ${balances.earned}`
              : 'Select employee to view live balance'
          }
        >
          <MenuItem value="CASUAL">Casual Leave ({balances.casual} available)</MenuItem>
          <MenuItem value="SICK">Sick Leave ({balances.sick} available)</MenuItem>
          <MenuItem value="EARNED">Earned Leave ({balances.earned} available)</MenuItem>
        </TextField>

        {/* Balance guard – visible before submit */}
        {exceedsBalance && (
          <Alert severity="warning">
            Selected {selectedDays} day(s) but only {typeBalance} {form.leaveType.toLowerCase()} day(s) are
            available. The request will be rejected – pick fewer days or choose another leave type.
          </Alert>
        )}

        {/* Exact same unified DateRangePicker Form Field */}
        <DateRangePicker
          variant="formField"
          fullWidth
          showPresets={false}
          disablePast
          label="Leave Duration (Single or Multi-Day)"
          value={{ startDate: form.startDate, endDate: form.endDate }}
          onChange={(range) => {
            setForm({
              ...form,
              startDate: range.startDate,
              endDate: range.endDate,
            });
          }}
        />

        {/* Reason for Leave */}
        <TextField
          required
          label="Reason for Leave"
          multiline
          rows={3}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="Please describe the reason for taking leave..."
          fullWidth
        />
      </Stack>
    </GenericDialog>
  );
};

export default ApplyLeaveModal;





