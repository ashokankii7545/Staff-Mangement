import AppButton from '../../../shared/ui/AppButton';
import React, { useState, useEffect } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import AppChip from '../../../shared/ui/AppChip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
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

const ClockWidget = ({ todayStatus, onClockIn, onClockOut, onRegularize, busy = false, statusLoading = false }) => {
  const { formattedTime, formattedDate } = useClock();

  // ── Multi-session state (Zoho People-style) ──
  // A user can clock in/out many times a day. The server tells us whether a
  // session is currently OPEN (clocked in, awaiting clock-out) and the summed
  // total of all COMPLETED sessions so far.
  const sessions = todayStatus?.sessions ?? [];
  const sessionCount = todayStatus?.sessionCount ?? sessions.length;
  const isOnShift = !!todayStatus?.hasOpenSession;
  const hasAnyPunch = sessionCount > 0 || !!todayStatus?.clockIn;
  // Completed working time recorded so far today (open session not yet counted).
  const completedHours = todayStatus?.totalHours ?? 0;

  // The open session's clock-in time drives the live stopwatch.
  const openSession = isOnShift ? sessions.find((s) => !s.clockOut) : null;
  const openSinceDate = openSession?.clockIn?.createdAt
    ? dayjs(openSession.clockIn.createdAt)
    : todayStatus?.clockIn?.createdAt
      ? dayjs(todayStatus.clockIn.createdAt)
      : null;

  // First clock-in / latest clock-out across all of today's sessions.
  const firstInDate = todayStatus?.clockIn?.createdAt ? dayjs(todayStatus.clockIn.createdAt) : null;
  const lastOutDate = todayStatus?.clockOut?.createdAt ? dayjs(todayStatus.clockOut.createdAt) : null;

  // Active Live Elapsed Working Hours Stopwatch
  const [elapsedStr, setElapsedStr] = useState('00h 00m 00s');
  const [shiftProgress, setShiftProgress] = useState(0);

  const fmt = (totalSec) => {
    const d = dayjs.duration(Math.max(0, totalSec), 'seconds');
    return `${String(Math.floor(d.asHours())).padStart(2, '0')}h ${String(d.minutes()).padStart(2, '0')}m ${String(d.seconds()).padStart(2, '0')}s`;
  };

  useEffect(() => {
    const completedSec = Math.round(completedHours * 3600);

    // Not currently on shift: show the summed completed time (static).
    if (!isOnShift || !openSinceDate) {
      setElapsedStr(fmt(completedSec));
      setShiftProgress(Math.min(100, Math.round((completedHours / 9) * 100)));
      return;
    }

    // On shift: live total = all completed sessions + time since this clock-in.
    const updateTimer = () => {
      const liveSec = completedSec + Math.max(0, dayjs().diff(openSinceDate, 'second'));
      setElapsedStr(fmt(liveSec));
      // Progress toward a standard 9h (32400s) day.
      setShiftProgress(Math.min(100, Math.round((liveSec / 32400) * 100)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOnShift, openSinceDate, completedHours]);

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
            label={isOnShift ? 'Currently Working' : hasAnyPunch ? 'On Break / Done' : 'Punch Pending'}
            size="small"
            tone={isOnShift ? 'success' : hasAnyPunch ? 'primary' : 'warning'}
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

      {/* Shift Live Progress Bar (if on shift or any completed session today) */}
      {(isOnShift || hasAnyPunch) && (
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
            First In
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: firstInDate ? 'text.primary' : 'text.disabled', fontSize: '0.875rem' }}>
            {firstInDate ? firstInDate.format('hh:mm A') : '—'}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}>
            {isOnShift ? 'Last Out' : 'Latest Out'}
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: lastOutDate ? 'text.primary' : 'text.disabled', fontSize: '0.875rem' }}>
            {lastOutDate ? lastOutDate.format('hh:mm A') : '—'}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}>
            Sessions
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: sessionCount ? 'text.primary' : 'text.disabled', fontSize: '0.875rem' }}>
            {sessionCount || 0}
          </Typography>
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 500 }}>
            Total Worked
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ color: completedHours ? 'success.dark' : 'text.disabled', fontSize: '0.875rem' }}>
            {completedHours ? `${completedHours.toFixed(1)} hrs` : isOnShift ? 'Counting...' : '0.0 hrs'}
          </Typography>
        </Box>
      </Stack>

      {/* Action Buttons – multi-session toggle.
          Not on shift → Clock In (works for the FIRST punch and every RE-entry
          after a clock-out). On shift → Clock Out. */}
      <Stack spacing={1.25} justifyContent="center">
        {/* While today's status is still loading we don't yet know whether the
            user is clocked in, so show a skeleton in place of the action button.
            This prevents clicking "Clock In" before the real state arrives (which
            could hit the server's "already clocked in" guard). The correct
            Clock In / Clock Out button renders once the response lands. */}
        {/* Show a skeleton in the button slot whenever we don't yet have a
            reliable status to act on: the initial status load, OR while a punch
            is in flight (busy) and we're waiting for the refreshed status. The
            correct Clock In / Clock Out button only renders once we're idle. */}
        {(statusLoading || busy) && (
          <Skeleton
            variant="rounded"
            width="100%"
            height={48}
            animation="wave"
            sx={{ borderRadius: 1 }}
          />
        )}

        {!statusLoading && !busy && !isOnShift && (
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
            {hasAnyPunch ? 'Clock In Again (Selfie & GPS)' : 'Clock In (Selfie & GPS)'}
          </AppButton>
        )}

        {!statusLoading && !busy && isOnShift && (
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
            Clock Out
          </AppButton>
        )}

        {!isOnShift && hasAnyPunch && (
          <Box
            sx={{
              p: 1,
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
            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} />
            <Typography variant="caption" fontWeight={600} sx={{ color: 'success.dark' }}>
              {sessionCount} session{sessionCount === 1 ? '' : 's'} today · {completedHours.toFixed(1)} hrs. You can clock in again anytime.
            </Typography>
          </Box>
        )}
      </Stack>
    </Card>
  );
};

export default ClockWidget;




