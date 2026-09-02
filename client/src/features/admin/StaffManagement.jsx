import dayjs from 'dayjs';
import { useAppQuery, useAppMutation, usePersistentGridState } from '../../shared/hooks';
import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import StatusBadge from '../../shared/ui/StatusBadge';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import { GET_USERS, GET_OFFICES, GET_PUBLIC_CONFIG } from '../../graphql/queries';
import {
  TOGGLE_USER_ACTIVE,
  REGISTER_STAFF,
  ASSIGN_TEMP_DUTY,
  CLEAR_TEMP_DUTY,
  GRANT_DAY_OFF,
} from '../../graphql/mutations';
import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import GenericDialog from '../../shared/ui/GenericDialog';
import { GenericFormEngine, RowActions, FormDialog, MonoId } from '../../shared/ui';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
// ── JSON-driven form configs live in ONE shared file so the dashboard's
//    Quick-Add modal and this page can never drift apart again ──
import {
  ADD_STAFF_FIELDS,
  BLANK_STAFF_FORM as BLANK_FORM,
} from './staffFormConfig';
import { useAuth } from '../../shared/auth/AuthContext';
import ProfileDialog from '../profile/ProfileDialog';

// ── JSON-driven form configs (single source of truth for both dialogs) ──
// ── Small JSON-driven dialogs (replaces hand-written TextField stacks) ──
const TEMP_DUTY_FIELDS = (officeOptions) => [
  {
    name: 'officeId',
    type: 'select',
    label: 'Temporary Site',
    required: true,
    options: officeOptions,
    gridSize: { xs: 12 },
  },
  { name: 'startDate', type: 'date', label: 'From', required: true, gridSize: { xs: 12, sm: 6 } },
  { name: 'endDate', type: 'date', label: 'To', required: true, gridSize: { xs: 12, sm: 6 } },
  {
    name: 'reason',
    type: 'text',
    label: 'Reason (Optional)',
    helperText: 'Staff is notified instantly with these details',
    gridSize: { xs: 12 },
  },
];

const DAY_OFF_FIELDS = [
  { name: 'date', type: 'date', label: 'Date', required: true, gridSize: { xs: 12 } },
  {
    name: 'reason',
    type: 'text',
    label: 'Reason (Optional)',
    helperText: 'Excluded from absent counts; staff sees it as EXEMPT',
    gridSize: { xs: 12 },
  },
];

const EMPTY_TEMP_DUTY = { officeId: '', startDate: '', endDate: '', reason: '' };
const EMPTY_DAY_OFF = { date: '', reason: '' };

