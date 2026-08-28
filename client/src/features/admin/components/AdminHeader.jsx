import { useAppQuery } from '../../../shared/hooks';
import React from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppButton, StatusBadge } from '../../../shared/ui';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/AuthContext';

import { GET_SETTINGS, GET_OFFICES } from '../../../graphql/queries';
import DateRangePicker from '../../../shared/ui/DateRangePicker';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const AdminHeader = ({
  selectedOffice,
  onSelectOffice,
  dateRange,
  onDateRangeChange,
  onAddStaff,
  onApplyLeave,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: settingsData } = useAppQuery(GET_SETTINGS);
  const { data: officesData } = useAppQuery(GET_OFFICES);

  const settings = settingsData?.settings;
  const offices = officesData?.offices || [];
  const shiftText = settings ? `${settings.shiftStartTime || '09:00'} - ${settings.shiftEndTime || '18:00'}` : '09:00 - 18:00';
  const firstName = (user?.name || 'Admin').split(' ')[0];
  const orgName = settings?.organizationName || 'your organization';

  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        border: '1px solid', borderColor: 'divider',

      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
      >
        {/* Left Side: Overview Title, Live Sync, and Filters */}
        <Box sx={{ width: { xs: '100%', md: 'auto' } }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.25 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {greeting()}, {firstName}
            </Typography>
            <StatusBadge
              status="PRESENT"
              label="Live Sync"
              sx={{ border: '1px solid', borderColor: 'success.light' }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {dayjs().format('dddd, DD MMM YYYY')} · {orgName}
          </Typography>

          {/* Operational Filter Row (Site Selector + Date Range Picker) */}
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            {/* 1. Date Range Picker (from User's reference screenshots) */}
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />

            <Typography variant="caption" color="text.disabled">•</Typography>

            {/* 2. Site Dropdown Selector */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LocationOnOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <FormControl size="small" variant="standard" sx={{ minWidth: 130 }}>
                <Select
                  value={selectedOffice || 'ALL'}
                  onChange={(e) => onSelectOffice(e.target.value)}
                  disableUnderline
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'primary.main',
                    cursor: 'pointer',
                    '& .MuiSelect-select': {
                      py: 0,
                      pr: 2,
                    },
                    '& .MuiSvgIcon-root': {
                      color: 'primary.main',
                      fontSize: 18,
                    },
                  }}
                >
                  <MenuItem value="ALL" sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                    🏢 All Sites (Global)
                  </MenuItem>
                  {offices.map((off) => (
                    <MenuItem key={off.id} value={off.id} sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                      📍 {off.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Typography variant="caption" color="text.disabled">•</Typography>

            {/* Shift Context */}
            <Typography variant="body2" color="text.secondary">
              Shift: <span style={{ color: 'text.primary', fontWeight: 500 }}>{shiftText}</span>
            </Typography>
          </Stack>
        </Box>

        {/* Right Side: Action Buttons */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <AppButton
            color="primary"
            startIcon={<AddIcon fontSize="small" />}
            onClick={onAddStaff}
          >
            Add Member
          </AppButton>

          <AppButton
            variant="outlined"
            startIcon={<CalendarTodayOutlinedIcon fontSize="small" />}
            onClick={onApplyLeave}
          >
            Apply Leave
          </AppButton>

          <AppButton
            variant="outlined"
            startIcon={<TuneOutlinedIcon fontSize="small" />}
            onClick={() => navigate('/settings')}
          >
            Settings
          </AppButton>
        </Stack>
      </Stack>
    </Box>
  );
};

export default AdminHeader;




