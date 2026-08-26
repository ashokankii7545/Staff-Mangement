import React from 'react';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

/**
 * DataListSkeleton – Loading skeleton for vertical lists (like Recent Activity, Notifications).
 * 
 * Usage:
 *   <DataListSkeleton count={4} />
 */
const DataListSkeleton = ({ count = 4, spacing = 2 }) => {
  return (
    <Stack spacing={spacing}>
      {Array.from({ length: count }).map((_, i) => (
        <Stack key={i} direction="row" spacing={1.5} alignItems="center">
          <Skeleton variant="circular" width={38} height={38} />
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Skeleton width="40%" height={20} />
              <Skeleton width="15%" height={20} />
            </Stack>
            <Skeleton width="60%" height={16} sx={{ mt: 0.5 }} />
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};

export default DataListSkeleton;


