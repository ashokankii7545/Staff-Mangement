import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';

/**
 * ChartCard – Standard wrapper for charts (Recharts, etc).
 * 
 * Provides consistent padding, headers, icons, and loading states.
 * 
 * Usage:
 *   <ChartCard title="Monthly Trend" icon={TrendingUpIcon}>
 *     <ResponsiveContainer>...</ResponsiveContainer>
 *   </ChartCard>
 */
const ChartCard = ({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  height = 300,
  contentSx = {},
  sx = {}
}) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2.5, ...contentSx }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {Icon && <Icon sx={{ color: 'primary.main', fontSize: 20 }} />}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} color="text.primary" sx={{ lineHeight: 1.2 }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
          {action && <Box>{action}</Box>}
        </Stack>
        
        <Box sx={{ width: '100%', height, position: 'relative', flexGrow: 1 }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ChartCard;


