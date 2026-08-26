import React from 'react';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

/**
 * TableSkeleton – Loading placeholder that mimics a data table layout.
 *
 * Usage:
 *   <TableSkeleton rowCount={5} columnCount={4} />
 */

const TableSkeleton = ({ rowCount = 5, columnCount = 4 }) => {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      {/* Header row */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        {Array.from({ length: columnCount }).map((_, i) => (
          <Skeleton
            key={`h-${i}`}
            variant="text"
            width={`${100 / columnCount}%`}
            height={20}
          />
        ))}
      </Stack>

      {/* Data rows */}
      <Stack spacing={1.5}>
        {Array.from({ length: rowCount }).map((_, r) => (
          <Stack key={`r-${r}`} direction="row" spacing={2}>
            {Array.from({ length: columnCount }).map((_, c) => (
              <Skeleton
                key={`c-${c}`}
                variant="rectangular"
                width={`${100 / columnCount}%`}
                height={28}
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
};

export default TableSkeleton;


