import React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/**
 * DetailItem – Standardized key-value pair display for forms, profiles, and settings.
 * 
 * Usage:
 *   <DetailItem label="Full Name" value="John Doe" />
 *   <DetailItem label="Status" value={<StatusBadge status="PRESENT" />} />
 */
const DetailItem = ({
  label,
  value,
  icon: Icon,
  direction = 'row',
  labelWidth = 140,
  sx
}) => {
  return (
    <Stack
      direction={direction}
      spacing={direction === 'row' ? 2 : 0.5}
      alignItems={direction === 'row' ? 'flex-start' : 'stretch'}
      sx={{ py: direction === 'row' ? 1.5 : 1, ...sx }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ minWidth: direction === 'row' ? labelWidth : 'auto' }}
      >
        {Icon && <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />}
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {label}
        </Typography>
      </Stack>
      
      <Box sx={{ flexGrow: 1 }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Typography variant="body2" color="text.primary" fontWeight={500}>
            {value}
          </Typography>
        ) : (
          value
        )}
      </Box>
    </Stack>
  );
};

export default DetailItem;


