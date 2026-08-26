import AppButton from '../../../shared/ui/AppButton';
import React, { useState, useEffect } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import AppChip from '../../../shared/ui/AppChip';
import LinearProgress from '@mui/material/LinearProgress';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { useClock } from '../../../shared/hooks/useClock';

dayjs.extend(duration);

const ClockWidget = ({ todayStatus, onClockIn, onClockOut, onRegularize }) => {
  const { formattedTime, formattedDate } = useClock();

  const hasClockedIn = !!todayStatus?.clockIn;
  const hasClockedOut = !!todayStatus?.clockOut;
  const isOnShift = hasClockedIn && !hasClockedOut;

  const clockInDate = hasClockedIn ? dayjs(todayStatus.clockIn.createdAt) : null;
  const clockOutDate = hasClockedOut ? dayjs(todayStatus.clockOut.createdAt) : null;

  // Active Live Elapsed Working Hours Stopwatch
  const [elapsedStr, setElapsedStr] = useState('00h 00m 00s');
  const [shiftProgress, setShiftProgress] = useState(0);

  useEffect(() => {
    if (!isOnShift || !clockInDate) {
      if (hasClockedOut && todayStatus?.totalHours) {
        const totalSec = Math.round(todayStatus.totalHours * 3600);
        const d = dayjs.duration(totalSec, 'seconds');
        setElapsedStr(
          `${String(Math.floor(d.asHours())).padStart(2, '0')}h ${String(d.minutes()).padStart(2, '0')}m ${String(d.seconds()).padStart(2, '0')}s`
        );
        setShiftProgress(Math.min(100, Math.round((todayStatus.totalHours / 9) * 100)));
      }
      return;
    }

    const updateTimer = () => {
      const now = dayjs();
      const diffSec = Math.max(0, now.diff(clockInDate, 'second'));
      const d = dayjs.duration(diffSec, 'seconds');
      const hours = Math.floor(d.asHours());
      const mins = d.minutes();
      const secs = d.seconds();

      setElapsedStr(
        `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
      );

      // Assuming standard 9 hour shift (32400 seconds)
      const progress = Math.min(100, Math.round((diffSec / 32400) * 100));
      setShiftProgress(progress);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOnShift, clockInDate, hasClockedOut, todayStatus]);

  return (
    <Card
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        border: '1px solid', borderColor: 'divider',
        height: '100%',
      }}
    >
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Biometric Punch Terminal
          </Typography>
          <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary' }}>
            Live Attendance Clock
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <AppChip
            icon={
              <FiberManualRecordIcon
                sx={{
                  fontSize: '8px !important',
                  color: 'inherit !important',
                }}
              />
            }
            label={hasClockedOut ? 'Shift Completed' : isOnShift ? 'Currently Working' : 'Punch Pending'}
            size="small"
            tone={isOnShift ? 'success' : hasClockedOut ? 'primary' : 'warning'}
            sx={{ fontSize: '0.75rem', height: 24 }}
          />

          {onRegularize && (
            <AppButton
              size="small"
              onClick={onRegularize}
              startIcon={<EditCalendarOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={{
                fontSize: '0.75rem',
                color: 'primary.main',
                bgcolor: 'action.selected',
                '&:hover': { bgcolor: 'action.focus' },
                borderRadius: 1.5,
                px: 1.25,
              }}
            >
              Regularize Punch
            </AppButton>
          )}
        </Stack>
      </Stack>

      {/* Main Clock Banner – gradient hero, theme-aware */}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          textAlign: 'center',
          mb: 2,
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          boxShadow: (theme) => `0 8px 24px ${theme.palette.primary.main}33`,
        }}
      >
        {/* Decorative depth circles */}
        <Box sx={{ position: 'absolute', top: -45, right: -45, width: 150, height: 150, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
        <Box sx={{ position: 'absolute', bottom: -55, left: -35, width: 130, height: 130, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            fontFeatureSettings: '"tnum"',
            letterSpacing: 2,
            mb: 0.5,
            color: '#fff',
            position: 'relative',
          }}
        >
          {formattedTime}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', position: 'relative' }}>
          {formattedDate}
        </Typography>
      </Box>

      {/* Shift Live Progress Bar (if on shift or completed) */}
      {(isOnShift || hasClockedOut) && (
        <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <TimerOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {isOnShift ? 'Active Working Stopwatch' : 'Total Shift Work Duration'}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700, fontFamily: 'monospace' }}>
              {elapsedStr}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={shiftProgress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'divider',
              '& .MuiLinearProgress-bar': {
                bgcolor: shiftProgress >= 100 ? 'success.main' : 'primary.main',
              },
            }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
              Shift Target: 9.0 hrs
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
              {shiftProgress}% Completed
            </Typography>
          </Stack>
        </Box>
      )}

      {/* Today's Punch Stats Breakdown */}
      <Stack
        direction="row"
        divider={<Divider orientation="vertical" flexItem sx={{ borderColor: 'divider' }} />}
        justifyContent="space-around"
        alignItems="center"
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'background.default',
          border: '1px solid', borderColor: 'divider',
          mb: 2.5,
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}>
            Clock In
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: clockInDate ? 'text.primary' : 'text.disabled', fontSize: '0.875rem' }}>
            {clockInDate ? clockInDate.format('hh:mm A') : '—'}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}>
            Clock Out
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: clockOutDate ? 'text.primary' : 'text.disabled', fontSize: '0.875rem' }}>
            {clockOutDate ? clockOutDate.format('hh:mm A') : '—'}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}>
            Shift Duration
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: todayStatus?.totalHours ? 'success.dark' : 'text.disabled', fontSize: '0.875rem' }}>
            {todayStatus?.totalHours ? `${todayStatus.totalHours.toFixed(1)} hrs` : isOnShift ? 'Counting...' : '0.0 hrs'}
          </Typography>
        </Box>
      </Stack>

      {/* Action Buttons */}
      <Stack direction="row" spacing={1.5} justifyContent="center">
        {!hasClockedIn && (
          <AppButton
            variant="contained"
            fullWidth
            size="large"
            onClick={onClockIn}
            startIcon={<LoginIcon />}
            sx={{
              bgcolor: 'success.main',
              color: 'background.paper',
              fontWeight: 600,
              py: 1.25,
              fontSize: '0.9375rem',
              '&:hover': { bgcolor: 'success.dark' },
            }}
          >
            Clock In (Selfie & GPS)
          </AppButton>
        )}

        {isOnShift && (
          <AppButton
            variant="contained"
            fullWidth
            size="large"
            onClick={onClockOut}
            startIcon={<LogoutIcon />}
            sx={{
              bgcolor: 'warning.main',
              color: 'background.paper',
              fontWeight: 600,
              py: 1.25,
              fontSize: '0.9375rem',
              '&:hover': { bgcolor: 'warning.dark' },
            }}
          >
            Clock Out (End Shift)
          </AppButton>
        )}

        {hasClockedOut && (
          <Box
            sx={{
              p: 1.25,
              width: '100%',
              borderRadius: 1.5,
              bgcolor: 'success.light',
              border: '1px solid',
              borderColor: 'success.light',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={600} sx={{ color: 'success.dark' }}>
              Today's shift attendance recorded successfully!
            </Typography>
          </Box>
        )}
      </Stack>
    </Card>
  );
};

export default ClockWidget;




