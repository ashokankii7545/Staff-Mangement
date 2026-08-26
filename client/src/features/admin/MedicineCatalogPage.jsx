import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import InputAdornment from '@mui/material/InputAdornment';
import MedicationIcon from '@mui/icons-material/Medication';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';
import SearchIcon from '@mui/icons-material/Search';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockIcon from '@mui/icons-material/Block';
import ReplayIcon from '@mui/icons-material/Replay';

import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import EmptyState from '../../shared/ui/EmptyState';
import DataListSkeleton from '../../shared/ui/DataListSkeleton';
import ConfirmDialog from '../../shared/ui/ConfirmDialog';
import { GenericDialog, GenericFormEngine, useNotification } from '../../shared/ui';
import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { z } from 'zod';
import { GET_MEDICINES } from '../../graphql/queries';
import {
  CREATE_MEDICINE,
  UPDATE_MEDICINE,
  REMOVE_MEDICINE,
  RESTORE_MEDICINE,
} from '../../graphql/mutations';
import MedicineImagePicker from './components/MedicineImagePicker';
import {
  MEDICINE_DOSAGE_FORMS,
  MEDICINE_SCHEDULES,
  MEDICINE_CATEGORIES,
  MEDICINE_GST_RATES,
  isPrescriptionRequired,
} from '../../shared/constants';

