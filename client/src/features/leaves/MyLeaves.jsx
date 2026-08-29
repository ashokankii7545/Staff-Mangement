import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { useState } from 'react';
import { useSubscription } from '@apollo/client';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import { GET_ME, GET_MY_LEAVE_REQUESTS } from '../../graphql/queries';
import { CANCEL_MY_LEAVE } from '../../graphql/mutations';
import { ON_LEAVE_REQUEST_UPDATED } from '../../graphql/subscriptions';
import ApplyLeaveModal from './components/ApplyLeaveModal';
import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import StatusBadge from '../../shared/ui/StatusBadge';
import StatCard from '../../shared/ui/StatCard';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import GenericDialog from '../../shared/ui/GenericDialog';
import Typography from '@mui/material/Typography';
import { useNotification } from '../../shared/ui';

const MyLeaves = () => {
  const notify = useNotification();
  const { data: userData } = useAppQuery(GET_ME, { fetchPolicy: 'cache-and-network' });
  const { data: leavesData, loading, error, refetch } = useAppQuery(GET_MY_LEAVE_REQUESTS, {
    fetchPolicy: 'network-only',
    pollInterval: 5000,
  });

  useSubscription(ON_LEAVE_REQUEST_UPDATED, {
    onData: () => {
      refetch();
    },
    onError: (err) => {
      console.error('WS Error:', err);
    },
  });

  const [open, setOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const [cancelMyLeave, { loading: cancelling }] = useAppMutation(CANCEL_MY_LEAVE, {
    successMessage: 'Leave cancelled – the owner has been informed',
    onCompleted: () => setCancelTarget(null),
    refetchQueries: [{ query: GET_MY_LEAVE_REQUESTS }],
    onError: (err) => notify.error(err.message),
  });

  const balances = userData?.me?.leaveBalances || { casual: 12, sick: 6, earned: 0 };

  const columns = [
    {
      id: 'leaveType',
      label: 'Leave Type',
      width: 140,
      valueGetter: (row) => `${row.leaveType.charAt(0)}${row.leaveType.slice(1).toLowerCase()} Leave`,
      render: (row) => `${row.leaveType.charAt(0)}${row.leaveType.slice(1).toLowerCase()} Leave`,
    },
    {
      id: 'startDate',
      label: 'From',
      width: 120,
      valueGetter: (row) => dayjs(row.startDate).format('DD MMM YYYY'),
      render: (row) => dayjs(row.startDate).format('DD MMM YYYY'),
    },
    {
      id: 'endDate',
      label: 'To',
      width: 120,
      valueGetter: (row) => dayjs(row.endDate).format('DD MMM YYYY'),
      render: (row) => dayjs(row.endDate).format('DD MMM YYYY'),
    },
    {
      id: 'days',
      label: 'Days',
      width: 90,
      valueGetter: (row) => dayjs(row.endDate).diff(dayjs(row.startDate), 'day') + 1,
      render: (row) => dayjs(row.endDate).diff(dayjs(row.startDate), 'day') + 1,
    },
    {
      id: 'reason',
      label: 'Reason',
      width: '30%',
      sortable: false,
    },
    {
      id: 'status',
      label: 'Status',
      width: 120,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'adminFeedback',
      label: 'Admin Remarks',
      width: '20%',
      sortable: false,
      // FIX: was a mangled `'"?'` literal – now a proper em-dash placeholder
      render: (row) => row.adminFeedback || '—',
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 110,
      align: 'center',
      sortable: false,
      // Staff can withdraw their own PENDING/APPROVED leaves – admin is notified
      render: (row) =>
        ['PENDING', 'APPROVED'].includes(row.status) ? (
          <AppButton size="small" variant="outlined" color="error" onClick={() => setCancelTarget(row)}>
            Cancel
          </AppButton>
        ) : null,
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <PageHeader
        title="My Leave Requests"
        subtitle="Track your leave applications and balances"
        action={
          <AppButton color="primary" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Apply for Leave
          </AppButton>
        }
      />

      {/* Balance cards – shared StatCard keeps dashboard KPIs consistent */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            icon={BeachAccessOutlinedIcon}
            label="Casual Leave Balance"
            value={balances.casual}
            meta="12 days credited annually"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            icon={LocalHospitalOutlinedIcon}
            label="Sick Leave Balance"
            value={balances.sick}
            meta="6 days credited annually"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            icon={TrendingUpIcon}
            label="Earned Leave Balance"
            value={balances.earned}
            meta="Accumulated balance"
          />
        </Grid>
      </Grid>

      <Card sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <GenericDataGrid
          title="Past Applications"
          stateKey="my-leaves"
          rows={leavesData?.myLeaveRequests || []}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={refetch}
          sortBy="startDate"
          sortDirection="desc"
        />
      </Card>

      <ApplyLeaveModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={refetch}
      />

      {/* Cancel confirmation – admin is always informed of the withdrawal */}
      <GenericDialog
        open={!!cancelTarget}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="Cancel Leave Request?"
        maxWidth="xs"
        actions={
          <>
            <AppButton variant="outlined" color="inherit" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Keep It
            </AppButton>
            <AppButton
              variant="contained"
              color="error"
              loading={cancelling}
              onClick={() => cancelMyLeave({ variables: { id: cancelTarget.id } })}
            >
              Yes, Cancel Leave
            </AppButton>
          </>
        }
      >
        <Typography variant="body2" color="text.secondary">
          {cancelTarget?.status === 'APPROVED'
            ? 'This leave was approved and your balance was deducted. Cancelling will refund the days to your balance and the owner will be informed.'
            : 'Your pending request will be withdrawn and the owner will be informed.'}
        </Typography>
      </GenericDialog>
    </Box>
  );
};

export default MyLeaves;
