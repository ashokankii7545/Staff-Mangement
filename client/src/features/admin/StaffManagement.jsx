import dayjs from 'dayjs';
import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { useState } from 'react';
import { gql } from '@apollo/client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import StatusBadge from '../../shared/ui/StatusBadge';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import { GET_USERS, GET_OFFICES } from '../../graphql/queries';
import {
  TOGGLE_USER_ACTIVE,
  UPDATE_USER,
  REGISTER_STAFF,
  ASSIGN_TEMP_DUTY,
  CLEAR_TEMP_DUTY,
  GRANT_DAY_OFF,
} from '../../graphql/mutations';
import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import GenericDialog from '../../shared/ui/GenericDialog';
import { GenericFormEngine, useNotification } from '../../shared/ui';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import StaffPhotoPicker from './components/StaffPhotoPicker';
import PageAccessMatrix from './components/PageAccessMatrix';

// ── JSON-driven form configs (single source of truth for both dialogs) ──
const ADD_STAFF_FIELDS = (officeOptions) => [
  {
    name: 'avatarBase64',
    type: 'custom',
    label: 'Profile Photo',
    gridSize: { xs: 12 },
    render: ({ value, onChange }) => (
      <Box sx={{ mb: 1, width: '100%' }}>
        <Alert severity="info" icon={<CameraAltIcon fontSize="inherit" />} sx={{ mb: 2 }}>
          Add a clear front-facing photo (click or upload image) – attendance selfies are face-verified against it.
        </Alert>
        <StaffPhotoPicker value={value} onChange={onChange} />
      </Box>
    )
  },
  { name: 'name', type: 'text', label: 'Full Name', gridSize: { xs: 12, sm: 6 } },
  { name: 'email', type: 'email', label: 'Email', gridSize: { xs: 12, sm: 6 } },
  { name: 'password', type: 'password', label: 'Password', gridSize: { xs: 12, sm: 6 } },
  {
    name: 'role',
    type: 'select',
    label: 'System Role',
    options: [{ value: 'STAFF', label: 'Staff' }, { value: 'ADMIN', label: 'Admin' }],
    gridSize: { xs: 12, sm: 6 }
  },
  {
    name: 'officeId',
    type: 'select',
    label: 'Assigned Base Site',
    options: [{ value: '', label: 'Default / Head Office' }, ...officeOptions],
    gridSize: { xs: 12 }
  }
];

const EDIT_STAFF_FIELDS = (officeOptions) => [
  // Accordion sections – the long edit dialog reads as short, scannable pages
  { type: 'section', label: 'Personal Details' },
  { name: 'name', type: 'text', label: 'Full Name', gridSize: { xs: 12, sm: 6 } },
  { name: 'email', type: 'email', label: 'Email', gridSize: { xs: 12, sm: 6 } },
  {
    name: 'role',
    type: 'select',
    label: 'System Role',
    options: [{ value: 'STAFF', label: 'Staff' }, { value: 'ADMIN', label: 'Admin' }],
    gridSize: { xs: 12, sm: 6 }
  },
  { type: 'section', label: 'Site & Shift' },
  {
    name: 'officeId',
    type: 'select',
    label: 'Assigned Base Site',
    options: [{ value: '', label: 'Default / Head Office' }, ...officeOptions],
    gridSize: { xs: 12, sm: 6 }
  },
  { name: 'shiftStartTime', type: 'time', label: 'Shift Start (Optional)', gridSize: { xs: 12, sm: 6 } },
  { name: 'shiftEndTime', type: 'time', label: 'Shift End (Optional)', gridSize: { xs: 12, sm: 6 } },
  { type: 'section', label: 'Leave Balances', defaultExpanded: false },
  { name: 'casual', type: 'number', label: 'Casual Leaves', gridSize: { xs: 12, sm: 4 } },
  { name: 'sick', type: 'number', label: 'Sick Leaves', gridSize: { xs: 12, sm: 4 } },
  { name: 'earned', type: 'number', label: 'Earned Leaves', gridSize: { xs: 12, sm: 4 } },
  // Per-account page visibility – ON by default for every page, admin
  // withdraws specific ones (stored as user.restrictedPages route keys)
  { type: 'section', label: 'Page Access', defaultExpanded: false },
  {
    name: 'restrictedPages',
    type: 'custom',
    label: 'Page Access',
    gridSize: { xs: 12 },
    render: ({ value, onChange }) => (
      <PageAccessMatrix value={value} onChange={onChange} />
    ),
  },
];

