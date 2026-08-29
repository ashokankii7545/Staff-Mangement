import { useMemo, useState } from 'react';
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

import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import GenericDialog from '../../shared/ui/GenericDialog';
import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import ConfirmDialog from '../../shared/ui/ConfirmDialog';
import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { GenericFormEngine, useNotification, ReviewDialog } from '../../shared/ui';
import { z } from 'zod';
import { useAuth } from '../../shared/auth/AuthContext';
import {
  GET_MY_MEDICINE_REQUESTS,
  GET_ALL_MEDICINE_REQUESTS,
  GET_MEDICINES,
} from '../../graphql/queries';
import {
  REQUEST_MEDICINE,
  REVIEW_MEDICINE_REQUEST,
  CANCEL_MY_MEDICINE_REQUEST,
  CREATE_MEDICINE,
} from '../../graphql/mutations';
import MedicineWizard, { BLANK_MEDICINE } from '../admin/components/MedicineWizard';

const URGENCY_COLOR = { URGENT: 'error', NORMAL: 'primary', LOW: 'default' };
const STATUS_COLOR = { PENDING: 'warning', ORDERED: 'info', SUPPLIED: 'success', REJECTED: 'error' };
const STATUS_TABS = ['PENDING', 'ORDERED', 'SUPPLIED', 'REJECTED'];
const UNITS = ['Strips', 'Bottles', 'Units', 'Boxes'];

const REQUEST_MEDICINE_SCHEMA = z
  .object({
    nameMode: z.enum(['SELECT', 'NEW']),
    catalogMedicineId: z.string().optional(),
    medicineName: z.string().optional(),
    strength: z.string().optional(),
    quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number' }).min(1, 'Quantity must be at least 1'),
    unit: z.enum(['Strips', 'Bottles', 'Units', 'Boxes']),
    urgency: z.enum(['LOW', 'NORMAL', 'URGENT']),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.nameMode === 'SELECT' && !data.catalogMedicineId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['catalogMedicineId'],
        message: 'Select a medicine from the list',
      });
    }
    if (data.nameMode === 'NEW' && !(data.medicineName || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['medicineName'],
        message: 'Type the medicine name',
      });
    }
  });

