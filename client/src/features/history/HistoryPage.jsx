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

  const rows = (records || []).map((record) => ({
    id: `${record.date}_${record.user?.id}`,
    employeeName: record.user?.name,
    employeeId: record.user?.employeeId,
    date: record.date,
    clockIn: record.clockIn?.createdAt ? dayjs(!isNaN(Number(record.clockIn.createdAt)) ? Number(record.clockIn.createdAt) : record.clockIn.createdAt).format('hh:mm A') : '-',
    clockOut: record.clockOut?.createdAt ? dayjs(!isNaN(Number(record.clockOut.createdAt)) ? Number(record.clockOut.createdAt) : record.clockOut.createdAt).format('hh:mm A') : '-',
    clockInSelfie: record.clockIn?.selfieUrl,
    totalHours: record.totalHours > 0 ? `${record.totalHours.toFixed(1)} hrs` : '—',
    status: record.status,
    rawLocation: record.clockIn?.location,
    location: record.clockIn?.location?.address || 'Not recorded',
  }));

  const columns = [
    { id: 'date', label: 'Date', width: 110, valueGetter: (row) => row.date, render: (row) => dayjs(row.date).format('DD MMM') },
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
      id: 'clockInSelfie',
      label: 'Selfie',
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
    { id: 'clockOut', label: 'Clock Out', width: 100 },
    { id: 'totalHours', label: 'Hours', width: 90 },
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
