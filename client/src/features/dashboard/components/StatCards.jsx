import { useAppQuery } from '../../../shared/hooks';

import Grid from '@mui/material/Grid2';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CancelIcon from '@mui/icons-material/Cancel';
import { GET_DASHBOARD_STATS } from '../../../graphql/queries';
import { StatCard, CardSkeleton } from '../../../shared/ui';

const cards = [
  { key: 'totalStaff', label: 'Total Staff', icon: PeopleIcon, color: 'primary.main', bg: 'action.selected' },
  { key: 'presentToday', label: 'Present', icon: CheckCircleIcon, color: 'success.dark', bg: 'success.light' },
  { key: 'lateToday', label: 'Late', icon: WarningIcon, color: 'warning.dark', bg: 'warning.light' },
  { key: 'absentToday', label: 'Absent', icon: CancelIcon, color: 'error.dark', bg: 'error.light' },
];

const StatCards = () => {
  const { data, loading } = useAppQuery(GET_DASHBOARD_STATS, { pollInterval: 30000 });

  if (loading) {
    return <CardSkeleton count={4} columns={{ xs: 6, sm: 3 }} />;
  }

  return (
    <Grid container spacing={2}>
      {cards.map((card) => (
        <Grid key={card.key} size={{ xs: 6, sm: 3 }}>
          <StatCard
            label={card.label}
            value={data?.dashboardStats?.[card.key] ?? 0}
            icon={card.icon}
            color={card.color}
            bg={card.bg}
          />
        </Grid>
      ))}
    </Grid>
  );
};

export default StatCards;




