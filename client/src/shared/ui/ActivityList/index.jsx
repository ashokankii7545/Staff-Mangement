import React from 'react';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import StatusBadge from '../StatusBadge';

/**
 * ActivityItem – A single item for activity feeds or lists.
 * 
 * Usage:
 *   <ActivityItem 
 *     title="John Doe" 
 *     subtitle="2 mins ago • Head Office"
 *     avatarLetter="J"
 *     avatarImg={url}
 *     status="PRESENT" 
 *   />
 */
export const ActivityItem = ({
  title,
  subtitle,
  avatarLetter,
  avatarImg,
  avatarBg = 'primary.light',
  avatarColor = 'primary.main',
  status,
  statusLabel,
  statusSuffix,
  customAction,
  sx
}) => {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5, ...sx }}>
      <Avatar
        src={avatarImg}
        sx={{
          width: 38,
          height: 38,
          bgcolor: avatarBg,
          color: avatarColor,
          fontWeight: 600,
          fontSize: '0.875rem',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        {avatarLetter || title?.charAt(0) || 'U'}
      </Avatar>
      
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
          <Typography variant="body2" fontWeight={500} color="text.primary" noWrap>
            {title}
          </Typography>
          
          {customAction ? (
            customAction
          ) : (
            status && <StatusBadge status={status} label={statusLabel} suffix={statusSuffix} />
          )}
        </Stack>
        
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
};

/**
 * ActivityList – A wrapper for multiple ActivityItems.
 */
export const ActivityList = ({ children, spacing = 2, sx }) => {
  return (
    <Stack spacing={spacing} sx={sx}>
      {children}
    </Stack>
  );
};


