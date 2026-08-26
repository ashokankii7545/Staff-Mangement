import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import dayjs from 'dayjs';

export const ANALYTICS_PRESETS = [
  { label: 'Today', getValue: () => [dayjs(), dayjs()] },
  { label: 'Last 7 Days', getValue: () => [dayjs().subtract(6, 'day'), dayjs()] },
  { label: 'Last 30 Days', getValue: () => [dayjs().subtract(29, 'day'), dayjs()] },
  { label: 'This Month', getValue: () => [dayjs().startOf('month'), dayjs()] },
  { label: 'Last Month', getValue: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
];

/**
 * DateRangePicker – Preset-driven date range selector.
 *
 * 100% theme-tokenized (no hardcoded hex) so it renders perfectly in
 * dark & light modes. Two trigger variants:
 *   'button'     – for toolbars/topbars
 *   'formField'  – bordered field look for forms (Apply Leave etc.)
 */

const CustomDay = (props) => {
  const { day, selectedDay, outsideCurrentMonth, draftStart, draftEnd, ...other } = props;
  if (!draftStart || !draftEnd) return <PickersDay day={day} selectedDay={selectedDay} outsideCurrentMonth={outsideCurrentMonth} {...other} />;
  
  const isSelected = day.isSame(draftStart, 'day') || day.isSame(draftEnd, 'day');
  const isBetween = day.isAfter(draftStart, 'day') && day.isBefore(draftEnd, 'day');
  
  return (
    <Box sx={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...(isBetween && {
        bgcolor: 'primary.light',
        opacity: 0.6,
      }),
      ...(day.isSame(draftStart, 'day') && !day.isSame(draftEnd, 'day') && {
        borderTopLeftRadius: '50%', borderBottomLeftRadius: '50%',
        bgcolor: 'primary.light',
      }),
      ...(day.isSame(draftEnd, 'day') && !day.isSame(draftStart, 'day') && {
        borderTopRightRadius: '50%', borderBottomRightRadius: '50%',
        bgcolor: 'primary.light',
      }),
    }}>
      <PickersDay 
        {...other} 
        day={day} 
        selectedDay={selectedDay} 
        outsideCurrentMonth={outsideCurrentMonth}
        sx={{
          ...(isSelected && { bgcolor: 'primary.main !important', color: 'primary.contrastText' })
        }}
      />
    </Box>
  );
};

