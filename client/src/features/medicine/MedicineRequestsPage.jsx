import { useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';

import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import GenericDialog from '../../shared/ui/GenericDialog';
import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { GenericFormEngine, useNotification, ReviewDialog } from '../../shared/ui';
import { z } from 'zod';
import { useAuth } from '../../shared/auth/AuthContext';
import {
  GET_MY_MEDICINE_REQUESTS,
  GET_ALL_MEDICINE_REQUESTS,
} from '../../graphql/queries';
import { REQUEST_MEDICINE, REVIEW_MEDICINE_REQUEST } from '../../graphql/mutations';

const URGENCY_COLOR = { URGENT: 'error', NORMAL: 'primary', LOW: 'default' };
const STATUS_COLOR = { PENDING: 'warning', ORDERED: 'info', SUPPLIED: 'success', REJECTED: 'error' };
const STATUS_TABS = ['PENDING', 'ORDERED', 'SUPPLIED', 'REJECTED'];
const UNITS = ['Strips', 'Bottles', 'Units', 'Boxes'];

const REQUEST_MEDICINE_SCHEMA = z.object({
  medicineName: z.string().min(1, 'Medicine name is required'),
  strength: z.string().optional(),
  quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number' }).min(1, 'Quantity must be at least 1'),
  unit: z.enum(['Strips', 'Bottles', 'Units', 'Boxes']),
  urgency: z.enum(['LOW', 'NORMAL', 'URGENT']),
  notes: z.string().optional(),
});

// Same JSON-driven form engine every other dialog in the app uses
const REQUEST_MEDICINE_FIELDS = [
  { name: 'medicineName', type: 'text', label: 'Medicine Name', placeholder: 'e.g. Paracetamol', gridSize: { xs: 12 } },
  { name: 'strength', type: 'text', label: 'Strength (Optional)', placeholder: 'e.g. 500mg', gridSize: { xs: 12, sm: 6 } },
  { name: 'quantity', type: 'number', label: 'Quantity', props: { inputProps: { min: 1 } }, gridSize: { xs: 12, sm: 6 } },
  {
    name: 'unit',
    type: 'select',
    label: 'Unit',
    options: UNITS.map((u) => ({ value: u, label: u })),
    gridSize: { xs: 12, sm: 6 },
  },
  {
    name: 'urgency',
    type: 'select',
    label: 'Urgency',
    options: [
      { value: 'LOW', label: 'Low' },
      { value: 'NORMAL', label: 'Normal' },
      { value: 'URGENT', label: 'Urgent' },
    ],
    gridSize: { xs: 12, sm: 6 },
  },
  { name: 'notes', type: 'multiline', label: 'Notes (Optional)', placeholder: 'Brand, salt name, preferred distributor…', props: { rows: 2 }, gridSize: { xs: 12 } },
];

const MedicineRequestsPage = () => {
  const { isAdmin } = useAuth();
  const notify = useNotification();

  // ── Data ────────────────────────────────────────────────────────────────
  const myQuery = useAppQuery(GET_MY_MEDICINE_REQUESTS, {
    fetchPolicy: 'cache-and-network',
    pollInterval: isAdmin ? undefined : 20000,
  });
  const myRequests = myQuery.data?.myMedicineRequests || [];

  const [statusTab, setStatusTab] = useState('PENDING');
  const adminQuery = useAppQuery(GET_ALL_MEDICINE_REQUESTS, {
    variables: { status: statusTab },
    fetchPolicy: 'cache-and-network',
    skip: !isAdmin,
  });
  const allRequests = adminQuery.data?.allMedicineRequests || [];

  // ── Staff request form ──────────────────────────────────────────────────
  const [requestMedicine, { loading: requesting }] = useAppMutation(REQUEST_MEDICINE, {
    successMessage: 'Request sent to the owner ✓',
    onCompleted: () => setRequestOpen(false),
    refetchQueries: [{ query: GET_MY_MEDICINE_REQUESTS }],
    onError: (err) => notify.error(err.message),
  });

  const submitRequest = async (values) => {
    await requestMedicine({
      variables: {
        input: {
          medicineName: values.medicineName.trim(),
          strength: (values.strength || '').trim(),
          quantity: Number(values.quantity),
          unit: values.unit,
          urgency: values.urgency,
          notes: (values.notes || '').trim(),
        },
      },
    });
  };

  // ── Admin review ────────────────────────────────────────────────────────
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [requestOpen, setRequestOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);

  // Smart default: PENDING → ORDERED next step; ORDERED → SUPPLIED; else REJECT
  const reviewNextStatus =
    reviewTarget?.status === 'PENDING' ? 'ORDERED' : reviewTarget?.status === 'ORDERED' ? 'SUPPLIED' : 'REJECTED';

  const openReview = (row) => setReviewTarget(row);

  const [reviewMedicine, { loading: reviewing }] = useAppMutation(REVIEW_MEDICINE_REQUEST, {
    successMessage: 'Stock request updated',
    refetchQueries: [
      { query: GET_ALL_MEDICINE_REQUESTS, variables: { status: statusTab } },
      { query: GET_MY_MEDICINE_REQUESTS },
    ],
    onError: (err) => notify.error(err.message),
  });

  // ── Columns ─────────────────────────────────────────────────────────────
  const staffColumns = [
    { id: 'medicineName', label: 'Medicine', width: 200, render: (r) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{r.medicineName}</Typography>
          {r.strength && <Typography variant="caption" color="text.secondary">{r.strength}</Typography>}
        </Box>
      ) },
    { id: 'quantity', label: 'Quantity', width: 110, render: (r) => `${r.quantity} ${r.unit}` },
    { id: 'urgency', label: 'Urgency', width: 100, align: 'center', render: (r) => (
        <Chip size="small" label={r.urgency} color={URGENCY_COLOR[r.urgency] || 'default'} variant="outlined" sx={{ height: 22 }} />
      ) },
    { id: 'status', label: 'Status', width: 120, align: 'center', render: (r) => (
        <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || 'default'} sx={{ height: 22, fontWeight: 700 }} />
      ) },
    { id: 'adminFeedback', label: "Owner's Response", width: 220, sortable: false, render: (r) =>
        r.adminFeedback ? <Typography variant="caption">{r.adminFeedback}</Typography> : <Typography variant="caption" color="text.secondary">—</Typography> },
    { id: 'createdAt', label: 'Requested On', width: 130, valueGetter: (r) => r.createdAt, render: (r) => (
        <Typography variant="body2">{dayjs(r.createdAt).format('DD MMM YYYY')}</Typography>
      ) },
  ];

  const adminColumns = [
    { id: 'medicineName', label: 'Medicine', width: 190, render: (r) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{r.medicineName}</Typography>
          {r.strength && <Typography variant="caption" color="text.secondary">{r.strength}</Typography>}
        </Box>
      ) },
    { id: 'quantity', label: 'Qty', width: 100, render: (r) => `${r.quantity} ${r.unit}` },
    { id: 'urgency', label: 'Urgency', width: 95, align: 'center', render: (r) => (
        <Chip size="small" label={r.urgency} color={URGENCY_COLOR[r.urgency] || 'default'} variant="outlined" sx={{ height: 22 }} />
      ) },
    { id: 'requestedBy', label: 'Requested By', width: 170, sortable: false, render: (r) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>{r.requestedBy?.name?.charAt(0)}</Avatar>
          <Box>
            <Typography variant="body2" fontSize={13} fontWeight={600}>{r.requestedBy?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{r.requestedBy?.employeeId}</Typography>
          </Box>
        </Stack>
      ) },
    { id: 'notes', label: 'Notes', width: 180, sortable: false, render: (r) =>
        r.notes ? <Typography variant="caption">{r.notes}</Typography> : <Typography variant="caption" color="text.secondary">—</Typography> },
    { id: 'status', label: 'Status', width: 115, align: 'center', render: (r) => (
        <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || 'default'} sx={{ height: 22, fontWeight: 700 }} />
      ) },
    { id: 'actions', label: 'Actions', width: 130, sortable: false, render: (r) => (
        <AppButton size="small" onClick={() => openReview(r)}>Review</AppButton>
      ) },
  ];

  return (
    <Box>
      <PageHeader
        title="Stock Requests"
        subtitle={isAdmin ? 'Plan medicine purchasing from staff requests' : 'Flag medicines that are out of stock'}
        action={!isAdmin ? (
          <AppButton
            variant="contained"
            startIcon={<LocalPharmacyIcon fontSize="small" />}
            onClick={() => setRequestOpen(true)}
          >
            Request Medicine
          </AppButton>
        ) : undefined}
      />
      
      {isAdmin ? (
        <Card variant="outlined">
          <Tabs value={statusTab} onChange={(e, v) => setStatusTab(v)} sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider' }}>
            {STATUS_TABS.map(tab => <Tab key={tab} label={tab} value={tab} />)}
          </Tabs>
          <GenericDataGrid
            title={`${statusTab.charAt(0)}${statusTab.slice(1).toLowerCase()} Requests`}
            rows={allRequests}
            columns={adminColumns}
            loading={adminQuery.loading}
            error={adminQuery.error}
            onRetry={() => adminQuery.refetch()}
          />
        </Card>
      ) : (
        <>
          {/* Request history */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1" fontWeight={700}>
              My Requests
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {[['ALL', 'All'], ['PENDING', 'Pending'], ['ORDERED', 'Ordered'], ['SUPPLIED', 'Supplied'], ['REJECTED', 'Rejected']].map(([key, label]) => (
                <Chip
                  key={key}
                  label={`${label} · ${key === 'ALL' ? myRequests.length : myRequests.filter(r => r.status === key).length}`}
                  size="small"
                  clickable
                  color={staffFilter === key ? 'primary' : 'default'}
                  variant={staffFilter === key ? 'filled' : 'outlined'}
                  onClick={() => setStaffFilter(key)}
                />
              ))}
            </Stack>
          </Stack>

          <GenericDataGrid
            rows={staffFilter === 'ALL' ? myRequests : myRequests.filter(r => r.status === staffFilter)}
            columns={staffColumns}
            loading={myQuery.loading}
            error={myQuery.error}
            onRetry={() => myQuery.refetch()}
          />
        </>
      )}

      {/* Staff – new medicine request dialog */}
      <GenericDialog
        open={requestOpen}
        onClose={() => !requesting && setRequestOpen(false)}
        title="Request Medicine"
        maxWidth="sm"
      >
        <GenericFormEngine
          fields={REQUEST_MEDICINE_FIELDS}
          schema={REQUEST_MEDICINE_SCHEMA}
          initialValues={{ medicineName: '', strength: '', quantity: '', unit: 'Strips', urgency: 'NORMAL', notes: '' }}
          submitLabel="Submit Request"
          hideReset
          onSubmit={submitRequest}
        />
      </GenericDialog>


      {/* Admin Review Dialog */}
      <ReviewDialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title="Review Request"
        loading={reviewing}
        details={[
          {
            label: 'Medicine',
            value: `${reviewTarget?.medicineName ?? ''}${reviewTarget?.strength ? ` (${reviewTarget.strength})` : ''}`,
          },
          { label: 'Quantity', value: `${reviewTarget?.quantity ?? ''} ${reviewTarget?.unit ?? ''}` },
        ]}
        options={[
          { value: 'ORDERED', label: 'Mark as Ordered' },
          { value: 'SUPPLIED', label: 'Mark as Supplied' },
          { value: 'REJECTED', label: 'Reject' },
        ]}
        initialDecision={reviewNextStatus}
        onSubmit={(decision, feedbackText) =>
          reviewMedicine({
            variables: { id: reviewTarget.id, status: decision, adminFeedback: feedbackText },
          })
        }
      />
    </Box>
  );
};

export default MedicineRequestsPage;