// ── Validation – mirrors the server contract in MedicineCatalogInputShape ────
const MEDICINE_SCHEMA = z.object({
  // Basic Information
  name: z.string().min(1, 'Brand name is required').max(120, 'Name is too long'),
  genericName: z.string().optional(),
  manufacturer: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  packSize: z.string().optional(),
  category: z.string().optional(),
  schedule: z.enum(['OTC', 'H', 'H1', 'X']),
  // Pricing (billing)
  price: z.coerce
    .number({ invalid_type_error: 'MRP must be a number' })
    .min(0, 'MRP must be 0 or more'),
  purchaseRate: z
    .union([z.literal(''), z.coerce.number().min(0, 'Purchase rate must be 0 or more')])
    .optional(),
  gstRate: z.coerce
    .number()
    .refine((v) => [0, 5, 12].includes(v), 'GST slab must be 0%, 5% or 12%'),
  // Medical information
  uses: z.string().optional(),
  dosageTiming: z.string().optional(),
  directionsForUse: z.string().optional(),
  storage: z.string().optional(),
  sideEffects: z.string().optional(),
  imageBase64: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// JSON-driven form – same engine every other dialog in the app uses, grouped
// into collapsible sections exactly like a pharmacy item-master:
// Basic Information → Pricing (billing) → Medical Information → Pack Image.
// `isActive` only appears while EDITING an existing medicine.
const medicineFields = (isEdit) => [
  // ── Basic Information ──────────────────────────────────────────────────────
  {
    type: 'section',
    label: 'Basic Information',
    icon: <MedicationIcon fontSize="small" color="primary" />,
  },
  { name: 'name', type: 'text', label: 'Brand Name *', placeholder: 'e.g. Dolo 650', gridSize: { xs: 12, sm: 6 } },
  { name: 'genericName', type: 'text', label: 'Generic Name (Salt Composition)', placeholder: 'e.g. Paracetamol 650mg', gridSize: { xs: 12, sm: 6 } },
  { name: 'manufacturer', type: 'text', label: 'Manufacturer', placeholder: 'e.g. Micro Labs Ltd', gridSize: { xs: 12, sm: 6 } },
  {
    name: 'dosageForm',
    type: 'select',
    label: 'Dosage Form',
    options: MEDICINE_DOSAGE_FORMS.map((f) => ({ value: f, label: f })),
    gridSize: { xs: 12, sm: 6 },
  },
  { name: 'strength', type: 'text', label: 'Strength', placeholder: 'e.g. 650mg', gridSize: { xs: 12, sm: 4 } },
  { name: 'packSize', type: 'text', label: 'Pack Size', placeholder: 'e.g. Strip of 15 tablets', gridSize: { xs: 12, sm: 8 } },
  {
    name: 'category',
    type: 'select',
    label: 'Therapeutic Category',
    options: MEDICINE_CATEGORIES.map((c) => ({ value: c, label: c })),
    gridSize: { xs: 12, sm: 6 },
  },
  {
    name: 'schedule',
    type: 'select',
    label: 'Drug Schedule',
    options: MEDICINE_SCHEDULES,
    helperText: 'Schedule H / H1 / X legally require a prescription.',
    gridSize: { xs: 12, sm: 6 },
  },

  // ── Pricing ────────────────────────────────────────────────────────────────
  {
    type: 'section',
    label: 'Pricing (used for billing)',
    icon: <CurrencyRupeeIcon fontSize="small" color="primary" />,
  },
  {
    name: 'price',
    type: 'number',
    label: 'MRP / Selling Rate per Unit (₹) *',
    helperText: 'Customers are billed at this rate (inclusive of GST). Staff can\'t see it.',
    props: { inputProps: { min: 0, step: '0.01' }, InputProps: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } },
    gridSize: { xs: 12, sm: 4 },
  },
  {
    name: 'purchaseRate',
    type: 'number',
    label: 'Purchase Rate (₹, optional)',
    helperText: 'Your cost price – for margin reports later.',
    props: { inputProps: { min: 0, step: '0.01' }, InputProps: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } },
    gridSize: { xs: 12, sm: 4 },
  },
  {
    name: 'gstRate',
    type: 'select',
    label: 'GST Slab',
    options: MEDICINE_GST_RATES.map((r) => ({ value: r, label: `${r}%` })),
    gridSize: { xs: 12, sm: 4 },
  },
  ...(isEdit
    ? [
        {
          name: 'isActive',
          type: 'switch',
          label: 'Active (visible to staff)',
          gridSize: { xs: 12 },
        },
      ]
    : []),

  // ── Medical Information ────────────────────────────────────────────────────
  {
    type: 'section',
    label: 'Medical Information',
    icon: <MedicalInformationIcon fontSize="small" color="primary" />,
  },
  { name: 'uses', type: 'multiline', label: 'Uses / Indication', placeholder: 'e.g. Fever, body ache, headache relief', props: { rows: 2 }, gridSize: { xs: 12 } },
  { name: 'dosageTiming', type: 'multiline', label: 'Dosage – When to Take', placeholder: 'e.g. 1-0-1 after food · max 4 doses in 24 hours', props: { rows: 2 }, gridSize: { xs: 12, sm: 6 } },
  { name: 'directionsForUse', type: 'multiline', label: 'Directions for Use', placeholder: 'e.g. Swallow whole with water · complete the full course', props: { rows: 2 }, gridSize: { xs: 12, sm: 6 } },
  { name: 'storage', type: 'text', label: 'Storage', placeholder: 'e.g. Store below 25°C, away from moisture & light', gridSize: { xs: 12 } },
  { name: 'sideEffects', type: 'multiline', label: 'Side Effects / Warnings', placeholder: 'e.g. Nausea, drowsiness · stop use & consult a doctor if rash appears', props: { rows: 2 }, gridSize: { xs: 12 } },

  // ── Pack Image ─────────────────────────────────────────────────────────────
  {
    type: 'section',
    label: 'Pack Image (optional)',
  },
  {
    name: 'imageBase64',
    type: 'custom',
    label: 'Medicine Image',
    render: ({ value, onChange }) => <MedicineImagePicker value={value} onChange={onChange} />,
    gridSize: { xs: 12 },
  },
];

const formatINR = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const BLANK_FORM = {
  name: '',
  genericName: '',
  manufacturer: '',
  dosageForm: 'Tablet',
  strength: '',
  packSize: '',
  category: '',
  schedule: 'OTC',
  price: '',
  purchaseRate: '',
  gstRate: 5,
  uses: '',
  dosageTiming: '',
  directionsForUse: '',
  storage: '',
  sideEffects: '',
  imageBase64: null,
};

