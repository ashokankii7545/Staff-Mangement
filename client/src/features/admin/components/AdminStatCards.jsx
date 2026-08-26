import { useAppQuery } from '../../../shared/hooks';
import React, { useMemo } from 'react';

import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Grid from '@mui/material/Grid2';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import dayjs from 'dayjs';
import StatCard from '../../../shared/ui/StatCard';
import CardSkeleton from '../../../shared/ui/CardSkeleton';
import { GET_DASHBOARD_STATS, GET_USERS, GET_ALL_ATTENDANCE, GET_SETTINGS } from '../../../graphql/queries';

const AdminStatCards = ({ selectedOffice = 'ALL', dateRange }) => {
  const startDate = dateRange?.startDate || dayjs().format('YYYY-MM-DD');
  const endDate = dateRange?.endDate || dayjs().format('YYYY-MM-DD');
  const isToday = startDate === dayjs().format('YYYY-MM-DD') && endDate === dayjs().format('YYYY-MM-DD');

  const { data: statsData, loading: statsLoading } = useAppQuery(GET_DASHBOARD_STATS, {
    skip: !isToday || selectedOffice !== 'ALL',
    pollInterval: 15000,
  });

  const { data: usersData, loading: usersLoading } = useAppQuery(GET_USERS, {
    variables: { isActive: true },
  });

  const { data: attData, loading: attLoading } = useAppQuery(GET_ALL_ATTENDANCE, {
    variables: { startDate, endDate },
    pollInterval: 10000,
  });

  const { data: settingsData } = useAppQuery(GET_SETTINGS);

  const settings = settingsData?.settings;
  const shiftStart = settings?.shiftStartTime || '09:00';
  const lateThreshold = settings?.lateThresholdMinutes || 15;

  const computedStats = useMemo(() => {
    if (isToday && selectedOffice === 'ALL' && statsData?.dashboardStats) {
      const s = statsData.dashboardStats;
      const total = s.totalStaff || 0;
      const present = s.presentToday || 0;
      const late = s.lateToday || 0;
      const absent = s.absentToday || 0;
      const onLeave = s.onLeaveToday || 0;
      return { total, present, late, absent, onLeave };
    }

    if (!usersData?.users) {
      return { total: 0, present: 0, late: 0, absent: 0, onLeave: 0 };
    }

    const filteredUsers = usersData.users
      .filter((u) => u.role === 'STAFF')
      .filter((u) => selectedOffice === 'ALL' || u.assignedOffice?.id === selectedOffice);

    const userIds = new Set(filteredUsers.map((u) => u.id));
    const rangeAttendance = (attData?.allAttendance || []).filter((a) => userIds.has(a.user.id));

    // Unique users who clocked in during this range
    const clockedInUsers = new Set();
    let late = 0;

    rangeAttendance.forEach((a) => {
      if (a.clockIn) {
        clockedInUsers.add(a.user.id);
        const shiftStartTime = dayjs(`${a.date}T${shiftStart}`);
        const diffMinutes = dayjs(a.clockIn.createdAt).diff(shiftStartTime, 'minute');
        if (diffMinutes > lateThreshold) late++;
      }
    });

    const total = filteredUsers.length;
    const present = clockedInUsers.size;
    const absent = Math.max(0, total - present);

    return { total, present, late, absent, onLeave: 0 };
  }, [isToday, selectedOffice, statsData, usersData, attData, settings, shiftStart, lateThreshold]);

  const { total, present, late, absent, onLeave } = computedStats;
  const onTimeCount = Math.max(0, present - late);
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
  const onTimePercent = present > 0 ? Math.round((onTimeCount / present) * 100) : 0;

  if (statsLoading && isToday && selectedOffice === 'ALL' && !statsData) {
    return <CardSkeleton count={4} />;
  }

  const cards = [
    {
      label: 'Total Workforce',
      value: total,
      meta: selectedOffice === 'ALL' ? 'Across all active sites' : 'Assigned to this site',
      icon: PeopleOutlineIcon,
      badgeText: '100% Tracked',
      badgeBg: 'action.hover',
      badgeColor: 'text.secondary',
      progress: null,
    },
    {
      label: 'Active Turnout',
      value: present,
      meta: `${attendanceRate}% period attendance rate`,
      icon: CheckCircleOutlineIcon,
      badgeText: `${onTimeCount} on time`,
      badgeBg: 'success.light',
      badgeColor: 'success.dark',
      progress: (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 500 }}>
              {onTimePercent}% On-time
            </Typography>
            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 500 }}>
              {late} Late
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={onTimePercent}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: 'warning.light',
              '& .MuiLinearProgress-bar': { bgcolor: 'success.main' },
            }}
          />
        </Box>
      ),
    },
    {
      label: 'Late Check-ins',
      value: late,
      meta: 'Past 15-min threshold',
      icon: AccessTimeIcon,
      badgeText: late === 0 ? 'Optimal' : `${late} delayed`,
      badgeBg: late === 0 ? 'action.hover' : 'warning.light',
      badgeColor: late === 0 ? 'text.secondary' : 'warning.dark',
      progress: null,
    },
    {
      label: 'Absent / On Leave',
      value: absent,
      meta: `${onLeave} planned leaves`,
      icon: HighlightOffIcon,
      badgeText: absent - onLeave > 0 ? `${absent - onLeave} Unplanned` : '0 Unplanned',
      badgeBg: absent - onLeave > 0 ? 'error.light' : 'action.hover',
      badgeColor: absent - onLeave > 0 ? 'error.main' : 'text.secondary',
      progress: null,
    },
  ];

  return (
    <Grid container spacing={2}>
      {cards.map((c, idx) => (
        <Grid key={idx} size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label={c.label}
            value={c.value}
            meta={c.meta}
            badgeText={c.badgeText}
            badgeBg={c.badgeBg}
            badgeColor={c.badgeColor}
            progress={c.progress}
          />
        </Grid>
      ))}
    </Grid>
  );
};

export default AdminStatCards;



