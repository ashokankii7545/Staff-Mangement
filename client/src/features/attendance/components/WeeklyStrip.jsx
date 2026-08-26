import { useAppQuery } from '../../../shared/hooks';

import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import dayjs from 'dayjs';
import { GET_WEEKLY_ATTENDANCE } from '../../../graphql/queries';
import { STATUS_COLORS } from '../../../shared/constants';

const WeeklyStrip = () => {
  const { data } = useAppQuery(GET_WEEKLY_ATTENDANCE);

  // Build 7-day array (last 7 days)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day');
    const dateStr = date.format('YYYY-MM-DD');
    const record = data?.weeklyAttendance?.find((r) => r.date === dateStr);
    days.push({
      date,
      dateStr,
      dayLabel: date.format('ddd'),
      dateLabel: date.format('DD'),
      status: record?.status || (date.isBefore(dayjs(), 'day') ? 'ABSENT' : null),
      hours: record?.totalHours,
    });
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          This Week
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="space-between">
          {days.map((day) => {
            const config = day.status ? STATUS_COLORS[day.status] : null;
            const isToday = day.date.isSame(dayjs(), 'day');
            return (
              <Tooltip
                key={day.dateStr}
                title={`${day.date.format('ddd, MMM DD')}${day.status ? ` — ${STATUS_COLORS[day.status]?.label}` : ''}${day.hours ? ` (${day.hours.toFixed(1)}h)` : ''}`}
              >
                <Stack alignItems="center" spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {day.dayLabel}
                  </Typography>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: config ? config.bg : isToday ? 'primary.light' : 'grey.100',
                      border: isToday ? '2px solid' : 'none',
                      borderColor: 'primary.main',
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={600}
                      sx={{ color: config ? config.color : 'text.secondary' }}
                    >
                      {day.dateLabel}
                    </Typography>
                  </Box>
                </Stack>
              </Tooltip>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default WeeklyStrip;

