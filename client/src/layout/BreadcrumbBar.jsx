import React from 'react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useNavigate, useLocation } from 'react-router-dom';
import { getBreadcrumbTrail } from '../shared/constants';

/**
 * Breadcrumb strip rendered DIRECTLY BELOW the pinned Topbar (header).
 * Lives OUTSIDE the AppBar on purpose – crumbs belong under the header,
 * not inside it. Still part of the fixed chrome, so it never scrolls away.
 */
const BreadcrumbBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-derived trail – always valid because it is generated from
  // ROUTE_TITLES, never from hand-written hrefs (no dead /dashboard links).
  const trail = getBreadcrumbTrail(location.pathname);

  return (
    <Box
      sx={{
        flexShrink: 0,
        height: 40,
        px: { xs: 2, sm: 3 },
        py: 0,
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Breadcrumbs
        separator={<NavigateNextIcon sx={{ fontSize: 15 }} />}
        aria-label="breadcrumb"
        sx={{
          minWidth: 0,
          '& .MuiBreadcrumbs-li': { fontSize: '0.8125rem', minWidth: 0 },
        }}
      >
        <Link
          underline="hover"
          color="text.secondary"
          href="/"
          aria-label="Dashboard"
          onClick={(e) => { e.preventDefault(); navigate('/'); }}
          sx={{ display: 'inline-flex', alignItems: 'center' }}
        >
          <HomeOutlinedIcon sx={{ fontSize: 17 }} />
        </Link>
        {trail.map((crumb, idx) => {
          const isLast = idx === trail.length - 1;
          return isLast ? (
            <Typography
              key={crumb.href}
              sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap' }}
            >
              {crumb.label}
            </Typography>
          ) : (
            <Link
              key={crumb.href}
              underline="hover"
              color="text.secondary"
              href={crumb.href}
              onClick={(e) => { e.preventDefault(); navigate(crumb.href); }}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {crumb.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
};

export default BreadcrumbBar;
