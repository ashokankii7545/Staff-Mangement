import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';

import { GenericDialog, AppButton } from '../../../shared/ui';
import MedicineImagePicker from './MedicineImagePicker';
import {
  MEDICINE_DOSAGE_FORMS,
  MEDICINE_SCHEDULES,
  MEDICINE_CATEGORIES,
  MEDICINE_GST_RATES,
} from '../../../shared/constants';

/**
 * MedicineWizard – a focused 3-step Add / Edit / VIEW medicine flow.
 *
 * ONE dialog, three modes (mode = 'add' | 'edit' | 'view'). Row click opens it
 * in `view`: every step is navigable, all fields read-only, and the ONLY edit
 * affordance is a pencil in the header (no edit/save buttons in the footer).
 * The pencil calls onEdit to flip into `edit`.
 *
 * Steps, ordered by what MUST be filled first:
 *   1. Essentials – pack image, brand name, generic, MRP, schedule, dosage form
 *   2. Stock & pricing details – manufacturer, strength, pack, category, purchase, GST
 *   3. Guidance – uses, dosage, directions, storage, side effects
 */

const STEPS = ['Essentials', 'Details', 'Guidance'];

export const BLANK_MEDICINE = {
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
  isActive: true,
};

const MedicineWizard = ({ open, onClose, onSubmit, initialValues, mode = 'add', saving, onEdit, onRemove, onRestore, actionBusy }) => {
  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const ro = isView; // read-only flag applied to every input
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(BLANK_MEDICINE);
  const [touched, setTouched] = useState(false);

  // Reset to a clean step-1 state each time the dialog opens for a new target.
  useEffect(() => {
    if (open) {
      setForm({ ...BLANK_MEDICINE, ...initialValues });
      setStep(0);
      setTouched(false);
    }
  }, [open, initialValues]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // Step-1 validation – only the truly required fields gate progress.
  const errors = useMemo(() => {
    const e = {};
    if (!String(form.name).trim()) e.name = 'Brand name is required';
    if (form.price === '' || form.price == null) e.price = 'MRP is required';
    else if (Number.isNaN(Number(form.price)) || Number(form.price) < 0) e.price = 'Enter a valid amount';
    if (!form.schedule) e.schedule = 'Select a schedule';
    return e;
  }, [form]);

  const step1Valid = !errors.name && !errors.price && !errors.schedule;
  const canSubmit = step1Valid && !saving;

  const next = () => {
    if (step === 0 && !step1Valid) {
      setTouched(true);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = () => {
    if (!step1Valid) {
      setTouched(true);
      setStep(0);
      return;
    }
    onSubmit(form);
  };

  const rupee = { InputProps: { startAdornment: <InputAdornment position="start">₹</InputAdornment> }, inputProps: { min: 0, step: '0.01', inputMode: 'decimal' } };

  return (
    <GenericDialog
      open={open}
      onClose={() => !saving && onClose()}
      title={isView ? form.name || 'Medicine' : isEdit ? 'Edit Medicine' : 'Add Medicine'}
      subtitle={STEPS[step]}
      fullScreen
      sx={{ borderRadius: 0 }}
      // Full-screen canvas, but keep the form itself in a comfortable centered
      // column so single-column fields don't stretch edge-to-edge.
      contentSx={{ '& > *': { maxWidth: 760, mx: 'auto' } }}
      loading={saving}
      steps={STEPS}
      activeStep={step}
      // Edit lives ONLY in the header (pencil), and only while viewing.
      headerActions={
        isView && onEdit ? (
          <Tooltip title="Edit">
            <IconButton color="primary" onClick={() => onEdit(form)} aria-label="Edit medicine">
              <EditIcon />
            </IconButton>
          </Tooltip>
        ) : undefined
      }
      actions={
        <Stack direction="row" spacing={1} sx={{ width: '100%' }} justifyContent="space-between" alignItems="center">
          {/* Left: Cancel (add/edit only) + remove/restore in view mode.
              View has no footer Close – the header X handles closing. */}
          <Stack direction="row" spacing={1}>
            {!isView && (
              <AppButton variant="text" onClick={() => onClose()} disabled={saving}>Cancel</AppButton>
            )}
            {isView && onRemove && form.isActive !== false && (
              <AppButton variant="text" color="error" onClick={() => onRemove(form)}>Remove</AppButton>
            )}
            {isView && onRestore && form.isActive === false && (
              <AppButton variant="text" color="success" loading={actionBusy} onClick={() => onRestore(form)}>Restore</AppButton>
            )}
          </Stack>
          {/* Right: step navigation + save (save hidden in view mode) */}
          <Stack direction="row" spacing={1}>
            {step > 0 && <AppButton variant="outlined" onClick={back} disabled={saving}>Back</AppButton>}
            {step < STEPS.length - 1 ? (
              <AppButton variant="contained" onClick={next}>Next</AppButton>
            ) : (
              !isView && (
                <AppButton variant="contained" onClick={handleSubmit} loading={saving} disabled={!canSubmit}>
                  {isEdit ? 'Save Changes' : 'Add to Catalog'}
                </AppButton>
              )
            )}
          </Stack>
        </Stack>
      }
    >
      {/* STEP 1 – Essentials (must-fill first), image at the top */}
      {step === 0 && (
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid size={12}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Pack Image {isView ? '' : '(optional)'}</Typography>
            <MedicineImagePicker value={form.imageBase64 || form.image} onChange={(v) => set({ imageBase64: v })} disabled={saving || ro} />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Brand Name"
              required={!ro}
              autoFocus={!ro}
              fullWidth
              size="small"
              placeholder="e.g. Dolo 650"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              error={touched && !!errors.name}
              helperText={touched && errors.name}
              disabled={ro}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Generic Name (Salt)"
              fullWidth
              size="small"
              placeholder="e.g. Paracetamol 650mg"
              value={form.genericName}
              onChange={(e) => set({ genericName: e.target.value })}
              disabled={ro}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="MRP per Unit"
              required={!ro}
              type="number"
              fullWidth
              size="small"
              value={form.price}
              onChange={(e) => set({ price: e.target.value })}
              error={touched && !!errors.price}
              helperText={(touched && errors.price) || 'Billed rate · hidden from staff'}
              disabled={ro}
              {...rupee}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Drug Schedule"
              required={!ro}
              select
              fullWidth
              size="small"
              value={form.schedule}
              onChange={(e) => set({ schedule: e.target.value })}
              helperText="H / H1 / X require a prescription"
              disabled={ro}
            >
              {MEDICINE_SCHEDULES.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField
              label="Dosage Form"
              select
              fullWidth
              size="small"
              value={form.dosageForm}
              onChange={(e) => set({ dosageForm: e.target.value })}
              disabled={ro}
            >
              {MEDICINE_DOSAGE_FORMS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      )}

      {/* STEP 2 – Details (optional) */}
      {step === 1 && (
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Manufacturer" fullWidth size="small" placeholder="e.g. Micro Labs Ltd" value={form.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} disabled={ro} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Therapeutic Category" select fullWidth size="small" value={form.category} onChange={(e) => set({ category: e.target.value })} disabled={ro}>
              <MenuItem value="">—</MenuItem>
              {MEDICINE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Strength" fullWidth size="small" placeholder="e.g. 650mg" value={form.strength} onChange={(e) => set({ strength: e.target.value })} disabled={ro} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Pack Size" fullWidth size="small" placeholder="e.g. Strip of 15 tablets" value={form.packSize} onChange={(e) => set({ packSize: e.target.value })} disabled={ro} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Purchase Rate" type="number" fullWidth size="small" value={form.purchaseRate} onChange={(e) => set({ purchaseRate: e.target.value })} helperText="Optional · your cost price" disabled={ro} {...rupee} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="GST Slab" select fullWidth size="small" value={form.gstRate} onChange={(e) => set({ gstRate: e.target.value })} disabled={ro}>
              {MEDICINE_GST_RATES.map((r) => <MenuItem key={r} value={r}>{r}%</MenuItem>)}
            </TextField>
          </Grid>
          {(isEdit || isView) && (
            <Grid size={12}>
              <FormControlLabel
                control={<Switch checked={form.isActive !== false} onChange={(e) => set({ isActive: e.target.checked })} disabled={ro} />}
                label="Active (visible to staff)"
              />
            </Grid>
          )}
        </Grid>
      )}

      {/* STEP 3 – Guidance & image (optional) */}
      {step === 2 && (
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid size={12}>
            <TextField label="Uses / Indication" fullWidth size="small" multiline minRows={2} placeholder="e.g. Fever, body ache, headache relief" value={form.uses} onChange={(e) => set({ uses: e.target.value })} disabled={ro} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Dosage – When to Take" fullWidth size="small" multiline minRows={2} placeholder="e.g. 1-0-1 after food" value={form.dosageTiming} onChange={(e) => set({ dosageTiming: e.target.value })} disabled={ro} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Directions for Use" fullWidth size="small" multiline minRows={2} placeholder="e.g. Swallow whole with water" value={form.directionsForUse} onChange={(e) => set({ directionsForUse: e.target.value })} disabled={ro} />
          </Grid>
          <Grid size={12}>
            <TextField label="Storage" fullWidth size="small" placeholder="e.g. Store below 25°C" value={form.storage} onChange={(e) => set({ storage: e.target.value })} disabled={ro} />
          </Grid>
          <Grid size={12}>
            <TextField label="Side Effects / Warnings" fullWidth size="small" multiline minRows={2} placeholder="e.g. Nausea, drowsiness" value={form.sideEffects} onChange={(e) => set({ sideEffects: e.target.value })} disabled={ro} />
          </Grid>
        </Grid>
      )}
    </GenericDialog>
  );
};

MedicineWizard.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func,
  initialValues: PropTypes.object,
  mode: PropTypes.oneOf(['add', 'edit', 'view']),
  saving: PropTypes.bool,
  onEdit: PropTypes.func,
  onRemove: PropTypes.func,
  onRestore: PropTypes.func,
  actionBusy: PropTypes.bool,
};

export default MedicineWizard;