// JSON-driven form – same engine every other dialog uses. Staff either PICKS a
// medicine from the owner's catalogue (searchable) or flags it as brand-new.
const buildRequestFields = (medicineOptions) => [
  {
    name: 'nameMode',
    type: 'radio',
    label: 'Medicine',
    options: [
      { value: 'SELECT', label: 'Select from shop list' },
      { value: 'NEW', label: 'New medicine (not in list)' },
    ],
    gridSize: { xs: 12 },
  },
  {
    name: 'catalogMedicineId',
    type: 'autocomplete',
    label: 'Search Medicine',
    options: medicineOptions,
    helperText: 'Start typing to search the shop catalogue',
    condition: (values) => values.nameMode === 'SELECT',
    autocompleteProps: { noOptionsText: 'No match – switch to “New medicine” below' },
    gridSize: { xs: 12 },
  },
  {
    name: 'medicineName',
    type: 'text',
    label: 'Medicine Name *',
    placeholder: 'e.g. Paracetamol',
    helperText: 'Owner ko notify hoga ki ye medicine list me nahi hai – wo baad me add kar lega.',
    condition: (values) => values.nameMode === 'NEW',
    gridSize: { xs: 12 },
  },
  {
    name: 'strength',
    type: 'text',
    label: 'Strength (Optional)',
    placeholder: 'e.g. 500mg',
    condition: (values) => values.nameMode === 'NEW',
    gridSize: { xs: 12, sm: 6 },
  },
  {
    name: 'quantity',
    type: 'number',
    label: 'Quantity',
    props: { inputProps: { min: 1 } },
    gridSize: { xs: 12, sm: 6 },
  },
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

  // Master catalogue for the staff request picker (active medicines only).
  const medicinesQuery = useAppQuery(GET_MEDICINES, {
    skip: isAdmin,
    fetchPolicy: 'cache-and-network',
  });
  const medicineOptions = useMemo(
    () =>
      (medicinesQuery.data?.medicines || []).map((m) => ({
        // Netmeds-style picker label: brand (strength) · form · salt – so staff
        // can pick the right product even when two brands share a salt.
        label: [
          `${m.name}${m.strength ? ` (${m.strength})` : ''}`,
          m.dosageForm,
          m.genericName,
        ]
          .filter(Boolean)
          .join(' · '),
        value: m.id,
      })),
    [medicinesQuery.data],
  );

  const [statusTab, setStatusTab] = useState('PENDING');
  const adminQuery = useAppQuery(GET_ALL_MEDICINE_REQUESTS, {
    variables: { status: statusTab },
    fetchPolicy: 'cache-and-network',
    skip: !isAdmin,
    pollInterval: isAdmin ? 20000 : undefined, // stay in sync with the dashboard ActionCenter
  });
  const allRequests = adminQuery.data?.allMedicineRequests || [];

  // ── Staff request form ──────────────────────────────────────────────────
  const [requestMedicine, { loading: requesting }] = useAppMutation(REQUEST_MEDICINE, {
    successMessage: (d) =>
      d.requestMedicine.isNewMedicine
        ? 'Request sent ✓ Owner ko "new medicine" alert chala gaya'
        : 'Request sent to the owner ✓',
    onCompleted: () => setRequestOpen(false),
    refetchQueries: [{ query: GET_MY_MEDICINE_REQUESTS }],
    onError: (err) => notify.error(err.message),
  });

  const REQUEST_FIELDS = buildRequestFields(medicineOptions);

  const submitRequest = async (values) => {
    const input = {
      quantity: Number(values.quantity),
      unit: values.unit,
      urgency: values.urgency,
      notes: (values.notes || '').trim(),
    };
    if (values.nameMode === 'SELECT') {
      input.catalogMedicineId = values.catalogMedicineId;
    } else {
      input.medicineName = values.medicineName.trim();
      input.strength = (values.strength || '').trim();
    }
    await requestMedicine({ variables: { input } });
  };

  // ── Admin review ────────────────────────────────────────────────────────
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [requestOpen, setRequestOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);

  // Smart default: PENDING → ORDERED next step; ORDERED → SUPPLIED; else REJECT
  const reviewNextStatus =
    reviewTarget?.status === 'PENDING' ? 'ORDERED' : reviewTarget?.status === 'ORDERED' ? 'SUPPLIED' : 'REJECTED';

  const openReview = (row) => setReviewTarget(row);

  // Refetch BOTH the active-tab query AND the PENDING key the dashboard
  // ActionCenter reads, so the two admin surfaces stay in sync after a review.
  const medicineRefetchQueries = [
    { query: GET_ALL_MEDICINE_REQUESTS, variables: { status: statusTab } },
    { query: GET_ALL_MEDICINE_REQUESTS, variables: { status: 'PENDING' } },
    { query: GET_MY_MEDICINE_REQUESTS },
  ];

  const [reviewMedicine, { loading: reviewing }] = useAppMutation(REVIEW_MEDICINE_REQUEST, {
    successMessage: 'Stock request updated',
    refetchQueries: medicineRefetchQueries,
    onError: (err) => notify.error(err.message),
  });

  // ── A: staff cancels their own PENDING request ──────────────────────────
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelRequest, { loading: cancelling }] = useAppMutation(CANCEL_MY_MEDICINE_REQUEST, {
    successMessage: 'Request cancelled',
    refetchQueries: [{ query: GET_MY_MEDICINE_REQUESTS }],
    onCompleted: () => setCancelTarget(null),
    onError: (err) => notify.error(err.message),
  });

  // ── C: admin adds a NEW-medicine request straight into the catalogue ────
  const [addToCatalog, setAddToCatalog] = useState(null); // the request being added
  const [createMedicine, { loading: creatingCatalog }] = useAppMutation(CREATE_MEDICINE, {
    successMessage: (d) => `${d.createMedicine.name} added to catalogue`,
    onCompleted: () => setAddToCatalog(null),
    onError: (err) => notify.error(err.message),
  });

  const submitAddToCatalog = async (values) => {
    const input = {
      name: values.name.trim(),
      genericName: (values.genericName || '').trim(),
      manufacturer: (values.manufacturer || '').trim(),
      dosageForm: (values.dosageForm || '').trim(),
      strength: (values.strength || '').trim(),
      packSize: (values.packSize || '').trim(),
      category: (values.category || '').trim(),
      schedule: values.schedule || 'OTC',
      uses: (values.uses || '').trim(),
      dosageTiming: (values.dosageTiming || '').trim(),
      directionsForUse: (values.directionsForUse || '').trim(),
      storage: (values.storage || '').trim(),
      sideEffects: (values.sideEffects || '').trim(),
      price: Number(values.price),
      gstRate: Number(values.gstRate),
      isActive: true,
    };
    if (values.purchaseRate !== '' && values.purchaseRate != null) input.purchaseRate = Number(values.purchaseRate);
    if (values.imageBase64) input.imageBase64 = values.imageBase64;
    await createMedicine({ variables: { input } });
  };

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
    { id: 'actions', label: '', width: 60, align: 'center', sortable: false, render: (r) =>
        r.status === 'PENDING' ? (
          <Tooltip title="Cancel request">
            <IconButton size="small" color="error" onClick={() => setCancelTarget(r)} aria-label="Cancel request">
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        ) },
  ];

  const adminColumns = [
    { id: 'medicineName', label: 'Medicine', width: 190, render: (r) => (
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" fontWeight={600}>{r.medicineName}</Typography>
            {r.isNewMedicine && (
              <Chip size="small" label="NEW" color="error" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />
            )}
          </Stack>
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
            stateKey="medicine-requests-admin"
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
            stateKey="medicine-requests-staff"
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
          key={requestOpen ? 'request-open' : 'request-closed'}
          fields={REQUEST_FIELDS}
          schema={REQUEST_MEDICINE_SCHEMA}
          initialValues={{ nameMode: 'SELECT', catalogMedicineId: '', medicineName: '', strength: '', quantity: '', unit: 'Strips', urgency: 'NORMAL', notes: '' }}
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
          {
            label: 'Catalog',
            value: reviewTarget?.isNewMedicine
              ? '⚠ Not in your catalogue yet – add it from Medicine Catalog'
              : '✓ Already in catalogue',
          },
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
      >
        {/* C: one-click add a brand-new medicine into the catalogue without
            leaving the review – opens the wizard pre-filled with the request. */}
        {reviewTarget?.isNewMedicine && (
          <AppButton
            variant="outlined"
            fullWidth
            startIcon={<AddCircleOutlineIcon fontSize="small" />}
            onClick={() => { const t = reviewTarget; setReviewTarget(null); setAddToCatalog(t); }}
            sx={{ mb: 1 }}
          >
            Add “{reviewTarget.medicineName}” to catalogue
          </AppButton>
        )}
      </ReviewDialog>

      {/* A: cancel-own-request confirm (staff) */}
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => !cancelling && setCancelTarget(null)}
        onConfirm={() => cancelRequest({ variables: { id: cancelTarget.id } })}
        loading={cancelling}
        title="Cancel this request?"
        description={`Your pending request for “${cancelTarget?.medicineName ?? ''}” will be withdrawn. This can't be undone.`}
        confirmText="Cancel Request"
        cancelText="Keep"
        variant="danger"
      />

      {/* C: add-to-catalogue wizard, pre-filled from the request */}
      {addToCatalog && (
        <MedicineWizard
          open
          mode="add"
          saving={creatingCatalog}
          onClose={() => setAddToCatalog(null)}
          onSubmit={submitAddToCatalog}
          initialValues={{
            ...BLANK_MEDICINE,
            name: addToCatalog.medicineName || '',
            strength: addToCatalog.strength || '',
          }}
        />
      )}
    </Box>
  );
};

export default MedicineRequestsPage;
