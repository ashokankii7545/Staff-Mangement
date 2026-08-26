import React, { useMemo, memo, useEffect, useState } from 'react';
import {
  useForm,
  Controller,
  useFieldArray,
  FormProvider,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TextField,
  Select,
  MenuItem,
  Box,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  FormHelperText,
  FormControlLabel,
  Checkbox,
  Switch,
  Radio,
  RadioGroup,
  Autocomplete,
  IconButton,
  Grid,
  Typography,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import AppButton from '../AppButton';
import GenericFileUploader from '../GenericFileUploader';

/**
 * GenericFormEngine – JSON-driven form renderer. ONE component to rule all forms.
 *
 * Give it a `fields` array (+ optional zod `schema`) and it renders, validates,
 * submits and recovers from server errors – no hand-written forms ever again.
 *
 * Supported field types:
 *   text | email | password | number | tel | url | multiline | select |
 *   autocomplete (single/multi) | date | time | checkbox | switch | radio |
 *   file | array (repeatable rows) | custom (render fn)
 *
 * Every field: { name, type, label, options?, gridSize?, defaultValue?,
 *   placeholder?, helperText?, condition?(values), required?, disabled?,
 *   props? (passthrough to MUI) }
 */


const FieldRenderer = memo(({ field, control, errors, values, isSubmitting, disabled }) => {
  const { name, type = 'text', label, options, condition, arrayFields, render, ...rest } = field;
  const [showPassword, setShowPassword] = useState(false);

  if (condition && !condition(values)) return null;

  const error = errors?.[name]?.message;
  const isDisabled = disabled || field.disabled || isSubmitting;
  const commonProps = {
    fullWidth: true,
    size: 'small',
    error: !!error,
    helperText: error || field.helperText,
    disabled: isDisabled,
    ...rest.props,
  };

  // ── Custom escape hatch ──
  if (type === 'custom' && typeof render === 'function') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) =>
          render({ value: f.value, onChange: f.onChange, onBlur: f.onBlur, error, values })
        }
      />
    );
  }

  // ── Repeatable row groups ──
  if (type === 'array') {
    return (
      <ArrayField
        name={name}
        label={label}
        control={control}
        errors={errors}
        arrayFields={arrayFields || []}
        values={values}
        disabled={isDisabled}
        error={error}
      />
    );
  }

  // ── File upload ──
  if (type === 'file') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <Box>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
              {label}
            </Typography>
            <GenericFileUploader
              onFileSelect={(file) => f.onChange(file)}
              {...rest.uploaderProps}
            />
            {(error || field.helperText) && (
              <FormHelperText error={!!error}>{error || field.helperText}</FormHelperText>
            )}
          </Box>
        )}
      />
    );
  }

  // ── Boolean controls ──
  if (type === 'checkbox' || type === 'switch') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <FormControlLabel
            control={
              type === 'checkbox' ? (
                <Checkbox checked={!!f.value} onChange={(e) => f.onChange(e.target.checked)} />
              ) : (
                <Switch checked={!!f.value} onChange={(e) => f.onChange(e.target.checked)} />
              )
            }
            label={<Typography variant="body2">{label}</Typography>}
            sx={{ mt: 1 }}
          />
        )}
      />
    );
  }

  // ── Date & Time pickers (LocalizationProvider provided by the engine root) ──
  if (type === 'date' || type === 'time') {
    const PickerCmp = type === 'date' ? DatePicker : TimePicker;
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <PickerCmp
            {...f}
            value={f.value ? dayjs(f.value) : null}
            onChange={(v) => f.onChange(v ? (type === 'date' ? v.format('YYYY-MM-DD') : v.format('HH:mm')) : '')}
            label={label}
            slotProps={{ textField: { ...commonProps } }}
            {...rest.pickerProps}
          />
        )}
      />
    );
  }

  // ── Autocomplete (single or multi) – options: [{label, value}] ──
  if (type === 'autocomplete') {
    const isMulti = !!field.multiple;
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => {
          const selected = isMulti
            ? options?.filter((o) => (f.value || []).includes(o.value)) || []
            : options?.find((o) => o.value === f.value) || null;
          return (
            <Autocomplete
              multiple={isMulti}
              options={options || []}
              getOptionLabel={(o) => o.label ?? ''}
              isOptionEqualToValue={(o, v) => o.value === v.value}
              value={selected}
              onChange={(_, newValue) =>
                f.onChange(isMulti ? newValue.map((o) => o.value) : newValue?.value ?? '')
              }
              renderInput={(params) => <TextField {...params} label={label} {...commonProps} />}
              disabled={isDisabled}
              {...rest.autocompleteProps}
            />
          );
        }}
      />
    );
  }

  // ── Radio group ──
  if (type === 'radio') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <FormControl error={!!error} disabled={isDisabled}>
            {label && <Typography variant="body2" fontWeight={500}>{label}</Typography>}
            <RadioGroup row={field.row !== false} value={f.value ?? ''} onChange={(e) => f.onChange(e.target.value)} sx={{ mt: 0.5 }}>
              {(options || []).map((opt) => (
                <FormControlLabel key={opt.value} value={opt.value} control={<Radio size="small" />} label={opt.label} />
              ))}
            </RadioGroup>
            {(error || field.helperText) && <FormHelperText>{error || field.helperText}</FormHelperText>}
          </FormControl>
        )}
      />
    );
  }

  // ── Select ──
  if (type === 'select') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <FormControl fullWidth size="small" error={!!error} disabled={isDisabled}>
            <InputLabel id={`label-${name}`}>{label}</InputLabel>
            <Select labelId={`label-${name}`} {...f} label={label} {...rest.selectProps}>
              {(options || []).map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
            {(error || field.helperText) && (
              <FormHelperText>{error || field.helperText}</FormHelperText>
            )}
          </FormControl>
        )}
      />
    );
  }

  // ── Text family (text/email/password/number/tel/url/multiline) ──
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: f }) => {
        let endAdornment = rest.props?.InputProps?.endAdornment;
        if (type === 'password') {
          endAdornment = (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" aria-label="toggle password visibility">
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          );
        }
        const isMultiline = type === 'multiline' || !!field.multiline;
        return (
          <TextField
            {...f}
            value={f.value ?? ''}
            onChange={(e) =>
              f.onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)
            }
            label={label}
            type={type === 'password' && showPassword ? 'text' : type === 'multiline' ? undefined : type}
            placeholder={field.placeholder}
            multiline={isMultiline}
            rows={field.rows ?? (type === 'multiline' ? 3 : undefined)}
            InputProps={{ ...rest.props?.InputProps, endAdornment }}
            inputProps={{
              ...(type === 'number' ? { min: field.min, max: field.max, step: field.step } : {}),
              ...rest.props?.inputProps,
            }}
            {...commonProps}
          />
        );
      }}
    />
  );
});