const StaffManagement = () => {
    const { page, setPage, rowsPerPage, setRowsPerPage, search, setSearch } = usePersistentGridState('staff-roster');

  const { data, loading, error, refetch } = useAppQuery(GET_USERS, {
    variables: { 
      pagination: {
        page: page + 1,
        limit: rowsPerPage,
        search
      }
    }
  });

  const { data: officeData } = useAppQuery(GET_OFFICES);
  const { data: configData } = useAppQuery(GET_PUBLIC_CONFIG);
  const attendanceMethod = configData?.publicConfig?.attendanceMethod || 'FACE';

  const { isAdmin } = useAuth();
  const [addDialog, setAddDialog] = useState(false);
  // Full-screen profile dialog (admin only) – opened by clicking a table row.
  const [profileStaffId, setProfileStaffId] = useState(null);
  // Row action dialogs
  const [tempDutyUser, setTempDutyUser] = useState(null);
  const [dayOffUser, setDayOffUser] = useState(null);

  const officeOptions = (officeData?.offices || []).map((o) => ({ value: o.id, label: o.name }));

  // ── Temporary duty & day-off mutations ──
  // Auto-toasts come from useAppMutation; inline field errors from FormDialog.
  const [assignTemporaryDuty, { loading: assigningDuty }] = useAppMutation(ASSIGN_TEMP_DUTY, {
    successMessage: 'Temporary duty assigned',
    onCompleted: () => refetch(),
  });

  const [clearTemporaryDuty] = useAppMutation(CLEAR_TEMP_DUTY, {
    successMessage: 'Temporary duty cleared',
    onCompleted: () => refetch(),
  });

  const [grantDayOff, { loading: grantingDayOff }] = useAppMutation(GRANT_DAY_OFF, {
    successMessage: 'Day off granted',
    onCompleted: () => refetch(),
  });

  const openTempDuty = (user) => setTempDutyUser(user);

  const openDayOff = (user) => setDayOffUser(user);

  /** Field validation is handled inline by FormDialog's generated zod schema. */
  const submitTempDuty = async (form) => {
    const result = await assignTemporaryDuty({
      variables: {
        userId: tempDutyUser.id,
        officeId: form.officeId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || null,
      },
    });
    if (result.error) throw new Error(result.errorMessage); // surface inside the form
  };

  const submitDayOff = async (form) => {
    const result = await grantDayOff({
      variables: { userId: dayOffUser.id, date: form.date, reason: form.reason || null },
    });
    if (result.error) throw new Error(result.errorMessage); // surface inside the form
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

  const [toggleActive] = useAppMutation(TOGGLE_USER_ACTIVE, {
    // Dynamic toast text + info variant – zero manual notify boilerplate
    successMessage: (d) => `User ${d.toggleUserActive.isActive ? 'activated' : 'deactivated'}`,
    successVariant: 'info',
    onCompleted: () => refetch(),
  });

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

  const columns = [
    {
      id: 'employeeId',
      label: 'Emp ID',
      width: 140,
      render: (row) => <MonoId value={row.employeeId} />,
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
      stopRowClick: true,
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
      stopRowClick: true,
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
      stopRowClick: true,
      render: (row) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <RowActions
            row={row}
            items={[
              { icon: <SwapHorizIcon fontSize="small" />, label: 'Temporary Duty…', onClick: openTempDuty },
              { icon: <EventAvailableIcon fontSize="small" />, label: 'Grant Day Off…', onClick: openDayOff },
            ]}
          />
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
          stateKey="staff-roster"
          rows={data?.users?.data || []}
          totalCount={data?.users?.pageInfo?.totalCount || 0}
          page={page}
          onPageChange={setPage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={setRowsPerPage}
          onSearch={setSearch}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={refetch}
          onRowClick={isAdmin ? (row) => setProfileStaffId(row.id) : undefined}
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
          fields={ADD_STAFF_FIELDS(officeOptions, attendanceMethod)}
          onSubmit={handleRegister}
          initialValues={BLANK_FORM}
          submitLabel={registering ? 'Adding…' : 'Add Staff'}
          resetLabel="Clear"
        />
      </GenericDialog>

      {/* Temporary Duty – punch at another site for a date range */}
      <FormDialog
        open={!!tempDutyUser}
        onClose={() => setTempDutyUser(null)}
        title={`Temporary Duty – ${tempDutyUser?.name || ''}`}
        loading={assigningDuty}
        maxWidth="xs"
        fields={TEMP_DUTY_FIELDS(officeOptions)}
        initialValues={EMPTY_TEMP_DUTY}
        onSubmit={submitTempDuty}
        submitLabel="Assign Temp Duty"
      >
        {tempDutyUser?.temporaryAssignment?.office && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            An active temp duty exists. Assigning a new one replaces it.
          </Alert>
        )}
      </FormDialog>

      {/* Day Off – exempt from absence on a specific date */}
      <FormDialog
        open={!!dayOffUser}
        onClose={() => setDayOffUser(null)}
        title={`Grant Day Off – ${dayOffUser?.name || ''}`}
        loading={grantingDayOff}
        maxWidth="xs"
        fields={DAY_OFF_FIELDS}
        initialValues={EMPTY_DAY_OFF}
        onSubmit={submitDayOff}
        submitLabel="Grant Day Off"
      />

      {/* Full-screen profile (admin only) – opens on row click */}
      {isAdmin && (
        <ProfileDialog
          open={!!profileStaffId}
          staffId={profileStaffId}
          onClose={() => setProfileStaffId(null)}
          onChanged={refetch}
        />
      )}
    </Box>
  );
};

export default StaffManagement;



