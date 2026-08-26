import React from 'react';
import { Box, Typography, Slide } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useOnlineStatus } from '../hooks';

export const NetworkAlert = () => {
  const isOnline = useOnlineStatus();

  return (
    <Slide direction="down" in={!isOnline} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bgcolor: 'error.main',
          color: 'error.contrastText',
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          zIndex: 9999,
          boxShadow: 3,
        }}
      >
        <WifiOffIcon fontSize="small" />
        <Typography variant="body2" fontWeight={500}>
          You are currently offline. Some features may be unavailable.
        </Typography>
      </Box>
    </Slide>
  );
};

export default NetworkAlert;
