import { useAppQuery, useAppMutation } from '../../../shared/hooks';
import { useState, useMemo, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import { useSubscription } from '@apollo/client';
import { useNavigate } from 'react-router-dom';

import dayjs from 'dayjs';
import {
  GET_MY_NOTIFICATIONS,
  GET_UNREAD_NOTIFICATIONS_COUNT,
} from '../../../graphql/queries';
import {
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
  DELETE_NOTIFICATION,
  CLEAR_READ_NOTIFICATIONS,
} from '../../../graphql/mutations';
import { ON_NOTIFICATION_ADDED } from '../../../graphql/subscriptions';
import { useNotification, EmptyState } from '../../../shared/ui';

/** Visual identity per notification type */
const TYPE_CONFIG = {
  LEAVE_REQUEST:            { icon: HourglassTopIcon,       color: 'warning' },
  REGULARIZATION_REQUEST:   { icon: HourglassTopIcon,       color: 'warning' },
  SIGNUP_REQUEST:           { icon: PersonAddAlt1Icon,      color: 'primary' },
  MEDICINE_REQUEST:         { icon: InfoOutlinedIcon,       color: 'warning' },
  LEAVE_DECISION:           { icon: null /* set below */,   color: 'success' },
  REGULARIZATION_DECISION:  { icon: null,                   color: 'success' },
  ATTENDANCE_DECISION:      { icon: null,                   color: 'success' },
  MEDICINE_DECISION:        { icon: null,                   color: 'success' },
  ATTENDANCE_FLAGGED:       { icon: VpnLockIcon,            color: 'error' },
  ABSENT_ALERT:             { icon: PersonOffIcon,          color: 'error' },
  TEMP_DUTY:                { icon: SwapHorizIcon,          color: 'info' },
  DAY_OFF:                  { icon: EventAvailableIcon,     color: 'secondary' },
  ANNOUNCEMENT:             { icon: CampaignOutlinedIcon,   color: 'primary' },
  GENERIC:                  { icon: InfoOutlinedIcon,       color: 'default' },
};

const resolveIcon = (type, isPositive) => {
  if (TYPE_CONFIG[type]?.icon) return TYPE_CONFIG[type].icon;
  return isPositive ? CheckCircleOutlineIcon : HighlightOffIcon;
};

const resolveColor = (type, status) => {
  if (status === 'REJECTED') return 'error';
  return TYPE_CONFIG[type]?.color || 'default';
};

const NotificationCenter = () => {
  const navigate = useNavigate();
  const toast = useNotification();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // ── Inbox filter ──
  // 'unread' (default) = sirf fresh items; 'all' = poori history. Seen items
  // ab default view ko clutter nahi karte.
  const [filterMode, setFilterMode] = useState('unread');

  // Backend inbox – works for BOTH admins and staff (this was missing before,
  // which is why staff never received notifications)
  const { data, loading, refetch } = useAppQuery(GET_MY_NOTIFICATIONS, {
    variables: { limit: 50, unreadOnly: filterMode === 'unread' },
    fetchPolicy: 'cache-and-network',
    pollInterval: 60000, // safety net; realtime comes via subscription below
  });

  const switchFilter = (mode) => {
    setFilterMode(mode);
    refetch({ variables: { limit: 50, unreadOnly: mode === 'unread' } });
  };

  const { data: unreadData, refetch: refetchUnread } = useAppQuery(GET_UNREAD_NOTIFICATIONS_COUNT);

  // Local list mirrors the query cache so we can prepend realtime items
  const [liveItems, setLiveItems] = useState([]);
  const seenIds = useRef(new Set());

  useEffect(() => {
    const serverItems = data?.myNotifications || [];
    const next = new Set(serverItems.map((n) => n.id));
    seenIds.current = next;
    // drop live items that the server now knows about (dedupe)
    setLiveItems((prev) => prev.filter((n) => !next.has(n.id)));
  }, [data?.myNotifications]);

  // ⚡️ REAL-TIME: instant push for THIS user only (server-filtered WS) ⚡️⚡️⚡️
  useSubscription(ON_NOTIFICATION_ADDED, {
    onData: ({ client, data: subData }) => {
      const incoming = subData?.data?.notificationAdded;
      if (!incoming || seenIds.current.has(incoming.id)) return;
      seenIds.current.add(incoming.id);
      
      setLiveItems((prev) => [incoming, ...prev].slice(0, 50));
      toast.info(incoming.title, { autoHideDuration: 4500 });
      refetchUnread();
      
      // Instantly refresh whatever page the user is currently looking at!
      client.refetchQueries({ include: 'active' });
    },
    onError: () => {}, // WS hiccups fall back to polling silently
  });

  const [markRead] = useAppMutation(MARK_NOTIFICATION_READ, {
    onCompleted: () => refetchUnread(),
  });
  const [markAllRead] = useAppMutation(MARK_ALL_NOTIFICATIONS_READ, {
    successMessage: 'All notifications marked as read',
    onCompleted: () => {
      refetch();
      refetchUnread();
    },
  });
  const [deleteNotification] = useAppMutation(DELETE_NOTIFICATION, {
    onCompleted: () => {
      refetch();
      refetchUnread();
    },
  });

  // Purge every already-seen notification – one tap inbox hygiene
  const [clearRead] = useAppMutation(CLEAR_READ_NOTIFICATIONS, {
    successMessage: 'Seen notifications cleared',
    onCompleted: () => {
      refetch();
      refetchUnread();
    },
  });

  const serverItems = data?.myNotifications || [];
  const notifications = useMemo(() => {
    const merged = [...liveItems, ...serverItems];
    return filterMode === 'unread' ? merged.filter((n) => !n.isRead) : merged;
  }, [liveItems, serverItems, filterMode]);

  const readCount = [...liveItems, ...serverItems].filter((n) => n.isRead).length;

  const unreadCount = (unreadData?.unreadNotificationsCount || 0) > (data?.myNotifications?.filter((n) => !n.isRead).length || 0)
    ? (unreadData?.unreadNotificationsCount || 0)
    : (data?.myNotifications?.filter((n) => !n.isRead).length || 0) + liveItems.filter((n) => !n.isRead).length;

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleItemClick = (item) => {
    if (!item.isRead) markRead({ variables: { id: item.id } });
    // ALWAYS close the popover, then land the user on the exact page the
    // notification belongs to (deep links come from the server payload).
    handleClose();
    navigate(item.link || '/');
  };

  return (
    <>
      <Tooltip title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}>
        <IconButton
          onClick={handleClick}
          size="small"
          sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsNoneOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        slotProps={{
          paper: {
            sx: { width: 380, maxHeight: 520, display: 'flex', flexDirection: 'column', borderRadius: 2.5, mt: 1.25 },
          },
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" fontWeight={600}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip label={`${unreadCount} new`} color="primary" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
            )}
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {/* Inbox filter – Unread by default, All for history */}
            <Chip
              size="small"
              label="Unread"
              onClick={() => switchFilter('unread')}
              color={filterMode === 'unread' ? 'primary' : 'default'}
              variant={filterMode === 'unread' ? 'filled' : 'outlined'}
              sx={{ height: 24 }}
            />
            <Chip
              size="small"
              label="All"
              onClick={() => switchFilter('all')}
              color={filterMode === 'all' ? 'primary' : 'default'}
              variant={filterMode === 'all' ? 'filled' : 'outlined'}
              sx={{ height: 24 }}
            />
            <Tooltip title="Mark all as read">
              <span>
                <IconButton
                  size="small"
                  onClick={() => markAllRead()}
                  disabled={unreadCount === 0}
                  sx={{ color: unreadCount > 0 ? 'primary.main' : 'text.disabled' }}
                >
                  <DoneAllIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Clear seen notifications">
              <span>
                <IconButton
                  size="small"
                  onClick={() => clearRead()}
                  disabled={readCount === 0}
                  sx={{ color: readCount > 0 ? 'error.main' : 'text.disabled' }}
                >
                  <DeleteSweepOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {loading && notifications.length === 0 && (
            <Box role="status" aria-busy="true" aria-live="polite">
              {[1, 2, 3].map((i) => (
                <Box key={i} sx={{ px: 2.5, py: 2 }}>
                  <Box sx={{ height: 42, borderRadius: 2, bgcolor: 'action.hover', animation: 'pulse 1.4s ease-in-out infinite' }} />
                </Box>
              ))}
            </Box>
          )}

          {!loading && notifications.length === 0 && (
            <EmptyState variant="empty" compact title="All caught up!" description="You have no notifications yet." />
          )}

          {notifications.map((item) => {
            const isPositive = item.type.endsWith('_DECISION');
            const IconComp = resolveIcon(item.type, isPositive);
            const colorKey = resolveColor(item.type, item.title);
            const palette = {
              primary: 'primary', success: 'success', error: 'error',
              warning: 'warning', info: 'info', secondary: 'secondary', default: 'default',
            };
            const bg = colorKey === 'default' ? 'action.hover' : `${palette[colorKey]}.light`;
            const fg = colorKey === 'default' ? 'text.secondary' : `${colorKey}.dark`;

            return (
              <Box
                key={item.id}
                onClick={() => handleItemClick(item)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                  bgcolor: item.isRead ? 'transparent' : 'action.selected',
                  borderLeft: (theme) => `3px solid ${item.isRead ? 'transparent' : theme.palette.primary.main}`,
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:not(:last-child)': { borderBottom: 1, borderColor: 'divider' },
                  groupDelete: true,
                  '& .delete-btn': { opacity: 0 },
                  '&:hover .delete-btn': { opacity: 1 },
                }}
              >
                <Avatar sx={{ bgcolor: bg, color: fg, width: 34, height: 34 }}>
                  <IconComp sx={{ fontSize: 18 }} />
                </Avatar>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={item.isRead ? 500 : 700} noWrap>
                    {item.title}
                  </Typography>
                  {item.message && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.message}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                    {dayjs(item.createdAt).format('DD MMM, HH:mm')}
                  </Typography>
                </Box>

                {!item.isRead && (
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mt: 1 }} />
                )}

                <IconButton
                  className="delete-btn"
                  size="small"
                  aria-label="Delete notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification({ variables: { id: item.id } });
                  }}
                  sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, mt: -0.5, mr: -0.5 }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
};

export default NotificationCenter;

