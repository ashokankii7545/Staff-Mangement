import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import MedicationIcon from '@mui/icons-material/Medication';

import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import ConfirmDialog from '../../shared/ui/ConfirmDialog';
import StatusBadge from '../../shared/ui/StatusBadge';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import { useNotification } from '../../shared/ui';
import { useAppQuery, useAppMutation, usePersistentGridState } from '../../shared/hooks';
import { GET_MEDICINES_PAGINATED } from '../../graphql/queries';
import {
  CREATE_MEDICINE,
  UPDATE_MEDICINE,
  REMOVE_MEDICINE,
  RESTORE_MEDICINE,
} from '../../graphql/mutations';
import MedicineWizard, { BLANK_MEDICINE } from './components/MedicineWizard';
import { isPrescriptionRequired } from '../../shared/constants';

const formatINR = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));

const MedicineCatalogPage = () => {
  const notify = useNotification();

  // ── Server-side pagination + search (shared GenericDataGrid pattern) ──────
    const { page, setPage, rowsPerPage, setRowsPerPage, search, setSearch } = usePersistentGridState('medicine-catalogue');
  const [showInactive, setShowInactive] = useState(false);

  const medicinesQuery = useAppQuery(GET_MEDICINES_PAGINATED, {
    variables: {
      pagination: { page: page + 1, limit: rowsPerPage, search: search || undefined },
      includeInactive: showInactive || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });
  const rows = medicinesQuery.data?.medicinesPaginated?.data || [];
  const totalCount = medicinesQuery.data?.medicinesPaginated?.pageInfo?.totalCount || 0;

  const refetchQueries = [
    {
      query: GET_MEDICINES_PAGINATED,
      variables: {
        pagination: { page: page + 1, limit: rowsPerPage, search: search || undefined },
        includeInactive: showInactive || undefined,
      },
    },
  ];

  const [createMedicine, { loading: creating }] = useAppMutation(CREATE_MEDICINE, {
    successMessage: (d) => `${d.createMedicine.name} added to catalogue`,
    refetchQueries,
    onError: (err) => notify.error(err.message),
  });
  const [updateMedicine, { loading: updating }] = useAppMutation(UPDATE_MEDICINE, {
    successMessage: 'Medicine updated',
    refetchQueries,
    onError: (err) => notify.error(err.message),
  });
  const [removeMedicine, { loading: removing }] = useAppMutation(REMOVE_MEDICINE, {
    successMessage: 'Medicine removed from the active list',
    refetchQueries,
    onError: (err) => notify.error(err.message),
  });
  const [restoreMedicine, { loading: restoring }] = useAppMutation(RESTORE_MEDICINE, {
    successMessage: 'Medicine re-activated',
    refetchQueries,
    onError: (err) => notify.error(err.message),
  });

  // ── Dialog state – ONE wizard, three modes ('add' | 'edit' | 'view') ──────
  const [dialogMode, setDialogMode] = useState(null); // null = closed
  const [dialogTarget, setDialogTarget] = useState(null); // medicine being viewed/edited
  const [confirmTarget, setConfirmTarget] = useState(null); // remove confirm

  const isEdit = dialogMode === 'edit';
  const saving = creating || updating;
  // Remount key so the form resets between rows / add / view→edit transitions.
  const formKey = `${dialogMode}-${dialogTarget?.id || 'new'}`;

  const openAdd = () => {
    setDialogTarget(null);
    setDialogMode('add');
  };
  const openView = (med) => {
    setDialogTarget(med);
    setDialogMode('view');
  };
  const openEdit = (med) => {
    setDialogTarget(med);
    setDialogMode('edit');
  };
  const closeDialog = () => {
    setDialogMode(null);
    setDialogTarget(null);
  };

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
    if (values.purchaseRate !== '' && values.purchaseRate !== undefined && values.purchaseRate !== null) {
      input.purchaseRate = Number(values.purchaseRate);
    }
    if (values.imageBase64) input.imageBase64 = values.imageBase64;

    const run = isEdit
      ? updateMedicine({ variables: { id: dialogTarget.id, input } })
      : createMedicine({ variables: { input } });
    const { error } = await run;
    if (!error) closeDialog();
  };

  const initialFormValues = useMemo(() => {
    if (!dialogTarget) return BLANK_MEDICINE;
    return {
      name: dialogTarget.name || '',
      genericName: dialogTarget.genericName || '',
      manufacturer: dialogTarget.manufacturer || '',
      dosageForm: dialogTarget.dosageForm || 'Tablet',
      strength: dialogTarget.strength || '',
      packSize: dialogTarget.packSize || '',
      category: dialogTarget.category || '',
      schedule: dialogTarget.schedule || 'OTC',
      price: dialogTarget.price ?? '',
      purchaseRate: dialogTarget.purchaseRate ?? '',
      gstRate: dialogTarget.gstRate ?? 5,
      uses: dialogTarget.uses || '',
      dosageTiming: dialogTarget.dosageTiming || '',
      directionsForUse: dialogTarget.directionsForUse || '',
      storage: dialogTarget.storage || '',
      sideEffects: dialogTarget.sideEffects || '',
      image: dialogTarget.image || null, // server image for the view-mode preview
      imageBase64: null,
      isActive: dialogTarget.isActive !== false,
    };
  }, [dialogTarget]);

  // ── Grid columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      id: 'name',
      label: 'Medicine',
      width: 240,
      render: (r) => (
        <Stack direction="row" spacing={1.25} alignItems="center">
          {r.image ? (
            <Avatar src={r.image} alt={r.name} variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'action.hover' }} />
          ) : (
            <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'action.hover' }}>
              <MedicationIcon fontSize="small" color="primary" />
            </Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography>
            {r.genericName && (
              <Typography variant="caption" color="text.secondary" noWrap display="block">{r.genericName}</Typography>
            )}
          </Box>
        </Stack>
      ),
    },
    { id: 'manufacturer', label: 'Manufacturer', width: 160, sortable: false, render: (r) => r.manufacturer || '—' },
    {
      id: 'schedule',
      label: 'Type',
      width: 100,
      sortable: false,
      render: (r) => (
        <StatusBadge
          status={isPrescriptionRequired(r.schedule) ? 'ERROR' : 'SUCCESS'}
          label={isPrescriptionRequired(r.schedule) ? 'Rx' : 'OTC'}
          size="small"
        />
      ),
    },
    { id: 'dosageForm', label: 'Form', width: 100, sortable: false, render: (r) => r.dosageForm || '—' },
    {
      id: 'price',
      label: 'MRP',
      width: 110,
      align: 'right',
      render: (r) => <Typography variant="body2" fontWeight={600}>{formatINR(r.price)}</Typography>,
    },
    {
      id: 'isActive',
      label: 'Status',
      width: 110,
      align: 'center',
      sortable: false,
      render: (r) =>
        r.isActive === false ? <StatusBadge status="ERROR" label="Removed" size="small" /> : <StatusBadge status="ACTIVE" label="Active" size="small" />,
    },
    {
      id: 'createdAt',
      label: 'Added',
      width: 120,
      render: (r) => <Typography variant="body2">{r.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY') : '—'}</Typography>,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Medicine Catalog"
        subtitle="Your master medicine list – staff request stock from here"
        action={
          <AppButton variant="contained" startIcon={<MedicationIcon fontSize="small" />} onClick={openAdd}>
            Add Medicine
          </AppButton>
        }
      />

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
        <Chip
          label="Show removed"
          clickable
          color={showInactive ? 'primary' : 'default'}
          variant={showInactive ? 'filled' : 'outlined'}
          onClick={() => { setShowInactive((v) => !v); setPage(0); }}
        />
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <GenericDataGrid
          title="Medicines"
          stateKey="medicine-catalogue"
          rows={rows}
          totalCount={totalCount}
          page={page}
          onPageChange={setPage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={setRowsPerPage}
          onSearch={(text) => { setSearch(text); setPage(0); }}
          searchPlaceholder="Search medicines…"
          columns={columns}
          loading={medicinesQuery.loading}
          error={medicinesQuery.error}
          onRetry={() => medicinesQuery.refetch()}
          onRowClick={openView}
        />
      </Card>

      {/* ONE wizard – row click opens VIEW (all steps, read-only, edit pencil in
          header); Add / Edit reuse the same dialog. */}
      <MedicineWizard
        key={formKey}
        open={!!dialogMode}
        mode={dialogMode || 'add'}
        onClose={() => !saving && closeDialog()}
        onSubmit={handleSubmit}
        onEdit={(m) => openEdit(m)}
        onRemove={(m) => setConfirmTarget(m)}
        onRestore={(m) => restoreMedicine({ variables: { id: m.id } })}
        actionBusy={restoring}
        initialValues={initialFormValues}
        saving={saving}
      />

      {/* Remove confirm */}
      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={async () => {
          const { error } = await removeMedicine({ variables: { id: confirmTarget.id } });
          if (!error) {
            setConfirmTarget(null);
            closeDialog();
          }
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
