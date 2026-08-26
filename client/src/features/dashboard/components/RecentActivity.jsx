import { useAppQuery } from '../../../shared/hooks';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { GET_RECENT_ACTIVITY } from '../../../graphql/queries';
import { ActivityList, ActivityItem, DataListSkeleton, EmptyState, StatusBadge } from '../../../shared/ui';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

dayjs.extend(relativeTime);

const RecentActivity = () => {
  const { data, loading } = useAppQuery(GET_RECENT_ACTIVITY, {
    variables: { limit: 8 },
    pollInterval: 15000,
  });

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Recent Activity</Typography>
        
        {loading ? (
          <DataListSkeleton count={4} />
        ) : data?.recentActivity?.length ? (
          <ActivityList spacing={2}>
            {data.recentActivity.map((activity) => (
              <ActivityItem 
                key={activity.id}
                title={activity.user?.name}
                subtitle={`${dayjs(Number(activity.createdAt)).fromNow()}${activity.location?.address ? ` • ${activity.location.address}` : ''}`}
                avatarImg={activity.selfieUrl}
                customAction={
                  <StatusBadge 
                    status={activity.type === 'CLOCK_IN' ? 'PRESENT' : 'LATE'} // reusing color map
                    label={activity.type === 'CLOCK_IN' ? 'In' : 'Out'}
                  />
                }
              />
            ))}
          </ActivityList>
        ) : (
          <EmptyState 
            icon={HistoryOutlinedIcon} 
            title="No activity yet"
            message="There are no recent punches today."
            compact
          />
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;

