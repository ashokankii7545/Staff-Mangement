import { useAppQuery, useAppMutation } from '../../../shared/hooks';
import React from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useSubscription } from '@apollo/client';
import { useNavigate } from 'react-router-dom';

import dayjs from 'dayjs';
import { GET_ALL_LEAVE_REQUESTS } from '../../../graphql/queries';
import { REVIEW_LEAVE_REQUEST } from '../../../graphql/mutations';
import { ON_LEAVE_REQUEST_ADDED, ON_LEAVE_REQUEST_UPDATED } from '../../../graphql/subscriptions';
import { useNotification } from '../../../shared/ui';

const PendingApprovalsCard = () => {
  const navigate = useNavigate();
  const notify = useNotification();

  const { data, loading, refetch } = useAppQuery(GET_ALL_LEAVE_REQUESTS, {
    variables: { status: 'PENDING' },
    fetchPolicy: 'cache-and-network',
    pollInterval: 10000,
  });

  useSubscription(ON_LEAVE_REQUEST_ADDED, {
    onData: () => refetch(),
  });

  useSubscription(ON_LEAVE_REQUEST_UPDATED, {
    onData: () => refetch(),
  });

  const [reviewLeave, { loading: reviewing }] = useAppMutation(REVIEW_LEAVE_REQUEST, {
    onCompleted: (_, { variables }) => {
      notify.show(
        `Leave request ${variables.status === 'APPROVED' ? 'approved' : 'rejected'}`,
        { variant: variables.status === 'APPROVED' ? 'success' : 'info' }
      );
      refetch();
    },
    onError: (err) => notify.error(err.message),
  });

  const pendingList = data?.allLeaveRequests || [];

  const handleAction = (id, status) => {
    reviewLeave({
      variables: {
        id,
        status,
        adminFeedback: status === 'APPROVED' ? 'Approved by Admin' : 'Declined by Admin',
      },
    });
  };

  if (loading && !data) {
    return (
      <Card sx={{ p: 2 }}>
        <Skeleton width="30%" height={20} />
        <Skeleton height={40} sx={{ mt: 1 }} />
      </Card>
    );
  }

  if (pendingList.length === 0) {
    return null;
  }

  return (
    <Card
      sx={{
        p: 2,
        bgcolor: 'warning.light',
        borderColor: 'warning.main',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <NotificationsNoneOutlinedIcon sx={{ color: 'warning.dark', fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ color: 'warning.dark', fontWeight: 600 }}>
            {pendingList.length} Pending Approval{pendingList.length > 1 ? 's' : ''}
          </Typography>
        </Stack>

        <Button
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
          onClick={() => navigate('/approvals')}
          sx={{
            color: 'primary.main',
            fontSize: '0.75rem',
            p: 0,
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          View queue
        </Button>
      </Stack>

      <Stack spacing={1}>
        {pendingList.slice(0, 2).map((req) => {
          const isSingle = req.startDate === req.endDate;
          const dateDisplay = isSingle
            ? dayjs(req.startDate).format('DD MMM YYYY')
            : `${dayjs(req.startDate).format('DD MMM')} – ${dayjs(req.endDate).format('DD MMM YYYY')}`;

          return (
            <Box
              key={req.id}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid', borderColor: 'warning.light',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 1.5,
              }}
            >
              {/* Employee */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 180 }}>
                <Avatar sx={{ bgcolor: 'action.selected', color: 'primary.main', width: 26, height: 26, fontSize: '0.75rem', fontWeight: 600 }}>
                  {req.user?.name?.charAt(0) || 'U'}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={500} sx={{ color: 'text.primary' }}>
                    {req.user?.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {req.user?.email || ''}
                  </Typography>
                </Box>
              </Stack>

              {/* Leave Info */}
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      bgcolor: 'action.selected',
                      color: 'primary.main',
                      px: 0.75,
                      py: 0.15,
                      borderRadius: 0.75,
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                    }}
                  >
                    {req.leaveType}
                  </Box>
                  <Typography variant="body2" fontWeight={500} sx={{ color: 'text.primary', fontSize: '0.8125rem' }}>
                    {dateDisplay}
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 340 }} noWrap>
                  "{req.reason || 'No remarks'}"
                </Typography>
              </Box>

              {/* Action Buttons */}
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={reviewing}
                  startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleAction(req.id, 'REJECTED')}
                  sx={{
                    borderColor: 'divider',
                    color: 'text.secondary',
                    py: 0.25,
                    px: 1,
                    fontSize: '0.75rem',
                    '&:hover': { bgcolor: 'error.light', borderColor: 'error.main', color: 'error.dark' },
                  }}
                >
                  Decline
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={reviewing}
                  startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
                  onClick={() => handleAction(req.id, 'APPROVED')}
                  sx={{
                    bgcolor: 'success.main',
                    color: 'background.paper',
                    py: 0.25,
                    px: 1.25,
                    fontSize: '0.75rem',
                    '&:hover': { bgcolor: 'success.dark' },
                  }}
                >
                  Approve
                </Button>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
};

export default PendingApprovalsCard;




