import { useAppQuery, useDebounce } from '../../../shared/hooks';
import React, { useState, useMemo } from 'react';
const formatLateDuration = (totalMins) => {
  if (totalMins <= 0) return '';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `+${h}h ${m}m`;
};

import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TableSkeleton from '../../../shared/ui/TableSkeleton';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';

import dayjs from 'dayjs';
import { GET_ALL_ATTENDANCE, GET_USERS, GET_SETTINGS } from '../../../graphql/queries';
import GenericDialog from '../../../shared/ui/GenericDialog';
import GenericDataGrid from '../../../shared/ui/GenericDataGrid';
import StatusBadge from '../../../shared/ui/StatusBadge';

const WhosInTodayBoard = ({ selectedOffice = 'ALL', dateRange }) => {
  const startDate = dateRange?.startDate || dayjs().format('YYYY-MM-DD');
  const endDate = dateRange?.endDate || dayjs().format('YYYY-MM-DD');
  const isMultiDayRange = startDate !== endDate;

  const { data: attData, loading: attLoading } = useAppQuery(GET_ALL_ATTENDANCE, {
    variables: { startDate, endDate },
    pollInterval: 10000,
  });

  const { data: usersData, loading: usersLoading } = useAppQuery(GET_USERS, {
    variables: { isActive: true },
  });

  const { data: settingsData } = useAppQuery(GET_SETTINGS);

  const [search, setSearch] = useState('');
  // 300ms debounced search – typing stays snappy, filtering runs on settled text
  const debouncedSearch = useDebounce(search, 300);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [statusTab, setStatusTab] = useState('ALL');
  const [previewSelfie, setPreviewSelfie] = useState(null);

  const settings = settingsData?.settings;
  const shiftStart = settings?.shiftStartTime || '09:00';
  const lateThreshold = settings?.lateThresholdMinutes || 15;

  const staffList = useMemo(() => {
    if (!usersData?.users?.data) return [];

    // Group attendance records by user
    const attendanceMap = new Map();
    (attData?.allAttendance || []).forEach((att) => {
      if (!attendanceMap.has(att.user.id)) {
        attendanceMap.set(att.user.id, []);
      }
      attendanceMap.get(att.user.id).push(att);
    });

    return usersData.users.data
      .filter((u) => u.role === 'STAFF')
      .filter((u) => {
        if (selectedOffice === 'ALL') return true;
        return u.assignedOffice?.id === selectedOffice;
      })
      .map((u) => {
        const userPunches = attendanceMap.get(u.id) || [];
        const latestPunch = userPunches[0]; // Most recent punch in date range
        let status = 'ABSENT';
        let punchTime = null;
        let punchDate = null;
        let location = null;
        let selfieUrl = null;

        if (latestPunch?.clockIn) {
          punchDate = latestPunch.clockIn.createdAt;
          punchTime = dayjs(punchDate).format('hh:mm A');
          selfieUrl = latestPunch.clockIn.selfieUrl;
          location = latestPunch.clockIn.location;

          const shiftStartTime = dayjs(`${latestPunch.date || startDate}T${shiftStart}`);
          const diffMinutes = dayjs(punchDate).diff(shiftStartTime, 'minute');
          status = diffMinutes > lateThreshold ? 'LATE' : 'PRESENT';
        }

        return {
          id: u.id,
          name: u.name,
          employeeId: u.employeeId,
          department: u.department || 'General',
          avatar: u.avatar,
          assignedOffice: u.assignedOffice,
          status,
          punchTime,
          punchDate,
          location,
          selfieUrl,
          punchesCount: userPunches.length,
        };
      });
  }, [usersData, attData, settings, startDate, selectedOffice]);

  const departments = useMemo(() => {
    const set = new Set();
    staffList.forEach((s) => s.department && set.add(s.department));
    return ['ALL', ...Array.from(set)];
  }, [staffList]);

  const filteredStaff = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return staffList.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.employeeId.toLowerCase().includes(q);

      const matchesDept = selectedDept === 'ALL' || s.department === selectedDept;

      let matchesStatus = true;
      if (statusTab === 'PRESENT') matchesStatus = s.status === 'PRESENT' || s.status === 'LATE';
      if (statusTab === 'ON_TIME') matchesStatus = s.status === 'PRESENT';
      if (statusTab === 'LATE') matchesStatus = s.status === 'LATE';
      if (statusTab === 'ABSENT') matchesStatus = s.status === 'ABSENT';

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [staffList, debouncedSearch, selectedDept, statusTab]);

  const counts = useMemo(() => {
    const present = staffList.filter((s) => s.status === 'PRESENT' || s.status === 'LATE').length;
    const onTime = staffList.filter((s) => s.status === 'PRESENT').length;
    const late = staffList.filter((s) => s.status === 'LATE').length;
    const absent = staffList.filter((s) => s.status === 'ABSENT').length;
    return { all: staffList.length, present, onTime, late, absent };
  }, [staffList]);

  const columns = [
    {
      id: 'name',
      label: 'Employee',
      width: 220,
      valueGetter: (row) => `${row.name} ${row.employeeId}`,
      render: (row) => (
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar src={row.avatar} sx={{ width: 32, height: 32, fontSize: '0.8125rem', bgcolor: 'primary.main', fontWeight: 600 }}>
            {row.name?.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.2 }}>{row.name}</Typography>
            <Typography variant="caption" color="text.secondary">{row.employeeId}</Typography>
          </Box>
        </Stack>
      ),
    },
    {
      id: 'department',
      label: 'Department',
      width: 130,
      render: (row) => <Typography variant="body2" color="text.secondary">{row.department}</Typography>,
    },
    {
      id: 'punchTime',
      label: 'Punch Time',
      width: 110,
      sortable: false,
      render: (row) =>
        row.punchTime ? (
          <Typography variant="body2" fontWeight={500}>{row.punchTime}</Typography>
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 120,
      valueGetter: (row) => row.status,
      render: (row) =>
        row.status === 'PRESENT' ? (
          <StatusBadge status="PRESENT" />
        ) : row.status === 'LATE' ? (
          <StatusBadge status="LATE" suffix={formatLateDuration(Math.max(0, dayjs(row.punchDate).diff(dayjs(`${startDate}T${shiftStart}`, 'YYYY-MM-DDTHH:mm'), 'minute')))} />
        ) : (
          <StatusBadge status="ABSENT" />
        ),
    },
    {
      id: 'location',
      label: 'Location',
      width: 180,
      sortable: false,
      render: (row) =>
        row.location ? (
          <Stack direction="column" spacing={0.25}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {row.location.withinGeofence ? (
                <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
              ) : (
                <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />
              )}
              <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }} noWrap>
                {row.location.branchName || (row.location.withinGeofence ? 'At Office' : 'Remote / Outside')}
              </Typography>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
        ),
    },
    {
      id: 'selfieUrl',
      label: 'Photo',
      width: 80,
      align: 'center',
      sortable: false,
      render: (row) =>
        row.selfieUrl ? (
          <Tooltip title="View selfie">
            <IconButton
              size="small"
              onClick={() => setPreviewSelfie({ url: row.selfieUrl, name: row.name, time: row.punchTime })}
              sx={{ p: 0.5 }}
              aria-label={`View selfie of ${row.name}`}
            >
              <CameraAltOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
        ),
    },
  ];

  return (
    <Card sx={{ p: 2.5 }}>
      {/* Header & Search */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            Staff Attendance Log
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isMultiDayRange
              ? `Records from ${dayjs(startDate).format('MMM D')} to ${dayjs(endDate).format('MMM D, YYYY')}`
              : `Live punch records for ${dayjs(startDate).format('MMMM D, YYYY')}`}
          </Typography>
        </Box>

        <TextField
          placeholder="Search by name or ID..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            width: { xs: '100%', md: 240 },
            '& .MuiOutlinedInput-root': {
              fontSize: '0.8125rem',
              bgcolor: 'background.default',
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={statusTab}
          onChange={(_, val) => setStatusTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              fontSize: '0.8125rem',
              fontWeight: 500,
              textTransform: 'none',
              py: 0.5,
              px: 1.5,
            },
          }}
        >
          <Tab label={`All (${counts.all})`} value="ALL" />
          <Tab label={`Present (${counts.present})`} value="PRESENT" />
          <Tab label={`On Time (${counts.onTime})`} value="ON_TIME" />
          <Tab label={`Late (${counts.late})`} value="LATE" />
          <Tab label={`Absent (${counts.absent})`} value="ABSENT" />
        </Tabs>
      </Box>

      {/* Department Filter Pills */}
      {departments.length > 2 && (
        <Stack direction="row" spacing={0.75} sx={{ mb: 2, overflowX: 'auto', pb: 0.5 }} useFlexGap flexWrap="wrap">
          {departments.map((dept) => (
            <Box
              key={dept}
              onClick={() => setSelectedDept(dept)}
              sx={{
                px: 1.25,
                py: 0.35,
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                bgcolor: selectedDept === dept ? 'primary.main' : 'action.hover',
                color: selectedDept === dept ? 'primary.contrastText' : 'text.secondary',
                transition: 'all 0.15s',
                '&:hover': {
                  bgcolor: selectedDept === dept ? 'primary.dark' : 'divider',
                },
              }}
            >
              {dept === 'ALL' ? 'All Departments' : dept}
            </Box>
          ))}
        </Stack>
      )}

      {/* DataGrid – dense; client-side pagination (roster can be long).
          Search/tabs above already filter; the grid paginates the result. */}
      {attLoading || usersLoading ? (
        <TableSkeleton rowCount={4} columnCount={6} />
      ) : (
        <GenericDataGrid
          rows={filteredStaff}
          columns={columns}
          size="small"
          showToolbar={false}
          rowsPerPage={10}
        />
      )}

      {/* Selfie Preview Modal */}
      <GenericDialog
        open={Boolean(previewSelfie)}
        onClose={() => setPreviewSelfie(null)}
        title={`Verification Photo • ${previewSelfie?.name || ''}`}
        maxWidth="xs"
      >
        {previewSelfie && (
          <Stack spacing={1.5} alignItems="center">
            <Box
              component="img"
              src={previewSelfie.url}
              alt="Verification"
              sx={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 1.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              Recorded at {previewSelfie.time}
            </Typography>
          </Stack>
        )}
      </GenericDialog>
    </Card>
  );
};

export default WhosInTodayBoard;
