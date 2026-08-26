import { useAppQuery } from '../../shared/hooks';
import React, { useState, useMemo } from 'react';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../../shared/auth/AuthContext';
import { GET_TODAY_STATUS, GET_MY_ATTENDANCE, GET_HOLIDAYS, GET_SETTINGS, GET_MY_REGULARIZATIONS, GET_MY_LEAVE_REQUESTS } from '../../graphql/queries';
import ClockWidget from '../attendance/components/ClockWidget';
import AttendanceDialog from '../attendance/components/AttendanceDialog';
import ApplyLeaveModal from '../leaves/components/ApplyLeaveModal';
import RegularizeAttendanceModal from '../attendance/components/RegularizeAttendanceModal';
import GenericDialog from '../../shared/ui/GenericDialog';
import AppButton from '../../shared/ui/AppButton';
import AppChip from '../../shared/ui/AppChip';
import StatusBadge from '../../shared/ui/StatusBadge';
import StatCard from '../../shared/ui/StatCard';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalPharmacyOutlinedIcon from '@mui/icons-material/LocalPharmacyOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined';

const LEAVE_TYPE_LABELS = { CASUAL: 'Casual Leave', SICK: 'Sick Leave', EARNED: 'Earned Leave' };

const StaffDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const todayStr = dayjs().format('YYYY-MM-DD');
  const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');

  // Queries
  const { data: todayData } = useAppQuery(GET_TODAY_STATUS, { pollInterval: 15000 });
  const { data: attendanceData, loading: attendanceLoading, error: attendanceError, refetch: refetchAttendance } = useAppQuery(GET_MY_ATTENDANCE, {
    variables: { startDate: startOfMonth, endDate: todayStr },
    pollInterval: 20000,
  });
  const { data: holidaysData } = useAppQuery(GET_HOLIDAYS, {
    variables: { year: dayjs().year() },
  });
  const { data: settingsData } = useAppQuery(GET_SETTINGS);
  const { data: regData, refetch: refetchRegs } = useAppQuery(GET_MY_REGULARIZATIONS);
  const { data: leavesData } = useAppQuery(GET_MY_LEAVE_REQUESTS, { pollInterval: 30000 });

  const [punchDialog, setPunchDialog] = useState({ open: false, type: 'CLOCK_IN' });
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [regularizeModalOpen, setRegularizeModalOpen] = useState(false);
  const [previewSelfie, setPreviewSelfie] = useState(null);

  const todayStatus = todayData?.todayStatus;
  const settings = settingsData?.settings;
  const shiftText = settings ? `${settings.shiftStartTime || '09:00'} - ${settings.shiftEndTime || '18:00'}` : '09:00 - 18:00';
  const assignedSiteName = user?.assignedOffice?.name || null;
  const officeName = assignedSiteName || `${settings?.officeName || 'Head Office'} (Default)`;
  const graceMinutes = settings?.lateThresholdMinutes || 15;

  // Compute staff monthly muster metrics
  const myRecords = attendanceData?.myAttendance || [];
  const totalDaysInMonth = myRecords.length;
  const presentDays = myRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const lateDays = myRecords.filter((r) => r.status === 'LATE').length;
  const onTimeDays = Math.max(0, presentDays - lateDays);

  const totalHoursWorked = myRecords.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
  const avgHoursPerDay = presentDays > 0 ? (totalHoursWorked / presentDays).toFixed(1) : '0.0';
  
  const shiftStart = user?.shiftStartTime || settingsData?.settings?.shiftStartTime || '09:00';
  const shiftEnd = user?.shiftEndTime || settingsData?.settings?.shiftEndTime || '17:00';
  let dailyRequiredHours = 8;
  if (shiftStart && shiftEnd) {
    dailyRequiredHours = dayjs(`2000-01-01T${shiftEnd}`).diff(dayjs(`2000-01-01T${shiftStart}`), 'hour', true);
    if (dailyRequiredHours < 0) dailyRequiredHours += 24;
  }
  const expectedTotal = presentDays * dailyRequiredHours;
  const shortfall = Math.max(0, expectedTotal - totalHoursWorked).toFixed(1);

  const balances = user?.leaveBalances || { casual: 12, sick: 6, earned: 0 };
  const totalAvailableLeaves = balances.casual + balances.sick + balances.earned;

  // Upcoming Holidays
  const upcomingHolidays = useMemo(() => {
    const list = holidaysData?.holidays || [];
    return list
      .filter((h) => dayjs(h.date).isAfter(dayjs().subtract(1, 'day')))
      .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
      .slice(0, 3);
  }, [holidaysData]);

  // Today's check-in status info
  const hasClockedIn = !!todayStatus?.clockIn;
  const hasClockedOut = !!todayStatus?.clockOut;

  // Latest leave applications for the right-rail widget (server already sorts by newest first)
  const myRecentLeaves = (leavesData?.myLeaveRequests || []).slice(0, 3);

  // Time-aware greeting for the hero banner
  const hourNow = dayjs().hour();
  const greeting = hourNow < 12 ? 'Good Morning' : hourNow < 17 ? 'Good Afternoon' : 'Good Evening';

  // Recent punch log – widget-mode GenericDataGrid data
  const recentRows = useMemo(
    () =>
      myRecords.slice(0, 8).map((row) => ({
        id: row.id ?? row.date,
        date: row.date,
        clockInAt: row.clockIn?.createdAt,
        clockOutAt: row.clockOut?.createdAt,
        totalHours: row.totalHours,
        status: row.status,
        selfieUrl: row.clockIn?.selfieUrl,
      })),
    [myRecords]
  );

  const recentColumns = [
    {
      id: 'date',
      label: 'Date',
      width: 110,
      valueGetter: (row) => row.date,
      render: (row) => (
        <Typography variant="body2" fontWeight={500} sx={{ color: 'text.primary' }}>
          {dayjs(row.date).format('ddd, MMM D')}
        </Typography>
      ),
    },
    {
      id: 'clockInAt',
      label: 'Clock In',
      width: 100,
      sortable: false,
      render: (row) => (
        <Typography variant="body2" sx={{ color: row.clockInAt ? 'text.primary' : 'text.disabled' }}>
          {row.clockInAt ? dayjs(row.clockInAt).format('hh:mm A') : '—'}
        </Typography>
      ),
    },
    {
      id: 'clockOutAt',
      label: 'Clock Out',
      width: 100,
      sortable: false,
      render: (row) => (
        <Typography variant="body2" sx={{ color: row.clockOutAt ? 'text.primary' : 'text.disabled' }}>
          {row.clockOutAt ? dayjs(row.clockOutAt).format('hh:mm A') : '—'}
        </Typography>
      ),
    },
    {
      id: 'totalHours',
      label: 'Total Hours',
      width: 100,
      valueGetter: (row) => row.totalHours ?? 0,
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {row.totalHours ? `${row.totalHours} hrs` : '—'}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 120,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'selfieUrl',
      label: 'Photo',
      width: 70,
      align: 'center',
      sortable: false,
      render: (row) =>
        row.selfieUrl ? (
          <CameraAltOutlinedIcon
            onClick={() => setPreviewSelfie({ url: row.selfieUrl, date: row.date })}
            sx={{ fontSize: 16, color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
            aria-label="View selfie"
          />
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
        ),
    },
  ];

  return (
    <Stack spacing={1.5}>
      {/* 1. Header Banner */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
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
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.75 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {greeting}, {user?.name?.split(' ')[0]}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body2" color="text.secondary">
                {dayjs().format('dddd, MMMM D, YYYY')}
              </Typography>
              <Typography variant="caption" color="text.disabled">•</Typography>
              <Typography variant="body2" color="text.secondary">
                Shift: <span style={{ color: 'text.primary', fontWeight: 500 }}>{shiftText}</span>
              </Typography>
              <Typography variant="caption" color="text.disabled">•</Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <LocationOnOutlinedIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  {officeName}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <AppButton
              color="primary"
              startIcon={<CalendarMonthOutlinedIcon fontSize="small" />}
              onClick={() => setLeaveModalOpen(true)}
            >
              Apply Leave
            </AppButton>
            <AppButton
              variant="outlined"
              startIcon={<EditCalendarOutlinedIcon fontSize="small" />}
              onClick={() => setRegularizeModalOpen(true)}
            >
              Regularize Attendance
            </AppButton>
            <AppButton
              variant="outlined"
              startIcon={<LocalPharmacyOutlinedIcon fontSize="small" />}
              onClick={() => navigate('/stock')}
            >
              Request Stock
            </AppButton>
            <AppButton
              variant="outlined"
              startIcon={<HistoryOutlinedIcon fontSize="small" />}
              onClick={() => navigate('/history')}
            >
              My History
            </AppButton>
          </Stack>
        </Stack>
      </Box>

      {/* 2. Staff KPI Summary Cards */}
      <Grid container spacing={1.5}>
        {/* Card 1: Monthly Attendance */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={EventAvailableOutlinedIcon}
            label="This Month's Turnout"
            value={totalDaysInMonth > 0 ? `${Math.round((presentDays / totalDaysInMonth) * 100)}%` : '—'}
            meta={totalDaysInMonth > 0 ? `${onTimeDays} on-time | ${lateDays} late check-ins` : 'No punches recorded yet this month'}
            badgeText={totalDaysInMonth > 0 ? `${presentDays}/${totalDaysInMonth} Days` : 'No data'}
            badgeBg="success.light"
            badgeColor="success.dark"
          />
        </Grid>

        {/* Card 2: Leave Balances with 1-Click Apply */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={BeachAccessOutlinedIcon}
            label="Available Leaves"
            value={`${totalAvailableLeaves} Days Total`}
            meta={`Casual: ${balances.casual} | Sick: ${balances.sick} | Earned: ${balances.earned}`}
            action={
              <Button
                size="small"
                onClick={() => setLeaveModalOpen(true)}
                sx={{ p: 0, fontSize: '0.6875rem', color: 'primary.main', fontWeight: 600, minWidth: 'auto' }}
              >
                + Apply
              </Button>
            }
          />
        </Grid>

        {/* Card 3: Average Daily Hours */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={ScheduleOutlinedIcon}
            label="Avg Daily Hours"
            value={`${avgHoursPerDay} hrs`}
            meta={`Total ${totalHoursWorked.toFixed(1)} hours logged`}
            badgeText="Optimal"
            badgeBg="background.default"
            badgeColor="text.secondary"
          />
        </Grid>

        {/* Card 4: Today's Status */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={TouchAppOutlinedIcon}
            label="Today's Punch"
            value={todayStatus?.clockIn ? dayjs(todayStatus.clockIn.createdAt).format('hh:mm A') : 'Not Checked In'}
            meta={
              todayStatus?.clockOut
                ? `Clocked out at ${dayjs(todayStatus.clockOut.createdAt).format('hh:mm A')}`
                : 'Selfie & GPS verified at punch'
            }
            badgeText={hasClockedOut ? 'Completed' : hasClockedIn ? 'Active' : 'Pending'}
            badgeBg={hasClockedOut ? 'success.light' : hasClockedIn ? 'action.selected' : 'warning.light'}
            badgeColor={hasClockedOut ? 'success.dark' : hasClockedIn ? 'primary.main' : 'warning.dark'}
          />
        </Grid>
      </Grid>

      {/* 4. Main Operational Layout */}
      <Grid container spacing={1.5}>
        {/* Left Column: Clock-in Hub & Attendance Log */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            {/* Core Clock-In & Verification Widget with Live Stopwatch */}
            <ClockWidget
              todayStatus={todayStatus}
              onClockIn={() => setPunchDialog({ open: true, type: 'CLOCK_IN' })}
              onClockOut={() => setPunchDialog({ open: true, type: 'CLOCK_OUT' })}
              onRegularize={() => setRegularizeModalOpen(true)}
            />

          </Stack>
        </Grid>

        {/* Right Column: Location Status, Holidays & Recent Leaves */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            {/* Geofence & Location Quick Card */}
            <Card sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <LocationOnOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.primary' }}>
                  Designated Office
                </Typography>
              </Stack>
              <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary' }}>
                {officeName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {assignedSiteName ? 'Your assigned site' : 'No site assigned – org default applies'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Geofence Radius: {settings?.geofenceRadius || 200} meters
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Shift {shiftText} · {graceMinutes}-min grace period
              </Typography>
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: 'background.default',
                  border: '1px solid', borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 18 }} />
                <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
                  VPN & Anti-Spoofing checks enabled during punch
                </Typography>
              </Box>
            </Card>

            {/* Upcoming Holidays Widget */}
            <Card sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <BeachAccessOutlinedIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.primary' }}>
                    Upcoming Holidays
                  </Typography>
                </Stack>
                <Button size="small" onClick={() => navigate('/holidays')} sx={{ fontSize: '0.75rem', p: 0 }}>
                  View All
                </Button>
              </Stack>

              {upcomingHolidays.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No upcoming holidays scheduled.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {upcomingHolidays.map((h, i) => {
                    const daysLeft = dayjs(h.date).diff(dayjs(), 'day');
                    return (
                      <Box
                        key={i}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: 'background.default',
                          border: '1px solid', borderColor: 'divider',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary', fontSize: '0.8125rem' }}>
                            {h.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(h.date).format('dddd, MMM D')}
                          </Typography>
                        </Box>
                        <AppChip
                          label={daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`}
                          size="small"
                          tone={daysLeft <= 3 ? 'warning' : 'primary'}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Card>

            {/* My Recent Leave Requests – keeps the right rail balanced with the clock card */}
            <Card sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EventNoteOutlinedIcon sx={{ color: 'info.main', fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.primary' }}>
                    My Leave Requests
                  </Typography>
                </Stack>
                <Button size="small" onClick={() => navigate('/leaves')} sx={{ fontSize: '0.75rem', p: 0 }}>
                  View All
                </Button>
              </Stack>

              {myRecentLeaves.length === 0 ? (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    py: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No leave requests yet.
                  </Typography>
                  <Button size="small" variant="outlined" onClick={() => setLeaveModalOpen(true)} sx={{ fontSize: '0.75rem' }}>
                    Apply for Leave
                  </Button>
                </Box>
              ) : (
                <Stack spacing={1.5} sx={{ flex: 1 }}>
                  {myRecentLeaves.map((l) => (
                    <Box
                      key={l.id}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        bgcolor: 'background.default',
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary', fontSize: '0.8125rem' }}>
                          {LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(l.startDate).format('MMM D')}
                          {l.endDate && l.endDate !== l.startDate ? ` – ${dayjs(l.endDate).format('MMM D')}` : ''}
                        </Typography>
                      </Box>
                      <StatusBadge status={l.status} />
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* 5. Recent Attendance Log – full width so both columns stay balanced */}
      <Card sx={{ p: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.primary' }}>
              Recent Attendance Log
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your recent punch entries, hours logged, and verification selfie photos
            </Typography>
          </Box>
        </Stack>

        {/* Widget-mode DataGrid: dense, no toolbar/pagination – latest 8 punches */}
        <GenericDataGrid
          rows={recentRows}
          columns={recentColumns}
          loading={attendanceLoading}
          error={attendanceError}
          onRetry={refetchAttendance}
          size="small"
          hidePagination
          showToolbar={false}
        />

        <Button
          fullWidth
          variant="outlined"
          startIcon={<HistoryOutlinedIcon fontSize="small" />}
          onClick={() => navigate('/history')}
          sx={{ mt: 1.5 }}
        >
          View Full Attendance History
        </Button>
      </Card>

      {/* Attendance Biometric Punch Dialog */}
      <AttendanceDialog
        open={punchDialog.open}
        onClose={() => setPunchDialog({ open: false, type: 'CLOCK_IN' })}
        type={punchDialog.type}
      />

      {/* Unified Leave Application Modal */}
      <ApplyLeaveModal
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
      />

      {/* Regularize Missed Punch Modal */}
      <RegularizeAttendanceModal
        open={regularizeModalOpen}
        onClose={() => setRegularizeModalOpen(false)}
        onSuccess={() => {
          refetchAttendance();
          refetchRegs();
        }}
      />

      {/* Selfie Lightbox Modal */}
      <GenericDialog
        open={Boolean(previewSelfie)}
        onClose={() => setPreviewSelfie(null)}
        title={`Verification Photo • ${previewSelfie?.date || ''}`}
        maxWidth="xs"
      >
        {previewSelfie && (
          <Box
            component="img"
            src={previewSelfie.url}
            alt="Selfie"
            sx={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 2 }}
          />
        )}
      </GenericDialog>
    </Stack>
  );
};

export default StaffDashboard;




