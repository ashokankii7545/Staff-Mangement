import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { useState } from 'react';

import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { z } from 'zod';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';

import { GET_HOLIDAYS } from '../../graphql/queries';
import { CREATE_HOLIDAY, DELETE_HOLIDAY } from '../../graphql/mutations';
import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import StatusBadge from '../../shared/ui/StatusBadge';
import GenericDialog from '../../shared/ui/GenericDialog';
import ConfirmDialog from '../../shared/ui/ConfirmDialog';
import { GenericFormEngine, useNotification } from '../../shared/ui';

const HOLIDAY_SCHEMA = z.object({
  name: z.string().min(1, 'Holiday name is required'),
  date: z.string().min(1, 'Date is required'),
  type: z.enum(['NATIONAL', 'OPTIONAL']),
  description: z.string().optional(),
});

const HOLIDAY_FIELDS = [
  { name: 'name', type: 'text', label: 'Holiday Name', gridSize: { xs: 12, sm: 8 } },
  { name: 'date', type: 'date', label: 'Date', gridSize: { xs: 12, sm: 4 } },
  {
    name: 'type',
    type: 'select',
    label: 'Holiday Type',
    defaultValue: 'NATIONAL',
    options: [
      { value: 'NATIONAL', label: 'National / Mandatory' },
      { value: 'OPTIONAL', label: 'Optional / Restricted' },
    ],
    gridSize: { xs: 12 },
  },
  {
    name: 'description',
    type: 'multiline',
    label: 'Description (Optional)',
    rows: 2,
    gridSize: { xs: 12 },
  },
];

const HolidaysManagement = () => {
  const notify = useNotification();
  const { data, loading, error, refetch } = useAppQuery(GET_HOLIDAYS, { variables: { year: dayjs().year() } });


  const [formOpen, setFormOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState(null);

  // Auto-toasts handled by the hook – pages stay declarative
  const [createHoliday, { loading: creating }] = useAppMutation(CREATE_HOLIDAY, {
    successMessage: 'Holiday added',
    onCompleted: () => {
      setFormOpen(false);
      refetch();
    },
  });

  const [deleteHoliday, { loading: deleting }] = useAppMutation(DELETE_HOLIDAY, {
    successMessage: 'Holiday deleted',
    onCompleted: () => setHolidayToDelete(null),
    onError: (err) => notify.error(err.message),
  });

  const handleCreate = async (form) => {
    const result = await createHoliday({ variables: { input: form } });
    if (result.error) throw new Error(result.errorMessage); // surface inside form
  };

  const columns = [
    {
      id: 'date',
      label: 'Date',
      width: 150,
      valueGetter: (row) => dayjs(row.date).format('MMM D, YYYY'),
      render: (row) => (
        <Typography variant="body2" fontWeight={600}>
          {dayjs(row.date).format('MMM D, YYYY')}
        </Typography>
      )
    },
    { id: 'name', label: 'Holiday Name', width: 200 },
    { id: 'description', label: 'Description', width: '30%', sortable: false },
    {
      id: 'type',
      label: 'Type',
      width: 140,
      render: (row) => (
        <StatusBadge
          status={row.type === 'NATIONAL' ? 'INFO' : 'DEFAULT'}
          label={row.type === 'NATIONAL' ? 'National' : 'Optional'}
          size="small"
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 100,
      sortable: false,
      // FIX: previously referenced an undefined `params` variable (runtime crash)
      render: (row) => (
        <IconButton
          color="error"
          size="small"
          onClick={() => setHolidayToDelete(row)}
          aria-label={`Delete ${row.name}`}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      ),
    }
  ];

  return (
    <Box>
      <PageHeader
        title="Holiday Calendar"
        subtitle="Manage public holidays and company events"
        backButton="/"
        action={
          <AppButton color="primary" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
            Add Holiday
          </AppButton>
        }
      />

      <Card variant="outlined">
        <GenericDataGrid
          title="Holiday Calendar"
          stateKey="holidays"
          rows={data?.holidays || []}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={refetch}
          sortBy="date"
          sortDirection="asc"
        />
      </Card>

      {/* Create Holiday – JSON-driven form inside GenericDialog */}
      <GenericDialog
        open={formOpen}
        onClose={() => !creating && setFormOpen(false)}
        title="Add Global Holiday"
        loading={creating}
        maxWidth="sm"
      >
        <GenericFormEngine
          fields={HOLIDAY_FIELDS}
          schema={HOLIDAY_SCHEMA}
          onSubmit={handleCreate}
          submitLabel={creating ? 'Adding…' : 'Add Holiday'}
          resetLabel="Clear"
          resetAfterSubmit
        />
      </GenericDialog>

      {/* Delete confirmation – replaces window.confirm */}
      <ConfirmDialog
        open={Boolean(holidayToDelete)}
        onClose={() => setHolidayToDelete(null)}
        onConfirm={() => deleteHoliday({ variables: { id: holidayToDelete?.id } })}
        title="Delete Holiday"
        description={`"${holidayToDelete?.name}" will be permanently removed for this year. This action cannot be undone.`}
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
        loading={deleting}
      />
    </Box>
  );
};

export default HolidaysManagement;
