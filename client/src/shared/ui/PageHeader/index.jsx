import React, { forwardRef, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

/**
 * PageHeader – Standardized page-level header.
 *
 * Provides title + optional subtitle + action slot (buttons, pickers etc.)
 * Responsive: stacks vertically on mobile, horizontal on desktop.
 *
 * Usage:
 *   <PageHeader title="Staff Management" subtitle="Manage employees" action={<AppButton>+ Add</AppButton>} />
 *   <PageHeader title="Attendance History" action={<DateRangePicker ... />} />
 */

const PageHeader = forwardRef(({
  title,
  subtitle,
  action,
  breadcrumbs,
  backButton = false,
  tabs,
  activeTab,
  onTabChange,
  icon: Icon,
  sx,
  ...rest
}, ref) => {
  const navigate = useNavigate();

  // Accepts `true` (history back) or a path string ("/dashboard")
  const handleBack = () => {
    if (typeof backButton === 'string') navigate(backButton);
    else navigate(-1);
  };

  return (
    <Box ref={ref} sx={{ mb: 2.5, ...sx }} {...rest}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs sx={{ mb: 1, '& .MuiBreadcrumbs-li': { fontSize: '0.875rem' } }}>
          {breadcrumbs.map((crumb, idx) => (
            idx === breadcrumbs.length - 1 ? (
              <Typography key={idx} variant="body2" color="text.primary">
                {crumb.label}
              </Typography>
            ) : (
              <Link
                key={idx}
                underline="hover"
                color="text.secondary"
                href={crumb.href}
                onClick={(e) => {
                  e.preventDefault();
                  if (crumb.href) navigate(crumb.href);
                }}
              >
                {crumb.label}
              </Link>
            )
          ))}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1.5}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {/* Disabled: backButton is redundant with global BreadcrumbBar */}
          {Icon && <Icon sx={{ color: 'text.secondary' }} />}
          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary' }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>

        {action && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
            {action}
          </Stack>
        )}
      </Stack>

      {tabs && tabs.length > 0 && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={onTabChange}
            aria-label="page header tabs"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            {tabs.map((tab, index) => {
              const value = tab.value !== undefined ? tab.value : index;
              const labelNode = tab.badge !== undefined ? (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  {tab.label}
                  {tab.badge}
                </Box>
              ) : (
                tab.label
              );
              return (
                <Tab
                  key={value}
                  value={value}
                  label={labelNode}
                  icon={tab.icon}
                  iconPosition={tab.iconPosition || 'start'}
                  disabled={tab.disabled}
                  sx={{ minHeight: 48, textTransform: 'none', fontWeight: tab.disabled ? 400 : 500 }}
                />
              );
            })}
          </Tabs>
        </Box>
      )}
    </Box>
  );
});

PageHeader.displayName = 'PageHeader';

PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  breadcrumbs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    href: PropTypes.string,
  })),
  /** `true` → navigate(-1); a path string like '/dashboard' → navigate(path) */
  backButton: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  tabs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.node.isRequired,
    value: PropTypes.any,
    icon: PropTypes.element,
    iconPosition: PropTypes.oneOf(['top', 'start', 'end', 'bottom']),
    badge: PropTypes.node,
    disabled: PropTypes.bool,
  })),
  activeTab: PropTypes.any,
  onTabChange: PropTypes.func,
  icon: PropTypes.elementType,
  sx: PropTypes.object,
};

export default memo(PageHeader);