const MedicineCatalogPage = () => {
  const notify = useNotification();

  // ── Data ────────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const medicinesQuery = useAppQuery(GET_MEDICINES, {
    variables: { search: searchText || undefined, includeInactive: showInactive || undefined },
    fetchPolicy: 'cache-and-network',
  });
  const medicines = medicinesQuery.data?.medicines || [];

  const refetchQueries = [{ query: GET_MEDICINES }];

  const [createMedicine, { loading: creating }] = useAppMutation(CREATE_MEDICINE, {
    successMessage: (d) => `${d.createMedicine.name} added to catalogue ✓`,
    refetchQueries,
    onError: (err) => notify.error(err.message),
  });
  const [updateMedicine, { loading: updating }] = useAppMutation(UPDATE_MEDICINE, {
    successMessage: 'Medicine updated ✓',
    refetchQueries,
    onError: (err) => notify.error(err.message),
  });
  const [removeMedicine, { loading: removing }] = useAppMutation(REMOVE_MEDICINE, {
    successMessage: 'Medicine removed from the active list',
    refetchQueries,
    onError: (err) => notify.error(err.message),
  });
  const [restoreMedicine, { loading: restoring }] = useAppMutation(RESTORE_MEDICINE, {
    successMessage: 'Medicine re-activated ✓',
    refetchQueries,
    onError: (err) => notify.error(err.message),
  });

  // ── Dialog state ────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = add-new mode
  const [confirmTarget, setConfirmTarget] = useState(null); // deactivate confirm

  const isEdit = !!editTarget;
  const saving = creating || updating;

  const openAdd = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (med) => {
    setEditTarget(med);
    setFormOpen(true);
  };

  // Remount key so the form resets cleanly between add/edit sessions.
  const formKey = editTarget?.id || 'new-medicine';

  const handleSubmit = async (values) => {
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
      isActive: isEdit ? values.isActive !== false : true,
    };
    // Purchase rate is optional – only send when the owner entered one.
    if (values.purchaseRate !== '' && values.purchaseRate !== undefined && values.purchaseRate !== null) {
      input.purchaseRate = Number(values.purchaseRate);
    }
    if (values.imageBase64) input.imageBase64 = values.imageBase64;

    if (isEdit) {
      const { error } = await updateMedicine({ variables: { id: editTarget.id, input } });
      if (!error) setFormOpen(false);
    } else {
      const { error } = await createMedicine({ variables: { input } });
      if (!error) setFormOpen(false);
    }
  };

  const initialFormValues = useMemo(() => {
    if (!editTarget) return BLANK_FORM;
    return {
      name: editTarget.name || '',
      genericName: editTarget.genericName || '',
      manufacturer: editTarget.manufacturer || '',
      dosageForm: editTarget.dosageForm || 'Tablet',
      strength: editTarget.strength || '',
      packSize: editTarget.packSize || '',
      category: editTarget.category || '',
      schedule: editTarget.schedule || 'OTC',
      price: editTarget.price ?? '',
      purchaseRate: editTarget.purchaseRate ?? '',
      gstRate: editTarget.gstRate ?? 5,
      uses: editTarget.uses || '',
      dosageTiming: editTarget.dosageTiming || '',
      directionsForUse: editTarget.directionsForUse || '',
      storage: editTarget.storage || '',
      sideEffects: editTarget.sideEffects || '',
      imageBase64: null, // keep server image unless a new file is picked
      isActive: editTarget.isActive !== false,
    };
  }, [editTarget]);

  return (
    <Box>
      <PageHeader
        title="Medicine Catalog"
        subtitle="Your master medicine list – staff request stock from here"
        action={
          <AppButton
            variant="contained"
            startIcon={<MedicationIcon fontSize="small" />}
            onClick={openAdd}
          >
            Add Medicine
          </AppButton>
        }
      />

      {/* Search + visibility filter */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mb: 2 }}
        alignItems={{ sm: 'center' }}
      >
        <TextField
          size="small"
          placeholder="Search medicines…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ width: { xs: '100%', sm: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Chip
          label={`Show removed (${medicines.filter((m) => m.isActive === false).length})`}
          clickable
          color={showInactive ? 'primary' : 'default'}
          variant={showInactive ? 'filled' : 'outlined'}
          onClick={() => setShowInactive((v) => !v)}
        />
      </Stack>

      {/* Content */}
      {medicinesQuery.loading && medicines.length === 0 ? (
        <DataListSkeleton rows={3} />
      ) : medicinesQuery.error ? (
        <EmptyState
          variant="error"
          title="Couldn't load medicines"
          description={medicinesQuery.errorMessage}
          action={<AppButton onClick={() => medicinesQuery.refetch()}>Retry</AppButton>}
        />
      ) : medicines.length === 0 ? (
        <EmptyState
          icon={MedicationIcon}
          title={searchText ? 'No medicines match your search' : 'Your catalog is empty'}
          description={
            searchText
              ? 'Try a different name, or add this medicine to your catalog.'
              : 'Add the medicines you stock so staff can pick them while raising requests.'
          }
          action={
            !searchText && (
              <AppButton variant="contained" onClick={openAdd}>
                Add First Medicine
              </AppButton>
            )
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          }}
        >
          {medicines.map((med) => (
            <Card
              key={med.id}
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                opacity: med.isActive === false ? 0.65 : 1,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                {med.image ? (
                  <Avatar
                    src={med.image}
                    alt={med.name}
                    variant="rounded"
                    sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}
                  />
                ) : (
                  <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}>
                    <MedicationIcon color="primary" />
                  </Avatar>
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>
                    {med.name}
                  </Typography>
                  {med.genericName ? (
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {med.genericName}
                    </Typography>
                  ) : null}
                  {med.manufacturer ? (
                    <Typography variant="caption" color="text.disabled" display="block" noWrap>
                      {med.manufacturer}
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }} useFlexGap flexWrap="wrap">
                    {isPrescriptionRequired(med.schedule) ? (
                      <Chip size="small" label="Rx Only" color="error" variant="outlined" sx={{ height: 20 }} />
                    ) : (
                      <Chip size="small" label="OTC" color="success" variant="outlined" sx={{ height: 20 }} />
                    )}
                    {med.dosageForm ? (
                      <Chip size="small" label={med.dosageForm} variant="outlined" sx={{ height: 20 }} />
                    ) : null}
                    <Chip size="small" label={formatINR(med.price)} color="success" variant="outlined" sx={{ height: 20 }} />
                    {med.isActive === false && (
                      <Chip size="small" label="REMOVED" color="error" sx={{ height: 20, fontWeight: 700 }} />
                    )}
                  </Stack>
                </Box>
              </Stack>

              {(med.strength || med.packSize || med.gstRate !== undefined) && (
                <Typography variant="caption" color="text.secondary">
                  {[
                    med.strength,
                    med.packSize,
                    med.gstRate !== undefined && med.gstRate !== null ? `GST ${med.gstRate}%` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              )}

              {(med.uses || med.dosageTiming || med.directionsForUse || med.storage) && <Divider />}
              {med.uses && (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                  <strong style={{ color: 'text.primary' }}>Uses:</strong> {med.uses}
                </Typography>
              )}
              {med.dosageTiming && (
                <Typography variant="caption" color="text.secondary">
                  <strong style={{ color: 'text.primary' }}>Dosage:</strong> {med.dosageTiming}
                </Typography>
              )}
              {med.directionsForUse && (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                  <strong style={{ color: 'text.primary' }}>Directions:</strong> {med.directionsForUse}
                </Typography>
              )}
              {med.storage && (
                <Typography variant="caption" color="text.secondary">
                  <strong style={{ color: 'text.primary' }}>Storage:</strong> {med.storage}
                </Typography>
              )}

              <Stack direction="row" spacing={1} sx={{ mt: 'auto', pt: 0.5 }} useFlexGap flexWrap="wrap">
                <AppButton size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(med)}>
                  Edit
                </AppButton>
                {med.isActive === false ? (
                  <AppButton
                    size="small"
                    color="success"
                    variant="outlined"
                    startIcon={<ReplayIcon />}
                    disabled={restoring}
                    onClick={() => restoreMedicine({ variables: { id: med.id } })}
                  >
                    Restore
                  </AppButton>
                ) : (
                  <AppButton
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<BlockIcon />}
                    onClick={() => setConfirmTarget(med)}
                  >
                    Remove
                  </AppButton>
                )}
                <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', alignSelf: 'center' }}>
                  {dayjs(med.createdAt).format('DD MMM YYYY')}
                </Typography>
              </Stack>
            </Card>
          ))}
        </Box>
      )}

      {/* Add / Edit dialog */}
      <GenericDialog
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={isEdit ? `Edit ${editTarget?.name}` : 'Add Medicine'}
        maxWidth="sm"
      >
        <GenericFormEngine
          key={formKey}
          fields={medicineFields(isEdit)}
          schema={MEDICINE_SCHEMA}
          initialValues={initialFormValues}
          submitLabel={isEdit ? 'Save Changes' : 'Add to Catalog'}
          hideReset
          onSubmit={handleSubmit}
        />
      </GenericDialog>

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={async () => {
          const { error } = await removeMedicine({ variables: { id: confirmTarget.id } });
          if (!error) setConfirmTarget(null);
        }}
        title={`Remove ${confirmTarget?.name}?`}
        description="It will be hidden from staff requests immediately. Old stock-request history stays intact, and you can restore it anytime."
        confirmText="Remove"
        variant="danger"
        loading={removing}
      />
    </Box>
  );
};

export default MedicineCatalogPage;


