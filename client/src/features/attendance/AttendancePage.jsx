import { useAppQuery } from '../../shared/hooks';
import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import dayjs from 'dayjs';
import ClockWidget from './components/ClockWidget';
import AttendanceDialog from './components/AttendanceDialog';
import { StatusBadge } from '../../shared/ui';
import { GET_TODAY_STATUS } from '../../graphql/queries';

const AttendancePage = () => {
  const { data } = useAppQuery(GET_TODAY_STATUS, { pollInterval: 10000 });
  const [dialog, setDialog] = useState({ open: false, type: 'CLOCK_IN' });
  const todayStatus = data?.todayStatus;

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Mark Attendance</Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <ClockWidget
            todayStatus={todayStatus}
            onClockIn={() => setDialog({ open: true, type: 'CLOCK_IN' })}
            onClockOut={() => setDialog({ open: true, type: 'CLOCK_OUT' })}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Today's Summary</Typography>
              <Stack spacing={2}>
                {todayStatus ? (
                  <>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Status</Typography>
                      <StatusBadge status={todayStatus.status} />
                    </Stack>
                    {todayStatus.clockIn && (
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LoginIcon color="success" fontSize="small" />
                          <Typography variant="body2" color="text.secondary">Clock In</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar
                            src={todayStatus.clockIn.selfieUrl}
                            sx={{ width: 28, height: 28 }}
                          />
                          <Typography variant="body2" fontWeight={500}>
                            {dayjs(!isNaN(Number(todayStatus.clockIn.createdAt)) ? Number(todayStatus.clockIn.createdAt) : todayStatus.clockIn.createdAt).format('hh:mm A')}
                          </Typography>
                        </Stack>
                      </Stack>
                    )}
                    {todayStatus.clockOut && (
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LogoutIcon color="warning" fontSize="small" />
                          <Typography variant="body2" color="text.secondary">Clock Out</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar
                            src={todayStatus.clockOut.selfieUrl}
                            sx={{ width: 28, height: 28 }}
                          />
                          <Typography variant="body2" fontWeight={500}>
                            {dayjs(!isNaN(Number(todayStatus.clockOut.createdAt)) ? Number(todayStatus.clockOut.createdAt) : todayStatus.clockOut.createdAt).format('hh:mm A')}
                          </Typography>
                        </Stack>
                      </Stack>
                    )}
                    {todayStatus.totalHours > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Total Hours</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {todayStatus.totalHours.toFixed(1)}h
                        </Typography>
                      </Stack>
                    )}
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <CameraAltIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No attendance marked yet today
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <AttendanceDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, type: 'CLOCK_IN' })}
        type={dialog.type}
      />
    </Stack>
  );
};

export default AttendancePage;

