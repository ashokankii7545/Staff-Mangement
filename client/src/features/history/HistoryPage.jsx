import { useAppQuery } from '../../shared/hooks';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import dayjs from 'dayjs';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import { GET_MY_ATTENDANCE, GET_ALL_ATTENDANCE } from '../../graphql/queries';
import { useAuth } from '../../shared/auth/AuthContext';
import DateRangePicker from '../../shared/ui/DateRangePicker';
import PageHeader from '../../shared/ui/PageHeader';
import GenericDialog from '../../shared/ui/GenericDialog';
import { StatusBadge } from '../../shared/ui';

const HistoryPage = () => {
  const { isAdmin } = useAuth();
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    label: 'This Month',
  });
  const [selfiePreview, setSelfiePreview] = useState(null);

  const query = isAdmin ? GET_ALL_ATTENDANCE : GET_MY_ATTENDANCE;
  const { data, loading, error, refetch } = useAppQuery(query, {
    variables: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
    fetchPolicy: 'cache-and-network',
  });

  const records = isAdmin ? data?.allAttendance : data?.myAttendance;

  // Robust epoch/ISO → "hh:mm A"
  const fmtTime = (ts) =>
    ts ? dayjs(!isNaN(Number(ts)) ? Number(ts) : ts).format('hh:mm A') : '—';

  // ── Expand each day into ONE ROW PER SESSION (multi check-in/out) ──
  // A day with 3 clock-in/out pairs becomes 3 rows, each with its own times,
  // selfies, hours and location. Days with no paired session (open punch,
  // exempt, absent) still render a single summary row.
  const rows = [];
  for (const record of records || []) {
    const base = {
      employeeName: record.user?.name,
      employeeId: record.user?.employeeId,
      date: record.date,
      dayStatus: record.status,
      dayTotalHours: record.totalHours,
      sessionCount: record.sessionCount ?? (record.sessions?.length || 0),
    };
    const sessions = record.sessions || [];

    if (sessions.length === 0) {
      // No session pair – fall back to the day's first-in/last-out summary.
      rows.push({
        ...base,
        id: `${record.date}_${record.user?.id}_day`,
        sessionLabel: '—',
        clockIn: fmtTime(record.clockIn?.createdAt),
        clockOut: fmtTime(record.clockOut?.createdAt),
        clockInSelfie: record.clockIn?.selfieUrl,
        clockOutSelfie: record.clockOut?.selfieUrl,
        sessionHours: record.totalHours > 0 ? `${record.totalHours.toFixed(1)} hrs` : '—',
        status: record.status,
        rawLocation: record.clockIn?.location,
        location: record.clockIn?.location?.address || 'Not recorded',
      });
      continue;
    }

    sessions.forEach((s, i) => {
      const isOpen = !s.clockOut;
      rows.push({
        ...base,
        id: `${record.date}_${record.user?.id}_s${i}`,
        sessionLabel: `#${i + 1}${sessions.length > 1 ? ` of ${sessions.length}` : ''}`,
        clockIn: fmtTime(s.clockIn?.createdAt),
        clockOut: isOpen ? 'On shift…' : fmtTime(s.clockOut?.createdAt),
        clockInSelfie: s.clockIn?.selfieUrl,
        clockOutSelfie: s.clockOut?.selfieUrl,
        sessionHours: isOpen ? '—' : `${(s.hours || 0).toFixed(1)} hrs`,
        // Per-row status: only the first row carries the day's overall status
        // badge; the rest show a neutral session marker to avoid repetition.
        status: i === 0 ? record.status : (isOpen ? 'ON_DUTY' : 'COMPLETED'),
        rawLocation: s.clockIn?.location,
        location: s.clockIn?.location?.address || 'Not recorded',
      });
    });
  }

  const columns = [
    {
      id: 'date',
      label: 'Date',
      width: 110,
      valueGetter: (row) => row.date,
      render: (row) => (
        <Box>
          <Typography variant="body2" fontSize={13}>{dayjs(row.date).format('DD MMM')}</Typography>
          {row.sessionCount > 1 && (
            <Typography variant="caption" color="text.secondary">
              {row.sessionCount} sessions · {row.dayTotalHours?.toFixed(1)} hrs total
            </Typography>
          )}
        </Box>
      ),
    },
    ...(isAdmin ? [
      {
        id: 'employeeName',
        label: 'Employee',
        width: 180,
        valueGetter: (row) => `${row.employeeName ?? ''} ${row.employeeId ?? ''}`,
        render: (row) => (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
              {row.employeeName?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="body2" fontSize={13}>{row.employeeName}</Typography>
              <Typography variant="caption" color="text.secondary">{row.employeeId}</Typography>
            </Box>
          </Stack>
        ),
      },
    ] : []),
    {
      id: 'sessionLabel',
      label: 'Session',
      width: 90,
      sortable: false,
      render: (row) => (
        <Typography variant="body2" fontWeight={600} color="text.secondary">
          {row.sessionLabel}
        </Typography>
      ),
    },
    {
      id: 'clockInSelfie',
      label: 'In Selfie',
      width: 80,
      align: 'center',
      sortable: false,
      render: (row) => row.clockInSelfie ? (
        <Avatar
          src={row.clockInSelfie}
          alt="Clock-in selfie"
          sx={{ width: 36, height: 36, cursor: 'pointer', border: '2px solid', borderColor: 'divider' }}
          onClick={() => setSelfiePreview(row.clockInSelfie)}
        />
      ) : <Typography variant="caption" color="text.secondary">—</Typography>,
    },
    { id: 'clockIn', label: 'Clock In', width: 100 },
    {
      id: 'clockOutSelfie',
      label: 'Out Selfie',
      width: 80,
      align: 'center',
      sortable: false,
      render: (row) => row.clockOutSelfie ? (
        <Avatar
          src={row.clockOutSelfie}
          alt="Clock-out selfie"
          sx={{ width: 36, height: 36, cursor: 'pointer', border: '2px solid', borderColor: 'divider' }}
          onClick={() => setSelfiePreview(row.clockOutSelfie)}
        />
      ) : <Typography variant="caption" color="text.secondary">—</Typography>,
    },
    { id: 'clockOut', label: 'Clock Out', width: 100 },
    { id: 'sessionHours', label: 'Hours', width: 90 },
    {
      id: 'status',
      label: 'Status',
      width: 130,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'location',
      label: 'Location',
      width: 200,
      sortable: false,
      render: (row) => row.rawLocation ? (
        <Typography
          variant="body2"
          color="primary"
          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          onClick={() => window.open(`https://maps.google.com/?q=${row.rawLocation.latitude},${row.rawLocation.longitude}`, '_blank')}
        >
          {row.location}
        </Typography>
      ) : <Typography variant="body2" color="text.secondary">—</Typography>,
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Attendance History"
        subtitle="View and download attendance records"
        action={
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            ranges={['This Month', 'Last Month', 'Last 3 Months', 'This Year']}
          />
        }
      />

      {/* Data Grid – GenericDataGrid brings its own Paper chrome; wrapping it
          in a bordered Card used to double-frame the table (the stray line
          under the pagination). Plain wrapper now. */}
      <Box>
        <Box sx={{ minHeight: 500 }}>
          <GenericDataGrid
            title="Attendance Records"
            rows={rows}
            columns={columns}
            loading={loading}
            error={error}
            sortBy="date"
            sortDirection="desc"
            exportEnabled
            filename={`attendance_${dateRange.startDate}_${dateRange.endDate}.csv`}
            onRetry={refetch}
          />
        </Box>
      </Box>

      {/* Selfie Preview – shared dialog chrome */}
      <GenericDialog
        open={Boolean(selfiePreview)}
        onClose={() => setSelfiePreview(null)}
        title="Attendance Selfie"
        maxWidth="sm"
      >
        {selfiePreview && (
          <Box
            component="img"
            src={selfiePreview}
            alt="Attendance selfie"
            sx={{ width: '100%', borderRadius: 2 }}
          />
        )}
      </GenericDialog>
    </Box>
  );
};

export default HistoryPage;
