import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { z } from 'zod';
import Stack from '@mui/material/Stack';
import GenericDialog from '../GenericDialog';
import GenericFormEngine from '../GenericFormEngine';
import AppButton from '../AppButton';

/**
 * FormDialog – GenericDialog + GenericFormEngine, pre-wired into one component.
 *
 * Kills the last remaining hand-written dialog forms (useState objects +
 * TextField stacks + manual submit buttons) while keeping the EXACT same
 * layout: full-width primary submit button pinned at the bottom.
 *
 * Contract:
 *   • async onSubmit(formValues) – throw inside to keep the dialog open;
 *     the thrown message renders inside the form (same as pages do today).
 *   • Successful resolve → dialog closes automatically.
 *   • Field-level `required: true` in the config auto-generates a zod schema
 *     (unless you pass an explicit `schema`), so validation errors show INLINE
 *     instead of toast spam.
 *
 * @example
 *   <FormDialog
 *     open={!!tempDutyUser}
 *     onClose={() => setTempDutyUser(null)}
 *     title={`Temporary Duty – ${tempDutyUser?.name ?? ''}`}
 *     loading={assigningDuty}
 *     fields={TEMP_DUTY_FIELDS(officeOptions)}
 *     onSubmit={(form) => submitTempDuty(tempDutyUser, form)}
 *     submitLabel="Assign Temp Duty"
 *   >
 *     {tempDutyUser?.temporaryAssignment?.office && (
 *       <Alert severity="warning" sx={{ mb: 2 }}>An active temp duty exists…</Alert>
 *     )}
 *   </FormDialog>
 */

/** Auto-build a zod schema from top-level `required` fields (when none passed). */
const buildRequiredSchema = (fields = []) => {
  const shape = {};
  fields.forEach((field) => {
    if (field.type === 'section' || !field.required || !field.name) return;
    shape[field.name] =
      field.type === 'number'
        ? z.coerce.number({ invalid_type_error: `${field.label ?? field.name} is required` })
        : z.string().min(1, `${field.label ?? field.name} is required`);
  });
  return Object.keys(shape).length > 0 ? z.object(shape).strip() : undefined;
};

const FormDialog = ({
  open,
  onClose,
  title,
  subtitle,
  fields = [],
  schema,
  initialValues = {},
  onSubmit,
  submitLabel = 'Save',
  maxWidth = 'sm',
  loading = false,
  disabled = false,
  resetLabel = 'Reset',
  showReset = false,
  children,
  contentSx,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const formId = useId();
  const busy = submitting || loading;

  /** Success → close. Thrown error → FormEngine shows it inside the form. */
  const handleSubmit = async (formValues) => {
    try {
      setSubmitting(true);
      await onSubmit?.(formValues);
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GenericDialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      loading={busy}
      maxWidth={maxWidth}
      contentSx={contentSx}
    >
      {children}

      <GenericFormEngine
        id={formId}
        fields={fields}
        schema={schema ?? buildRequiredSchema(fields)}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        showFooter={false}
        disabled={disabled}
      />

      <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 3 }}>
        {showReset && (
          <AppButton variant="outlined" color="inherit" form={formId} type="button" disabled={busy}>
            {resetLabel}
          </AppButton>
        )}
        {/* form=<id> links this external button to the engine's <form> */}
        <AppButton type="submit" form={formId} fullWidth loading={busy} disabled={disabled}>
          {submitLabel}
        </AppButton>
      </Stack>
    </GenericDialog>
  );
};

FormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  title: PropTypes.node,
  subtitle: PropTypes.node,
  fields: PropTypes.array.isRequired,
  schema: PropTypes.object,
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string,
  maxWidth: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  resetLabel: PropTypes.string,
  showReset: PropTypes.bool,
  children: PropTypes.node,
  contentSx: PropTypes.object,
};

export default FormDialog;