const BLANK_FORM = {
  name: '', email: '', password: '', role: 'STAFF', officeId: '', avatarBase64: null,
};

const StaffManagement = () => {
  const notify = useNotification();
  const { data, loading, error, refetch } = useAppQuery(GET_USERS);
  const { data: officeData } = useAppQuery(GET_OFFICES);
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  // Row action menu + dialogs
  const [menuState, setMenuState] = useState({ rowId: null, anchorEl: null });
  const [tempDutyUser, setTempDutyUser] = useState(null);
  const [dayOffUser, setDayOffUser] = useState(null);
  const [tempDutyForm, setTempDutyForm] = useState({ officeId: '', startDate: '', endDate: '', reason: '' });
  const [dayOffForm, setDayOffForm] = useState({ date: '', reason: '' });

  const officeOptions = (officeData?.offices || []).map((o) => ({ value: o.id, label: o.name }));

  // ── Temporary duty & day-off mutations ──
  const [assignTemporaryDuty, { loading: assigningDuty }] = useAppMutation(ASSIGN_TEMP_DUTY, {
    successMessage: 'Temporary duty assigned',
    onCompleted: () => {
      setTempDutyUser(null);
      refetch();
    },
    onError: (err) => notify.error(err.message),
  });

  const [clearTemporaryDuty] = useAppMutation(CLEAR_TEMP_DUTY, {
    successMessage: 'Temporary duty cleared',
    onCompleted: () => refetch(),
  });

  const [grantDayOff, { loading: grantingDayOff }] = useAppMutation(GRANT_DAY_OFF, {
    successMessage: 'Day off granted',
    onCompleted: () => {
      setDayOffUser(null);
      refetch();
    },
    onError: (err) => notify.error(err.message),
  });

  const openTempDuty = (user) => {
    setTempDutyForm({ officeId: '', startDate: '', endDate: '', reason: '' });
    setTempDutyUser(user);
    setMenuState({ rowId: null, anchorEl: null });
  };

  const openDayOff = (user) => {
    setDayOffForm({ date: '', reason: '' });
    setDayOffUser(user);
    setMenuState({ rowId: null, anchorEl: null });
  };

  const submitTempDuty = () => {
    if (!tempDutyForm.officeId || !tempDutyForm.startDate || !tempDutyForm.endDate) {
      notify.warning('Site, start date and end date are required');
      return;
    }
    assignTemporaryDuty({
      variables: {
        userId: tempDutyUser.id,
        officeId: tempDutyForm.officeId,
        startDate: tempDutyForm.startDate,
        endDate: tempDutyForm.endDate,
        reason: tempDutyForm.reason || null,
      },
    });
  };

  const submitDayOff = () => {
    if (!dayOffForm.date) {
      notify.warning('Pick the day-off date');
      return;
    }
    grantDayOff({
      variables: { userId: dayOffUser.id, date: dayOffForm.date, reason: dayOffForm.reason || null },
    });
  };

  // Auto-toast handled inside the hook – handlers stay declarative.
  // The toast surfaces the auto-assigned Employee ID (server-generated).
  const [registerStaff, { loading: registering }] = useAppMutation(REGISTER_STAFF, {
    successMessage: (d) =>
      d?.registerStaff?.employeeId
        ? `Staff added – Employee ID: ${d.registerStaff.employeeId}`
        : 'Staff member added successfully',
    onCompleted: () => {
      setAddDialog(false);
      refetch();
    },
  });

  const [updateUser, { loading: updating }] = useAppMutation(UPDATE_USER, {
    successMessage: 'Staff details updated successfully',
    onCompleted: () => {
      setEditDialog(false);
      setEditingUser(null);
      refetch();
    },
  });

  const [toggleActive] = useAppMutation(TOGGLE_USER_ACTIVE, {
    // Dynamic toast text + info variant – zero manual notify boilerplate
    successMessage: (d) => `User ${d.toggleUserActive.isActive ? 'activated' : 'deactivated'}`,
    successVariant: 'info',
    onCompleted: () => refetch(),
  });

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setEditDialog(true);
  };

  const handleRegister = async (form) => {
    const input = {
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      officeId: form.officeId || null,
      avatarBase64: form.avatarBase64 || null,
    };
    if (!input.officeId) delete input.officeId;
    if (!input.avatarBase64) delete input.avatarBase64;
    const result = await registerStaff({ variables: { input } });
    if (result.error) throw new Error(result.errorMessage); // surface inside the form
  };

  const handleUpdate = async (form) => {
    const input = {
      name: form.name,
      email: form.email,
            role: form.role,
      shiftStartTime: form.shiftStartTime || null,
      shiftEndTime: form.shiftEndTime || null,
      restrictedPages: Array.isArray(form.restrictedPages) ? form.restrictedPages : [],
      leaveBalances: {
        casual: parseInt(form.casual, 10),
        sick: parseInt(form.sick, 10),
        earned: parseInt(form.earned, 10),
      },
    };
    if (form.officeId) input.officeId = form.officeId;
    const result = await updateUser({ variables: { id: editingUser.id, input } });
    if (result.error) throw new Error(result.errorMessage); // surface inside the form
  };

  const columns = [
    {
      id: 'employeeId',
      label: 'Emp ID',
      width: 140,
      render: (row) =>
        row.employeeId ? (
          <Typography
            component="span"
            sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.75rem',
              fontWeight: 600,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {row.employeeId}
          </Typography>
        ) : (
          '—'
        ),
    },
    { id: 'name', label: 'Name', width: 200 },
    { id: 'email', label: 'Email', width: 220, sortable: false },
        {
      id: 'role',
      label: 'Role',
      width: 120,
      // Theme-token colors (was hardcoded '#DC2626')
      render: (row) => (
        <StatusBadge
          status={row.role === 'ADMIN' ? 'ERROR' : 'ACTIVE'}
          label={row.role}
          size="small"
        />
      ),
    },
    {
      id: 'assignedOffice',
      label: 'Site',
      width: 180,
      valueGetter: (row) => row.assignedOffice?.name || 'Default Site',
      sortable: false,
      render: (row) => {
        const ta = row.temporaryAssignment;
        const taActive = ta?.office && ta.startDate && ta.endDate &&
          dayjs().isAfter(dayjs(ta.startDate).startOf('day')) &&
          dayjs().isBefore(dayjs(ta.endDate).endOf('day'));
        return (
          <Stack spacing={0.5}>
            <Typography variant="body2">{row.assignedOffice?.name || 'Default Site'}</Typography>
            {taActive && (
              <Chip
                size="small"
                color="info"
                variant="outlined"
                icon={<SwapHorizIcon sx={{ fontSize: 14 }} />}
                label={`Temp: ${ta.office.name} →`}
                onDelete={() => clearTemporaryDuty({ variables: { userId: row.id } })}
              />
            )}
          </Stack>
        );
      },
    },
    {
      id: 'isActive',
      label: 'Status',
      width: 100,
      align: 'center',
      sortable: false,
      render: (row) => (
        <Switch
          size="small"
          checked={row.isActive}
          onChange={() => toggleActive({ variables: { userId: row.id } })}
          aria-label={`Toggle ${row.name}`}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 100,
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <AppButton size="small" variant="outlined" onClick={() => handleOpenEdit(row)}>
            Edit
          </AppButton>
          <IconButton
            size="small"
            aria-label="More actions"
            onClick={(e) => setMenuState({ rowId: row.id, anchorEl: e.currentTarget })}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={menuState.anchorEl}
            open={menuState.rowId === row.id}
            onClose={() => setMenuState({ rowId: null, anchorEl: null })}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => openTempDuty(row)}>
              <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Temporary Duty…</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => openDayOff(row)}>
              <ListItemIcon><EventAvailableIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Grant Day Off…</ListItemText>
            </MenuItem>
          </Menu>
        </Stack>
      ),
    }
  ];

  return (
    <Box>
      <PageHeader
        title="Staff Management"
        subtitle="Manage employees and assignments"
        backButton="/"
        action={
          <AppButton color="primary" startIcon={<AddIcon />} onClick={() => setAddDialog(true)}>
            Add Staff
          </AppButton>
        }
      />

      <Card variant="outlined">
        <GenericDataGrid
          title="Staff Roster"
          rows={data?.users || []}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={refetch}
        />
      </Card>

      {/* Register New Staff – JSON-driven form in enterprise dialog */}
      <GenericDialog
        open={addDialog}
        onClose={() => !registering && setAddDialog(false)}
        title="Register New Staff"
        loading={registering}
        maxWidth="sm"
      >
        <GenericFormEngine
          fields={ADD_STAFF_FIELDS(officeOptions)}
          onSubmit={handleRegister}
          initialValues={BLANK_FORM}
          submitLabel={registering ? 'Adding…' : 'Add Staff'}
          resetLabel="Clear"
        />
      </GenericDialog>

      {/* Edit Staff Details */}
      <GenericDialog
        open={editDialog}
        onClose={() => !updating && setEditDialog(false)}
        title="Edit Staff Details"
        loading={updating}
        maxWidth="sm"
      >
        {editingUser && (
          <GenericFormEngine
            key={editingUser.id}
            fields={EDIT_STAFF_FIELDS(officeOptions)}
            initialValues={{
              name: editingUser.name ?? '',
              email: editingUser.email ?? '',
                            role: editingUser.role || 'STAFF',
              officeId: editingUser.assignedOffice ? editingUser.assignedOffice.id : '',
              casual: editingUser.leaveBalances?.casual ?? 0,
              sick: editingUser.leaveBalances?.sick ?? 6,
              earned: editingUser.leaveBalances?.earned ?? 0,
              shiftStartTime: editingUser.shiftStartTime || '',
              shiftEndTime: editingUser.shiftEndTime || '',
              restrictedPages: editingUser.restrictedPages ?? [],
            }}
            onSubmit={handleUpdate}
            submitLabel={updating ? 'Saving…' : 'Save Changes'}
            resetLabel="Reset"
          />
        )}
      </GenericDialog>

      {/* Temporary Duty – punch at another site for a date range */}
      <GenericDialog
        open={!!tempDutyUser}
        onClose={() => setTempDutyUser(null)}
        title={`Temporary Duty – ${tempDutyUser?.name || ''}`}
        loading={assigningDuty}
        maxWidth="xs"
      >
        {tempDutyUser?.temporaryAssignment?.office && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            An active temp duty exists. Assigning a new one replaces it.
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField
            select
            required
            label="Temporary Site"
            value={tempDutyForm.officeId}
            onChange={(e) => setTempDutyForm({ ...tempDutyForm, officeId: e.target.value })}
            fullWidth
          >
            {(officeData?.offices || []).map((off) => (
              <MenuItem key={off.id} value={off.id}>{off.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            required
            label="From"
            value={tempDutyForm.startDate}
            onChange={(e) => setTempDutyForm({ ...tempDutyForm, startDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            type="date"
            required
            label="To"
            value={tempDutyForm.endDate}
            onChange={(e) => setTempDutyForm({ ...tempDutyForm, endDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Reason (optional)"
            value={tempDutyForm.reason}
            onChange={(e) => setTempDutyForm({ ...tempDutyForm, reason: e.target.value })}
            fullWidth
            helperText="Staff is notified instantly with these details"
          />
        </Stack>
        <AppButton
          variant="contained"
          color="primary"
          onClick={submitTempDuty}
          loading={assigningDuty}
          fullWidth
          sx={{ mt: 3 }}
        >
          Assign Temp Duty
        </AppButton>
      </GenericDialog>

      {/* Day Off – exempt from absence on a specific date */}
      <GenericDialog
        open={!!dayOffUser}
        onClose={() => setDayOffUser(null)}
        title={`Grant Day Off – ${dayOffUser?.name || ''}`}
        loading={grantingDayOff}
        maxWidth="xs"
      >
        <Stack spacing={2}>
          <TextField
            type="date"
            required
            label="Date"
            value={dayOffForm.date}
            onChange={(e) => setDayOffForm({ ...dayOffForm, date: e.target.value })}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Reason (optional)"
            value={dayOffForm.reason}
            onChange={(e) => setDayOffForm({ ...dayOffForm, reason: e.target.value })}
            fullWidth
            helperText="Excluded from absent counts; staff sees it as EXEMPT"
          />
        </Stack>
        <AppButton
          variant="contained"
          color="primary"
          onClick={submitDayOff}
          loading={grantingDayOff}
          fullWidth
          sx={{ mt: 3 }}
        >
          Grant Day Off
        </AppButton>
      </GenericDialog>

    </Box>
  );
};

export default StaffManagement;



