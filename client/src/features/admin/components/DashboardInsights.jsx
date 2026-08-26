import { useAppQuery } from '../../../shared/hooks';
import React from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import { useTheme } from '@mui/material/styles';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import { GET_MONTHLY_TREND, GET_HOLIDAYS } from '../../../graphql/queries';
import { ChartCard } from '../../../shared/ui';

const DashboardInsights = () => {
  const theme = useTheme();
  const currentMonth = dayjs().month() + 1;
  const currentYear = dayjs().year();

  const { data: trendData, loading: trendLoading } = useAppQuery(GET_MONTHLY_TREND, {
    variables: { month: currentMonth, year: currentYear },
  });

  const { data: holidaysData, loading: holidaysLoading } = useAppQuery(GET_HOLIDAYS, {
    variables: { year: currentYear },
  });

  const upcomingHolidays = (holidaysData?.holidays || [])
    .filter((h) => dayjs(h.date).isAfter(dayjs().subtract(1, 'day')))
    .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));

  const chartData = (trendData?.monthlyTrend || []).map((t) => ({
    date: dayjs(t.date).format('DD MMM'),
    Present: t.presentCount,
    Late: t.lateCount,
    Absent: t.absentCount,
  }));

  return (
    <Stack spacing={2}>
      <ChartCard 
        title="Monthly Attendance Trend" 
        icon={TrendingUpIcon} 
        height={160} 
        sx={{ p: 0 }} // overriding if needed
      >
        {trendLoading ? (
          <Skeleton variant="rounded" width="100%" height="100%" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.palette.text.disabled }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: theme.palette.text.disabled }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.text.primary,
                  borderRadius: 6,
                  border: 'none',
                  color: theme.palette.background.paper,
                  fontSize: '0.75rem',
                }}
              />
              <Area
                type="monotone"
                dataKey="Present"
                stroke={theme.palette.primary.main}
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#colorPresent)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled', py: 3, display: 'block', textAlign: 'center' }}>
            No trend records for this month.
          </Typography>
        )}
      </ChartCard>

      {/* 2. Upcoming Holidays */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <CalendarTodayOutlinedIcon sx={{ color: theme.palette.warning.main, fontSize: 16 }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Upcoming Holidays
          </Typography>
        </Stack>

        {holidaysLoading ? (
          <Stack spacing={1}>
            <Skeleton height={32} />
            <Skeleton height={32} />
          </Stack>
        ) : upcomingHolidays.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            No upcoming holidays scheduled.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {upcomingHolidays.slice(0, 3).map((holiday) => {
              const daysDiff = dayjs(holiday.date).diff(dayjs(), 'day');
              const countdownText =
                daysDiff === 0
                  ? 'Today'
                  : daysDiff === 1
                  ? 'Tomorrow'
                  : `In ${daysDiff} days`;

              return (
                <Box
                  key={holiday.id}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'background.default',
                    border: "1px solid ${theme.palette.divider}",
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={500} sx={{ color: 'text.primary', fontSize: '0.8125rem' }}>
                      {holiday.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6875rem' }}>
                      {dayjs(holiday.date).format('ddd, MMM D')}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      bgcolor: daysDiff <= 3 ? theme.palette.warning.light : theme.palette.action.hover,
                      color: daysDiff <= 3 ? theme.palette.warning.dark : theme.palette.text.secondary,
                      px: 0.85,
                      py: 0.2,
                      borderRadius: 0.75,
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                    }}
                  >
                    {countdownText}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Card>
    </Stack>
  );
};

export default DashboardInsights;