const DateRangePicker = ({
  value,
  onChange,
  label = 'Select Date Range',
  variant = 'button', // 'button' | 'formField'
  fullWidth = false,
  showPresets = true,
  presets = ANALYTICS_PRESETS,
  minDate,
  maxDate,
  disablePast = false,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);

  // Internal draft state before Apply
  const [draftStart, setDraftStart] = useState(value?.startDate ? dayjs(value.startDate) : dayjs());
  const [draftEnd, setDraftEnd] = useState(value?.endDate ? dayjs(value.endDate) : dayjs());
  const [activeStep, setActiveStep] = useState('START'); // 'START' | 'END'
  const [activePreset, setActivePreset] = useState(value?.label || 'Today');

  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setDraftStart(value?.startDate ? dayjs(value.startDate) : dayjs());
    setDraftEnd(value?.endDate ? dayjs(value.endDate) : dayjs());
    setActivePreset(value?.label || '');
    setActiveStep('START');
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handlePresetClick = (preset) => {
    const [start, end] = preset.getValue();
    setDraftStart(start);
    setDraftEnd(end);
    setActivePreset(preset.label);
  };

  const handleCalendarChange = (newDate) => {
    if (!newDate) return;

    if (activeStep === 'START') {
      setDraftStart(newDate);
      if (newDate.isAfter(draftEnd)) {
        setDraftEnd(newDate);
      }
      setActiveStep('END');
      setActivePreset('');
    } else {
      if (newDate.isBefore(draftStart)) {
        setDraftStart(newDate);
        setDraftEnd(newDate);
      } else {
        setDraftEnd(newDate);
      }
      setActiveStep('START');
      setActivePreset('');
    }
  };

  const handleApply = () => {
    const startStr = draftStart.format('YYYY-MM-DD');
    const endStr = draftEnd.format('YYYY-MM-DD');
    const isSingle = startStr === endStr;
    const isToday = isSingle && startStr === dayjs().format('YYYY-MM-DD');

    let displayLabel = activePreset;
    if (!displayLabel) {
      displayLabel = isSingle
        ? draftStart.format('MMM D, YYYY')
        : `${draftStart.format('MMM D')} – ${draftEnd.format('MMM D, YYYY')}`;
    }
    if (isToday) displayLabel = 'Today';

    onChange({
      startDate: startStr,
      endDate: endStr,
      label: displayLabel,
    });
    handleClose();
  };

  const daysCount = Math.max(1, draftEnd.diff(draftStart, 'day') + 1);

  // Format trigger label
  const isSingleValue = value?.startDate === value?.endDate;
  const triggerText = value?.label || (
    isSingleValue
      ? (value?.startDate ? dayjs(value.startDate).format('DD/MM/YYYY') : 'Select date')
      : `${dayjs(value?.startDate).format('DD/MM/YYYY')} → ${dayjs(value?.endDate).format('DD/MM/YYYY')}`
  );

  return (
    <>
      {/* 1. Trigger Variant: Button (for Topbars & Toolbars) */}
      {variant === 'button' ? (
        <Button
          variant="outlined"
          size="small"
          onClick={handleClick}
          startIcon={<CalendarMonthOutlinedIcon sx={{ color: 'primary.main', fontSize: 18 }} />}
          endIcon={<KeyboardArrowDownIcon sx={{ color: 'text.secondary', fontSize: 18 }} />}
          sx={{
            bgcolor: 'background.paper',
            borderColor: 'divider',
            color: 'text.primary',
            fontWeight: 500,
            fontSize: '0.8125rem',
            px: 1.5,
            py: 0.6,
            borderRadius: 1.5,
            '&:hover': {
              bgcolor: 'background.default',
              borderColor: 'primary.main',
            },
          }}
        >
          {triggerText || 'Select Date Range'}
        </Button>
      ) : (
        /* 2. Trigger Variant: FormField (for Form Modals like Apply Leave) */
        <Box sx={{ width: fullWidth ? '100%' : 'auto' }}>
          {label && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.75, display: 'block' }}>
              {label} *
            </Typography>
          )}
          <Box
            onClick={handleClick}
            sx={{
              p: 1.25,
              borderRadius: 1.5,
              border: '1px solid', borderColor: 'divider',
              bgcolor: 'background.paper',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'background.default',
              },
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CalendarMonthOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Box>
                <Typography variant="body2" fontWeight={500} sx={{ color: 'text.primary', fontSize: '0.875rem' }}>
                  {isSingleValue
                    ? `${dayjs(value?.startDate).format('DD MMMM YYYY')} (Single Day)`
                    : `${dayjs(value?.startDate).format('DD MMM YYYY')} → ${dayjs(value?.endDate).format('DD MMM YYYY')}`}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Change Dates ▾
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      )}

      {/* Popover / Calendar Modal */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            p: 2.5,
            width: { xs: 330, sm: 380 },
            borderRadius: 2.5,
            border: '1px solid', borderColor: 'divider',
            overflow: 'hidden',
          },
        }}
      >
        {/* Popover Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.9375rem', color: 'text.primary' }}>
              Select Dates
            </Typography>
            <Box
              sx={{
                bgcolor: 'action.selected',
                color: 'primary.main',
                px: 1,
                py: 0.2,
                borderRadius: 1,
                fontSize: '0.6875rem',
                fontWeight: 600,
              }}
            >
              {daysCount} {daysCount === 1 ? 'day' : 'days'}
            </Box>
          </Stack>
          <IconButton size="small" onClick={handleClose} sx={{ color: 'text.secondary' }} aria-label="Close date picker">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Quick Select Presets */}
        {showPresets && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', mb: 0.75 }}>
              Quick Select
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {presets.map((preset) => (
                <Box
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  sx={{
                    px: 1.15,
                    py: 0.4,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    bgcolor: activePreset === preset.label ? 'primary.main' : 'action.hover',
                    color: activePreset === preset.label ? 'primary.contrastText' : 'text.secondary',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: activePreset === preset.label ? 'primary.dark' : 'action.selected',
                    },
                  }}
                >
                  {preset.label}
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* FROM / TO Range Inputs */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Box
            onClick={() => setActiveStep('START')}
            sx={{
              flex: 1,
              p: 1,
              borderRadius: 1.5,
              border: '1.5px solid',
              borderColor: activeStep === 'START' ? 'primary.main' : 'divider',
              bgcolor: activeStep === 'START' ? 'action.selected' : 'background.paper',
              cursor: 'pointer',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem', display: 'block' }}>
              FROM
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary', fontSize: '0.8125rem' }}>
              {draftStart.format('MMM D, YYYY')}
            </Typography>
          </Box>

          <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.secondary' }} />

          <Box
            onClick={() => setActiveStep('END')}
            sx={{
              flex: 1,
              p: 1,
              borderRadius: 1.5,
              border: '1.5px solid',
              borderColor: activeStep === 'END' ? 'primary.main' : 'divider',
              bgcolor: activeStep === 'END' ? 'action.selected' : 'background.paper',
              cursor: 'pointer',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem', display: 'block' }}>
              TO
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary', fontSize: '0.8125rem' }}>
              {draftEnd.format('MMM D, YYYY')}
            </Typography>
          </Box>
        </Stack>

        {/* Compact Calendar */}
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default', mb: 2 }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateCalendar
              slots={{ day: CustomDay }}
              slotProps={{ day: { draftStart, draftEnd } }}
              value={activeStep === 'START' ? draftStart : draftEnd}
              onChange={handleCalendarChange}
              disablePast={disablePast}
              minDate={minDate}
              maxDate={maxDate}
              sx={{
                width: '100%',
                '& .MuiPickersCalendarHeader-root': {
                  pl: 1,
                  pr: 1,
                  my: 0,
                },
                '& .MuiDayCalendar-weekDayLabel': {
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  width: 34,
                  height: 28,
                },
                '& .MuiPickersDay-root': {
                  fontSize: '0.8125rem',
                  width: 32,
                  height: 32,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main !important',
                  },
                },
              }}
            />
          </LocalizationProvider>
        </Box>

        {/* Footer Actions */}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={handleClose} color="inherit" sx={{ fontWeight: 500 }}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleApply}
            sx={{
              fontWeight: 600,
              px: 2,
            }}
          >
            Apply Dates
          </Button>
        </Stack>
      </Popover>
    </>
  );
};

export default DateRangePicker;
