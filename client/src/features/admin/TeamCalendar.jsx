import { useMemo, useState } from 'react';
import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EmptyState from '../../shared/ui/EmptyState';
import PageHeader from '../../shared/ui/PageHeader';
import { useAppQuery } from '../../shared/hooks';
import { GET_HOLIDAYS, GET_ALL_LEAVE_REQUESTS, GET_EXEMPTIONS } from '../../graphql/queries';
import { STATUS_COLORS } from '../../shared/constants';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Deterministic avatar colour per staff member (stable across renders). */
const AVATAR_COLORS = [
  '#005CE6', '#0E8A16', '#D93025', '#B26800', '#6F42C1',
  '#188038', '#C5221F', '#9334E6', '#0B8043', '#E5252B',
  '#F4511E', '#12B5CB', '#8E24AA', '#01635D', '#CA3B68',
];

const colorFor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/* ────────────────────────────────────────────────────────────────────────────
 * TEAM CALENDAR month view: approved leaves, holidays and day-offs at a glance
 * ──────────────────────────────────────────────────────────────────────────── */
const TeamCalendar = () => {
  const today = dayjs();
  const [anchor, setAnchor] = useState(today.startOf('month'));
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));

  const monthStart = anchor.startOf('month');
  const monthEnd = anchor.endOf('month');
  const rangeStart = monthStart.format('YYYY-MM-DD');
  const rangeEnd = monthEnd.format('YYYY-MM-DD');

  const { data: holidaysData, loading: holidaysLoading } = useAppQuery(GET_HOLIDAYS, {
    variables: { year: anchor.year() },
    fetchPolicy: 'cache-and-network',
  });

  const { data: leavesData, loading: leavesLoading } = useAppQuery(GET_ALL_LEAVE_REQUESTS, {
    fetchPolicy: 'cache-and-network',
  });

  const { data: exemptionsData, loading: exemptionsLoading } = useAppQuery(GET_EXEMPTIONS, {
    variables: { startDate: rangeStart, endDate: rangeEnd },
    fetchPolicy: 'cache-and-network',
  });

  const loading = holidaysLoading || leavesLoading || exemptionsLoading;

  /* Normalize server records once. */
  const holidays = useMemo(() => holidaysData?.holidays || [], [holidaysData]);
  const approvedLeaves = useMemo(
    () => (leavesData?.allLeaveRequests || []).filter((l) => l.status === 'APPROVED'),
    [leavesData]
  );
  const dayOffs = useMemo(() => exemptionsData?.exemptions || [], [exemptionsData]);

  /* Map date -> events for fast lookup. */
  const eventsByDate = useMemo(() => {
    const map = new Map();
    holidays.forEach((h) => {
      const key = dayjs(h.date).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, { holidays: [], leaves: [], dayOffs: [] });
      map.get(key).holidays.push(h);
    });
    approvedLeaves.forEach((l) => {
      const start = dayjs(l.startDate).startOf('day');
      const end = dayjs(l.endDate).startOf('day');
      for (let d = start; !d.isAfter(end); d = d.add(1, 'day')) {
        const key = d.format('YYYY-MM-DD');
        if (!map.has(key)) map.set(key, { holidays: [], leaves: [], dayOffs: [] });
        map.get(key).leaves.push(l);
      }
    });
    dayOffs.forEach((x) => {
      const key = dayjs(x.date).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, { holidays: [], leaves: [], dayOffs: [] });
      map.get(key).dayOffs.push(x);
    });
    return map;
  }, [holidays, approvedLeaves, dayOffs]);

  /* 42-cell month grid (Sun-Sat) so every month renders 6 stable rows. */
  const gridDays = useMemo(() => {
    const start = monthStart.startOf('week');
    return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
  }, [monthStart]);

  const selectedEvents = eventsByDate.get(selectedDate) || { holidays: [], leaves: [], dayOffs: [] };
  const isToday = (d) => d.isSame(today, 'day');

  const gotoMonth = (offset) => setAnchor((prev) => prev.add(offset, 'month'));

  return (
    <Box>
      <PageHeader
        title="Team Calendar"
        subtitle="Approved leaves, holidays and day-offs at a glance"
        backButton="/"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" onClick={() => setAnchor(today.startOf('month'))} aria-label="Go to today">
              <TodayIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => gotoMonth(-1)} aria-label="Previous month">
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => gotoMonth(1)} aria-label="Next month">
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1.5, px: 0.5 }}
              >
                <Typography variant="h6" fontWeight={700}>
                  {anchor.format('MMMM YYYY')}
                </Typography>
              </Stack>

              {/* Weekday header */}
              <Grid container spacing={0.5} sx={{ mb: 0.5 }}>
                {WEEKDAYS.map((d) => (
                  <Grid key={d} size={{ xs: 12 / 7, sm: 1.7142 }}>
                    <Typography
                      variant="caption"
                      align="center"
                      display="block"
                      fontWeight={700}
                      sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                    >
                      {d}
                    </Typography>
                  </Grid>
                ))}
              </Grid>

              {/* Calendar cells */}
              <Grid container spacing={0.5}>
                {gridDays.map((d) => {
                  const key = d.format('YYYY-MM-DD');
                  const inMonth = d.month() === anchor.month();
                  const ev = eventsByDate.get(key);
                  const isSelected = key === selectedDate;

                  return (
                    <Grid key={key} size={{ xs: 12 / 7, sm: 1.7142 }}>
                      <Box
                        onClick={() => setSelectedDate(key)}
                        sx={{
                          minHeight: { xs: 52, sm: 74 },
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected
                            ? 'primary.light'
                            : isToday(d)
                              ? 'action.hover'
                              : inMonth
                                ? 'background.paper'
                                : 'action.disabledBackground',
                          p: 0.5,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.25,
                          cursor: 'pointer',
                          transition: 'border-color 0.12s ease',
                          '&:hover': { borderColor: 'primary.main' },
                          opacity: inMonth ? 1 : 0.45,
                        }}
                      >
                        <Typography
                          variant="caption"
                          fontWeight={isToday(d) ? 800 : 500}
                          sx={{
                            color: isToday(d) ? 'primary.main' : 'text.secondary',
                            fontSize: '0.7rem',
                            lineHeight: 1,
                          }}
                        >
                          {d.date()}
                        </Typography>

                        {/* Holiday badge */}
                        {ev?.holidays.length > 0 && (
                          <Tooltip title={ev.holidays.map((h) => h.name).join(', ')} arrow>
                            <Chip
                              size="small"
                              label={ev.holidays.length > 1 ? `${ev.holidays.length} 🎉` : '🎉'}
                              sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'error.light', color: 'error.dark', '& .MuiChip-label': { px: 0.5 } }}
                            />
                          </Tooltip>
                        )}

                        {/* Leave avatars (max 3, then +N) */}
                        {ev?.leaves.length > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 'auto' }}>
                            {ev.leaves.slice(0, 3).map((l) => (
                              <Tooltip key={l.id} title={`${l.user?.name} - ${l.leaveType}`} arrow>
                                <Avatar
                                  sx={{
                                    width: 18,
                                    height: 18,
                                    fontSize: '0.55rem',
                                    fontWeight: 700,
                                    bgcolor: colorFor(l.user?.id),
                                  }}
                                >
                                  {initialsOf(l.user?.name)}
                                </Avatar>
                              </Tooltip>
                            ))}
                            {ev.leaves.length > 3 && (
                              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 700 }}>
                                +{ev.leaves.length - 3}
                              </Typography>
                            )}
                          </Box>
                        )}

                        {/* Day-off dot */}
                        {ev?.dayOffs.length > 0 && (
                          <Tooltip title={`${ev.dayOffs.length} day-off(s)`} arrow>
                            <Box sx={{ width: 10, height: 6, borderRadius: 1, bgcolor: 'secondary.main', mt: 0.5 }} />
                          </Tooltip>
                        )}

                        {!ev && <Box sx={{ mt: 'auto' }} />}
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        </Grid>        {/* Selected-day detail panel */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ position: 'sticky', top: 16 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                {dayjs(selectedDate).format('dddd, D MMMM YYYY')}
              </Typography>

              {loading ? (
                <Typography variant="body2" color="text.secondary">Loading…</Typography>
              ) : (
                <>
                  {selectedEvents.holidays.map((h) => (
                    <Stack key={h.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: 'error.light', color: 'error.dark' }}>
                        <CelebrationIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {h.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {h.type === 'NATIONAL' ? 'National holiday' : 'Optional holiday'}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}

                  {selectedEvents.leaves.map((l) => (
                    <Stack key={l.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: colorFor(l.user?.id) }}>
                        {initialsOf(l.user?.name)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {l.user?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {l.leaveType} leave
                          {l.startDate !== l.endDate &&
                            ` • ${dayjs(l.startDate).format('D MMM')} – ${dayjs(l.endDate).format('D MMM')}`}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}

                  {selectedEvents.dayOffs.map((x) => (
                    <Stack key={x.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.light', color: 'secondary.dark' }}>
                        <FreeBreakfastIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {x.user?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Day off {x.reason ? `• ${x.reason}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}

                  {selectedEvents.holidays.length === 0 &&
                    selectedEvents.leaves.length === 0 &&
                    selectedEvents.dayOffs.length === 0 && (
                      <EmptyState
                        variant="empty"
                        compact
                        icon={EventBusyIcon}
                        title="Nothing scheduled"
                        description="No holidays, approved leaves or day-offs on this date."
                      />
                    )}
                </>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Legend */}
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <BeachAccessIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    Colored initials = staff on approved leave
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CelebrationIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    🎉 = public holiday ({STATUS_COLORS.HOLIDAY.label})
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FreeBreakfastIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    • = day off granted by admin
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TeamCalendar;