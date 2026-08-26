import StatusBadge from '../../shared/ui/StatusBadge';
import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { useState } from 'react';
import { useSubscription } from '@apollo/client';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import AppButton from '../../shared/ui/AppButton';
import PageHeader from '../../shared/ui/PageHeader';

import { GET_ALL_LEAVE_REQUESTS, GET_ALL_ATTENDANCE, GET_PENDING_USERS, GET_OFFICES } from '../../graphql/queries';
import { REVIEW_LEAVE_REQUEST, REVIEW_ATTENDANCE, REVIEW_USER_SIGNUP } from '../../graphql/mutations';
import { ON_LEAVE_REQUEST_ADDED } from '../../graphql/subscriptions';
import ConfirmDialog from '../../shared/ui/ConfirmDialog';
import { useNotification, MonoId } from '../../shared/ui';

/** Consistent Employee-ID chip – shared monospace badge (see shared/ui/MonoId) */
const renderEmpId = (id) => <MonoId value={id} />;

const ApprovalsPage = () => {
  const notify = useNotification();
  const location = useLocation();
  const [tab, setTab] = useState(location.hash === '#signups' ? 2 : (location.hash === '#attendance' ? 1 : 0));

  useEffect(() => {
    if (location.hash === '#signups') setTab(2);
    else if (location.hash === '#attendance') setTab(1);
    else if (location.hash === '#leaves') setTab(0);
  }, [location.hash]);

  // Queries
  const { data: leaveData, loading: leaveLoading, error: leaveError, refetch: refetchLeaves } = useAppQuery(GET_ALL_LEAVE_REQUESTS, {
    variables: { status: 'PENDING' },
    fetchPolicy: 'network-only',
    pollInterval: 5000 // Fallback sync every 5 seconds
  });

  useSubscription(ON_LEAVE_REQUEST_ADDED, {
    onData: () => {
      refetchLeaves();
    },
    onError: (err) => {
      console.error('WS Error:', err);
    }
  });

  // Self-signup queue – accounts waiting for an admin decision
  const {
    data: pendingUsersData,
    loading: pendingUsersLoading,
    refetch: refetchPendingUsers,
  } = useAppQuery(GET_PENDING_USERS, { fetchPolicy: 'network-only' });

  const [reviewSignup] = useAppMutation(REVIEW_USER_SIGNUP, {
    successMessage: 'Signup request processed',
    onCompleted: () => {
      handleCloseDialog();
      refetchPendingUsers();
    },
  });

  const today = dayjs().format('YYYY-MM-DD');
  const { data: officesData } = useAppQuery(GET_OFFICES);
  const { data: attData, loading: attLoading, error: attError, refetch: refetchAtt } = useAppQuery(GET_ALL_ATTENDANCE, {
    variables: { startDate: dayjs().subtract(7, 'days').format('YYYY-MM-DD'), endDate: today }
  });

  // Action State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [selectedOffice, setSelectedOffice] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState('LEAVE'); // LEAVE or ATTENDANCE
  const [actionStatus, setActionStatus] = useState('APPROVED');

  // Auto-toast via useAppMutation – no manual notify boilerplate
  const [reviewLeave, { loading: reviewingLeave }] = useAppMutation(REVIEW_LEAVE_REQUEST, {
    successMessage: 'Leave request processed',
    onCompleted: () => {
      handleCloseDialog();
      refetchLeaves();
    },
  });

  const [reviewAtt, { loading: reviewingAtt }] = useAppMutation(REVIEW_ATTENDANCE, {
    successMessage: 'Attendance processed',
    onCompleted: () => {
      handleCloseDialog();
      refetchAtt();
    },
  });

  const handleOpenDialog = (type, req, status) => {
    setActionType(type);
    setSelectedRequest(req);
    setActionStatus(status);
    setFeedback('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedRequest(null);
    setFeedback('');
  };

    const handleSubmit = async () => {
    let res;
    if (actionType === 'LEAVE') {
      res = await reviewLeave({ variables: { id: selectedRequest.id, status: actionStatus, adminFeedback: feedback } });
    } else if (actionType === 'SIGNUP') {
      if (actionStatus === 'APPROVED' && !selectedOffice) {
        notify.error('Please assign an office to approve this signup');
        return;
      }
      res = await reviewSignup({ variables: { id: selectedRequest.id, status: actionStatus, note: feedback, officeId: selectedOffice || undefined } });
    } else {
      res = await reviewAtt({ variables: { id: selectedRequest.id, status: actionStatus, adminComments: feedback } });
    }
    
    if (!res?.error) {
      handleCloseDialog();
    }
  };

  const leaveColumns = [
    { id: 'employeeId', label: 'Emp ID', width: 130, valueGetter: (row) => row?.user?.employeeId || '', render: (row) => renderEmpId(row?.user?.employeeId) },
    { id: 'name', label: 'Name', width: 180, valueGetter: (row) => row?.user?.name || '', render: (row) => row?.user?.name || '' },
    { id: 'leaveType', label: 'Type', width: 130, render: (row) => `${row.leaveType.charAt(0)}${row.leaveType.slice(1).toLowerCase()} Leave` },
    {
      id: 'dates',
      label: 'Dates',
      width: 220,
      valueGetter: (row) => `${dayjs(row.startDate).format('MMM D')} - ${dayjs(row.endDate).format('MMM D, YYYY')}`,
      render: (row) => (
        <Typography variant="body2">
          {dayjs(row.startDate).format('MMM D')} - {dayjs(row.endDate).format('MMM D, YYYY')}
        </Typography>
      )
    },
    { id: 'reason', label: 'Reason', width: '30%' },
    {
      id: 'actions',
      label: 'Actions',
      width: 200,
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1}>
          <AppButton color="success" size="small" onClick={() => handleOpenDialog('LEAVE', row, 'APPROVED')}>
            Approve
          </AppButton>
          <AppButton variant="outlined" color="error" size="small" onClick={() => handleOpenDialog('LEAVE', row, 'REJECTED')}>
            Reject
          </AppButton>
        </Stack>
      ),
    }
  ];


  // Self-signup requests – Employee ID & Google both land here as PENDING
  const signupColumns = [
    { id: 'employeeId', label: 'Emp ID', width: 120 },
    { id: 'name', label: 'Name', width: 180 },
    { id: 'email', label: 'Email', width: 240, sortable: false },
        {
      id: 'loginMethod',
      label: 'Method',
      width: 110,
      align: 'center',
      sortable: false,
      render: (row) => (
        <StatusBadge status={row.loginMethod === 'GOOGLE' ? 'INFO' : 'DEFAULT'} label={row.loginMethod || 'PASSWORD'} size="small" />
      ),
    },
    {
      id: 'createdAt',
      label: 'Requested On',
      width: 140,
      valueGetter: (row) => dayjs(row.createdAt).format('DD MMM YYYY'),
      render: (row) => (
        <Typography variant="body2">{dayjs(row.createdAt).format('DD MMM YYYY')}</Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 200,
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1}>
          <AppButton color="success" size="small" onClick={() => handleOpenDialog('SIGNUP', row, 'APPROVED')}>
            Approve
          </AppButton>
          <AppButton variant="outlined" color="error" size="small" onClick={() => handleOpenDialog('SIGNUP', row, 'REJECTED')}>
            Reject
          </AppButton>
        </Stack>
      ),
    },
  ];


  // Flagged / regularized punches awaiting admin review
  const attendanceColumns = [
    { id: 'employeeId', label: 'Emp ID', width: 120, valueGetter: (row) => row?.user?.employeeId || '', render: (row) => renderEmpId(row?.user?.employeeId) },
    { id: 'name', label: 'Name', width: 160, valueGetter: (row) => row?.user?.name || '', render: (row) => row?.user?.name || '' },
    { id: 'date', label: 'Date', width: 120, render: (row) => <Typography variant="body2">{dayjs(row.date).format('DD MMM')}</Typography> },
    {
      id: 'photo',
      label: 'Photo',
      width: 70,
      align: 'center',
      sortable: false,
      render: (row) => (
        row.clockIn?.selfieUrl ? (
          <Avatar
            variant="rounded"
            src={row.clockIn.selfieUrl}
            sx={{ width: 40, height: 40, cursor: 'pointer' }}
            onClick={() => window.open(row.clockIn.selfieUrl, '_blank')}
          />
        ) : (
          <Typography variant="caption" color="text.secondary">—</Typography>
        )
      )
    },
    {
      id: 'punchIn',
      label: 'In',
      width: 130,
      sortable: false,
      render: (row) =>
        row.clockIn ? (
          <Stack spacing={0.25}>
            <Typography variant="body2">{dayjs(row.clockIn.createdAt).format('HH:mm:ss')}</Typography>
            {row.clockIn.vpnDetected && (
              <Typography variant="caption" color="warning.main">VPN flagged</Typography>
            )}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">—</Typography>
        ),
    },
    {
      id: 'punchOut',
      label: 'Out',
      width: 100,
      sortable: false,
      render: (row) => (
        <Typography variant="body2">{row.clockOut ? dayjs(row.clockOut.createdAt).format('HH:mm:ss') : '—'}</Typography>
      ),
    },
    {
      id: 'face',
      label: 'Face Check',
      width: 120,
      align: 'center',
      sortable: false,
      render: (row) => {
        const fm = row.clockIn?.faceMatched;
        if (fm === undefined || fm === null) {
          return <Typography variant="caption" color="text.disabled">—</Typography>;
        }
        return fm ? (
          <Chip size="small" label="Match" color="success" variant="outlined" sx={{ height: 22 }} />
        ) : (
          <Chip
            size="small"
            label={`Mismatch${row.clockIn?.faceMatchScore != null ? ` (${Number(row.clockIn.faceMatchScore).toFixed(2)})` : ''}`}
            color="warning"
            sx={{ height: 22 }}
          />
        );
      },
    },
    {
      id: 'approvalStatus',
      label: 'Review Status',
      width: 140,
      align: 'center',
      sortable: false,
      render: (row) => <StatusBadge status={row.clockIn?.approvalStatus || 'PENDING'} size="small" />,
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 200,
      sortable: false,
      render: (row) =>
        row.clockIn?.approvalStatus === 'PENDING' ? (
          <Stack direction="row" spacing={1}>
            <AppButton color="success" size="small" onClick={() => handleOpenDialog('ATTENDANCE', row.clockIn, 'APPROVED')}>
              Approve
            </AppButton>
            <AppButton variant="outlined" color="error" size="small" onClick={() => handleOpenDialog('ATTENDANCE', row.clockIn, 'REJECTED')}>
              Reject
            </AppButton>
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">No action needed</Typography>
        ),
    },
  ];

  const reviewing = actionType === 'LEAVE' ? reviewingLeave : reviewingAtt;

  return (
    <Box>
      {/* Title-level tab navigation lives inside PageHeader */}
      <PageHeader
        title="Approvals"
        subtitle="Review pending leave and attendance requests"
        backButton="/"
        tabs={[
          { label: 'Leave Requests', value: 0 },
          { label: 'Attendance Punches', value: 1 },
          { label: 'Signups', value: 2 },
        ]}
        activeTab={tab}
        onTabChange={(_, v) => setTab(v)}
      />

      <Card variant="outlined">
        {tab === 0 && (
          <GenericDataGrid
            rows={leaveData?.allLeaveRequests || []}
            columns={leaveColumns}
            loading={leaveLoading}
            error={leaveError}
            onRetry={refetchLeaves}
            title=""
          />
        )}
        {tab === 1 && (
          <GenericDataGrid
            rows={attData?.allAttendance || []}
            columns={attendanceColumns}
            loading={attLoading}
            error={attError}
            onRetry={refetchAtt}
            title=""
          />
        )}
        {tab === 2 && (
          <GenericDataGrid
            rows={pendingUsersData?.pendingUsers || []}
            columns={signupColumns}
            loading={pendingUsersLoading}
            title=""
          />
        )}
      </Card>

      <ConfirmDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleSubmit}
        title={`${actionStatus === 'APPROVED' ? 'Approve' : 'Reject'} Request`}
        description={`Are you sure you want to ${actionStatus.toLowerCase()} this ${actionType.toLowerCase()} request?`}
        confirmText="Confirm"
        cancelText="Cancel"
        variant={actionStatus === 'APPROVED' ? 'success' : 'danger'}
        loading={reviewing}
      >
        {actionType === 'SIGNUP' && actionStatus === 'APPROVED' && (
          <TextField
            select
            fullWidth
            required
            label="Assign Site / Office"
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e.target.value)}
            sx={{ mb: 2 }}
          >
            <MenuItem value="" disabled>
              -- Select Site --
            </MenuItem>
            {(officesData?.offices || []).map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          label="Comments / Feedback (Optional)"
          multiline
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          fullWidth
        />
      </ConfirmDialog>
    </Box>
  );
};

export default ApprovalsPage;




