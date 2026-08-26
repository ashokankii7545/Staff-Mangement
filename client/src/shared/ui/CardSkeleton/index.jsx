import React from 'react';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Grid from '@mui/material/Grid2';

/**
 * CardSkeleton – Loading placeholder for StatCard grids.
 *
 * Usage:
 *   <CardSkeleton count={4} />
 */

const CardSkeleton = ({ count = 4 }) => {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2, borderRadius: 2 }}>
            <Skeleton width="40%" height={16} />
            <Skeleton width="55%" height={32} sx={{ my: 1 }} />
            <Skeleton width="75%" height={14} />
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default CardSkeleton;


