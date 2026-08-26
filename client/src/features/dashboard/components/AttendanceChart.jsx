import { useAppQuery } from '../../../shared/hooks';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { GET_MONTHLY_TREND } from '../../../graphql/queries';
import { ChartCard } from '../../../shared/ui';

const AttendanceChart = () => {
  const theme = useTheme();
  const now = dayjs();
  const { data, loading } = useAppQuery(GET_MONTHLY_TREND, {
    variables: { month: now.month() + 1, year: now.year() },
  });

  const chartData = (data?.monthlyTrend || []).map((d) => ({
    date: dayjs(d.date).format('DD'),
    Present: d.presentCount,
    Late: d.lateCount,
    Absent: d.absentCount,
  }));

  return (
    <ChartCard 
      title="Attendance Trend" 
      subtitle={now.format('MMMM YYYY')}
      height={300}
    >
      {loading ? (
        <Skeleton variant="rounded" width="100%" height="100%" />
      ) : (
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
            <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: theme.palette.text.disabled }} />
            <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: theme.palette.text.disabled }} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,

                fontSize: '0.75rem',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
            <Bar dataKey="Present" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Late" fill={theme.palette.warning.main} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Absent" fill={theme.palette.error.main} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};

export default AttendanceChart;
