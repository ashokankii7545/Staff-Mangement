import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import AppChip from '../../shared/ui/AppChip';
import StatusBadge from '../../shared/ui/StatusBadge';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

import { GET_OFFICES } from '../../graphql/queries';
import { CREATE_OFFICE, UPDATE_OFFICE, DELETE_OFFICE } from '../../graphql/mutations';
import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import GenericDialog from '../../shared/ui/GenericDialog';
import EmptyState from '../../shared/ui/EmptyState';
import AdvancedLoader from '../../shared/ui/AdvancedLoader';
import { useNotification } from '../../shared/ui';

const initialForm = {
  name: '',
  address: '',
  geofenceRadius: 200,
  latitude: 28.6139,
  longitude: 77.2090,
};

const OfficeManagement = () => {
  const notify = useNotification();
  const { data, loading, refetch } = useAppQuery(GET_OFFICES);

  // Auto-toast on error comes free via useAppMutation (no manual onError)
  const [createOffice] = useAppMutation(CREATE_OFFICE);
  const [updateOffice] = useAppMutation(UPDATE_OFFICE);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const offices = data?.offices || [];

  const handleOpen = (office = null) => {
    if (office) {
      setEditingId(office.id);
      setForm({
        name: office.name,
        address: office.address || '',
        geofenceRadius: office.geofenceRadius,
        latitude: office.latitude,
        longitude: office.longitude,
      });
    } else {
      setEditingId(null);
      setForm(initialForm);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      notify.error('Office name is required');
      return;
    }
    setSaving(true);
    const input = {
      name: form.name,
      address: form.address,
      geofenceRadius: parseInt(form.geofenceRadius, 10),
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
    };
    // execute() resolves { data, error } – no try/catch needed
    const { error } = editingId
      ? await updateOffice({ variables: { id: editingId, input }, successMessage: 'Office updated successfully' })
      : await createOffice({ variables: { input }, successMessage: 'Office created successfully' });

    setSaving(false);
    if (error) {
      notify.error(error.message);
      return;
    }
    refetch();
    handleClose();
  };


  return (
    <Box>
      <PageHeader
        title="Office / Store Locations"
        subtitle="Manage store branches and geofence settings"
        backButton="/"
        action={
          <AppButton color="primary" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Add Office
          </AppButton>
        }
      />

      {loading && !data ? (
        <AdvancedLoader isLoading variant="gradient" message="Loading sites…" sx={{ minHeight: 300 }} />
      ) : offices.length === 0 ? (
        <EmptyState
          title="No sites yet"
          description="Add your first site to enable geofenced attendance for its staff."
          action={
            <AppButton color="primary" startIcon={<AddIcon />} onClick={() => handleOpen()}>
              Add Office
            </AppButton>
          }
        />
      ) : (
        <Grid container spacing={3}>
          {offices.map((office) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={office.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">{office.name}</Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpen(office)} color="primary" aria-label={`Edit ${office.name}`}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" aria-label={`Delete ${office.name}`}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {office.address || 'No address provided'}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <AppChip tone="primary" variant="outlined" label={`Radius: ${office.geofenceRadius}m`} size="small" />
                    <StatusBadge status={office.isActive ? 'ACTIVE' : 'DEFAULT'} label={office.isActive ? 'Active' : 'Inactive'} size="small" />
                  </Stack>
                  <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
                    Lat: {Number(office.latitude).toFixed(4)}, Lng: {Number(office.longitude).toFixed(4)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create / Edit dialog – enterprise chrome with loading overlay.
          Fields stay manual here because MapPicker writes lat/lng back into form state. */}
      <GenericDialog
        open={open}
        onClose={handleClose}
        loading={saving}
        title={editingId ? 'Edit Site Location' : 'Add New Site'}
        maxWidth="md"
        actions={
          <>
            <AppButton variant="outlined" color="inherit" onClick={handleClose} disabled={saving}>
              Cancel
            </AppButton>
            <AppButton onClick={handleSubmit} loading={saving} disabled={!form.name}>
              {editingId ? 'Save Changes' : 'Create Site'}
            </AppButton>
          </>
        }
      >
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2}>
              <TextField
                label="Site Name"
                fullWidth
                required
                size="small"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <TextField
                label="Full Address"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <TextField
                label="Geofence Radius (meters)"
                type="number"
                fullWidth
                size="small"
                value={form.geofenceRadius}
                onChange={(e) => setForm({ ...form, geofenceRadius: e.target.value })}
              />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Pin Location on Map</Typography>
            {/* MapPicker */}
          </Grid>
        </Grid>
      </GenericDialog>

      {/* Delete confirmation – replaces window.confirm */}
      {/* ConfirmDialog */}
    </Box>
  );
};

export default OfficeManagement;