FieldRenderer.displayName = 'FieldRenderer';

/** Repeatable row group powered by react-hook-form's useFieldArray */
const ArrayField = ({ name, label, control, errors, arrayFields, values, disabled, error }) => {
  const { fields, append, remove } = useFieldArray({ control, name });
  const blankRow = useMemo(() => {
    const row = {};
    arrayFields.forEach((sub) => { row[sub.name] = sub.defaultValue ?? ''; });
    return row;
  }, [arrayFields]);

  return (
    <Box>
      {label && <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>{label}</Typography>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {fields.map((item, index) => (
          <Box key={item.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Grid container spacing={1.5} sx={{ flex: 1 }}>
              {arrayFields.map((sub) => (
                <Grid item xs={sub.gridSize?.xs ?? 12} sm={sub.gridSize?.sm ?? 6} key={sub.name}>
                  <FieldRenderer
                    field={{ ...sub, name: `${name}.${index}.${sub.name}` }}
                    control={control}
                    errors={errors?.[name]?.[index]}
                    values={values}
                    isSubmitting={false}
                    disabled={disabled}
                  />
                </Grid>
              ))}
            </Grid>
            <IconButton
              size="small"
              color="error"
              onClick={() => remove(index)}
              disabled={disabled || fields.length <= 1}
              sx={{ mt: 0.5 }}
              aria-label="Remove row"
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Box>
      {!!error && <FormHelperText error>{error}</FormHelperText>}
      {!disabled && (
        <AppButton variant="text" size="small" startIcon={<AddIcon />} onClick={() => append(blankRow)} sx={{ mt: 1 }}>
          Add Row
        </AppButton>
      )}
    </Box>
  );
};

/**
 * GenericFormEngine – JSON-driven form engine.
 *
 * @param {Array}   fields          – Field configs (see supported types above)
 * @param {ZodSchema} [schema]      – Optional zod validation schema
 * @param {Function} onSubmit       – async (data) => void; throw to trigger error mapping
 * @param {object}  [initialValues]
 * @param {('onBlur'|'onChange'|'onTouched'|'all')} [validateOn='onBlur']
 * @param {boolean} [resetAfterSubmit=false]
 * @param {Function} [loadInitialData] – async () => data; resets the form with it
 * @param {Function} [mapServerErrors] – (error) => ({ fieldName: message })
 * @param {string}  [submitLabel='Submit']
 * @param {string}  [resetLabel='Reset']
 * @param {boolean} [hideReset=false]
 * @param {boolean} [disabled=false] – Freeze every field (view/edit modes)
 * @param {boolean} [showFooter=true] – Hide footer for embedding inside dialogs with own actions
 */
export const GenericFormEngine = ({
  fields,
  schema,
  onSubmit,
  submitLabel = 'Submit',
  resetLabel = 'Reset',
  initialValues = {},
  validateOn = 'onBlur',
  resetAfterSubmit = false,
  loadInitialData,
  mapServerErrors,
  hideReset = false,
  disabled = false,
  showFooter = true,
  id,
}) => {
  const defaultValues = useMemo(() => {
    const defaults = { ...initialValues };
    fields.forEach((field) => {
      if (field.defaultValue !== undefined && defaults[field.name] === undefined) {
        defaults[field.name] = field.defaultValue;
      }
      if (field.type === 'array' && field.defaultValue === undefined) {
        const item = {};
        field.arrayFields?.forEach((sub) => {
          item[sub.name] = sub.defaultValue ?? '';
        });
        defaults[field.name] = [item];
      }
    });
    return defaults;
  }, [fields, initialValues]);

  const methods = useForm({
    ...(schema ? { resolver: zodResolver(schema) } : {}),
    defaultValues,
    mode: validateOn,
    shouldUnregister: false,
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    setError,
  } = methods;

  const values = watch();

  useEffect(() => {
    let cancelled = false;
    if (loadInitialData) {
      loadInitialData().then((data) => {
        if (!cancelled && data) reset(data);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [loadInitialData, reset]);

  const handleFormSubmit = async (data) => {
    try {
      await onSubmit(data);
      if (resetAfterSubmit) reset();
    } catch (error) {
      if (mapServerErrors && error) {
        const fieldErrors = mapServerErrors(error);
        Object.entries(fieldErrors).forEach(([field, message]) => {
          setError(field, { message });
        });
      } else {
        setError('root', {
          message: error?.message || 'An unexpected error occurred. Please try again.',
        });
      }
    }
  };

  // ── Section grouping: `type: 'section'` markers split long forms into
  //    collapsible accordion groups so dialogs read as short pages. ──
  const fieldGroups = useMemo(() => {
    const groups = [];
    let current = { title: null, icon: null, defaultExpanded: true, fields: [] };
    const flush = () => {
      if (current.title || current.fields.length) groups.push(current);
    };
    fields.forEach((field) => {
      if (field.type === 'section') {
        flush();
        current = {
          title: field.label || null,
          icon: field.icon || null,
          defaultExpanded: field.defaultExpanded !== false,
          fields: [],
        };
      } else {
        current.fields.push(field);
      }
    });
    flush();
    return groups;
  }, [fields]);

  const hasSections = fieldGroups.some((g) => g.title);

  const renderFieldGrid = (groupFields) => (
    <Grid container spacing={2}>
      {groupFields.map((field) => (
        <Grid
          item
          xs={field.gridSize?.xs ?? 12}
          sm={field.gridSize?.sm ?? 12}
          md={field.gridSize?.md ?? 12}
          key={`${field.name}-${values && field.condition ? 'c' : 'f'}`}
          sx={{ display: field.condition && !field.condition(values) ? 'none' : undefined }}
        >
          <FieldRenderer
            field={field}
            control={control}
            errors={errors}
            values={values}
            isSubmitting={isSubmitting}
            disabled={disabled}
          />
        </Grid>
      ))}
    </Grid>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FormProvider {...methods}>
        <Box component="form" id={id} onSubmit={handleSubmit(handleFormSubmit)} noValidate autoComplete="off">
          {hasSections ? (
            <Stack spacing={1}>
              {fieldGroups.map((group, gi) =>
                group.title ? (
                  <Accordion
                    key={`section-${gi}`}
                    defaultExpanded={group.defaultExpanded}
                    disableGutters
                    elevation={0}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {group.icon}
                        <Typography variant="subtitle2" fontWeight={600}>
                          {group.title}
                        </Typography>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0.5 }}>{renderFieldGrid(group.fields)}</AccordionDetails>
                  </Accordion>
                ) : (
                  <Box key={`section-${gi}`}>{renderFieldGrid(group.fields)}</Box>
                )
              )}
            </Stack>
          ) : (
            renderFieldGrid(fields)
          )}

          {showFooter && (
            <Box sx={{ display: 'flex', gap: 1.5, mt: 3, justifyContent: 'flex-end' }}>
              {!hideReset && (
                <AppButton variant="outlined" color="inherit" type="button" onClick={() => reset()} disabled={isSubmitting || disabled}>
                  {resetLabel}
                </AppButton>
              )}
              <AppButton type="submit" color="primary" loading={isSubmitting} disabled={disabled || (!isDirty && !loadInitialData)}>
                {submitLabel}
              </AppButton>
            </Box>
          )}

          {errors.root?.message && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {errors.root.message}
            </Typography>
          )}
        </Box>
      </FormProvider>
    </LocalizationProvider>
  );
};

export default GenericFormEngine;


