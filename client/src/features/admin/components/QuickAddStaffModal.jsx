import { useAppQuery, useAppMutation } from '../../../shared/hooks';
import { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { AppButton } from '../../../shared/ui';

import { REGISTER_STAFF } from '../../../graphql/mutations';
import Alert from '@mui/material/Alert';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { GET_USERS, GET_DASHBOARD_STATS, GET_OFFICES } from '../../../graphql/queries';
import GenericDialog from '../../../shared/ui/GenericDialog';
import { useNotification } from '../../../shared/ui';
import StaffPhotoPicker from './StaffPhotoPicker';

const QuickAddStaffModal = ({ open, onClose }) => {
  const notify = useNotification();
  const { data: officeData } = useAppQuery(GET_OFFICES);

  const [hirePhoto, setHirePhoto] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF',
    officeId: '',
  });

  const [registerStaff, { loading }] = useAppMutation(REGISTER_STAFF, {
    refetchQueries: [{ query: GET_USERS }, { query: GET_DASHBOARD_STATS }],
    successMessage: 'Employee registered successfully! 🎊',
    onCompleted: () => {
      setForm({ name: '', email: '', password: '', role: 'STAFF', officeId: '' });
      setHirePhoto(null);
      onClose();
    },
    onError: (err) => notify.error(err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.password || !form.email) {
      notify.warning('Please fill in all mandatory fields (*)');
      return;
    }
    if (!hirePhoto) {
      notify.warning('Please add a profile photo - face verification at punch time depends on it.');
      return;
    }

    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
    };
    if (form.officeId) payload.assignedOffice = form.officeId;
    if (hirePhoto) payload.avatarBase64 = hirePhoto;

    registerStaff({ variables: { input: payload } });
  };

  return (
    <GenericDialog
      open={open}
      onClose={onClose}
      title="Onboard New Employee"
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
            Create Employee
          </AppButton>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Alert severity="info" icon={<CameraAltIcon fontSize="inherit" />}>
          Add a clear front-facing photo – every punch selfie is face-verified against it.
        </Alert>

        {/* Shared picker: equal-width [Take Photo] [Upload Image] buttons,
            preview + Retake/Remove afterwards – identical layout to Add Staff */}
        <StaffPhotoPicker value={hirePhoto} onChange={setHirePhoto} disabled={loading} />

        <TextField
          required
          label="Full Name"
          placeholder="e.g. Rahul Sharma"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          fullWidth
        />

        <TextField
          required
          label="Email Address"
          type="email"
          placeholder="e.g. rahul@company.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          fullWidth
        />

        <TextField
          required
          label="Initial Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          fullWidth
          helperText="Min 8 characters with letters & numbers"
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            fullWidth
          >
            <MenuItem value="STAFF">Staff</MenuItem>
            <MenuItem value="ADMIN">Admin</MenuItem>
          </TextField>
          <TextField
            select
            label="Assigned Site"
            value={form.officeId}
            onChange={(e) => setForm({ ...form, officeId: e.target.value })}
            fullWidth
          >
            <MenuItem value="">None (Default Head Office)</MenuItem>
            {(officeData?.offices || []).map((off) => (
              <MenuItem key={off.id} value={off.id}>
                {off.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
    </GenericDialog>
  );
};

export default QuickAddStaffModal;




