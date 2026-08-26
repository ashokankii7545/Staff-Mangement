import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import LockIcon from '@mui/icons-material/Lock';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import HistoryIcon from '@mui/icons-material/History';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EventIcon from '@mui/icons-material/Event';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SettingsIcon from '@mui/icons-material/Settings';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import { PAGE_CATALOG } from '../../../shared/constants';

const ICONS = {
  Dashboard: DashboardIcon,
  CameraAlt: CameraAltIcon,
  History: HistoryIcon,
  EventNote: EventNoteIcon,
  LocalPharmacy: LocalPharmacyIcon,
  AdminPanelSettings: AdminPanelSettingsIcon,
  People: PeopleIcon,
  LocationOn: LocationOnIcon,
  Event: EventIcon,
  FactCheck: FactCheckIcon,
  Settings: SettingsIcon,
};

/**
 * PageAccessMatrix – per-account page visibility control for admins.
 *   Switch ON  → page open (default state for every page)
 *   Switch OFF → page WITHDRAWN (route key stored in user.restrictedPages;
 *                sidebar hides it, direct URLs land on the 403 screen)
 * Dashboard stays locked-ON: it is the app's home fallback, so no one can
 * ever lock themselves out of the application.
 *
 * Wired into GenericFormEngine as a `custom` field inside Edit Staff.
 */
const PageAccessMatrix = ({ value, onChange }) => {
  const restricted = Array.isArray(value) ? value : [];

  const toggle = (key, granted) => {
    const next = granted
      ? restricted.filter((k) => k !== key)
      : [...restricted, key];
    onChange(next);
  };

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        Page Access
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        Every page is OPEN by default. Switch a row OFF to withdraw it for this account.
      </Typography>

      <Stack spacing={0.5}>
        {PAGE_CATALOG.map(({ key, label, icon, locked }) => {
          const Icon = ICONS[icon] || DashboardIcon;
          const granted = locked || !restricted.includes(key);
          const switchControl = (
            <Switch
              size="small"
              checked={granted}
              disabled={locked}
              onChange={(e) => toggle(key, e.target.checked)}
              aria-label={`Toggle ${label}`}
            />
          );
          return (
            <Stack
              key={key}
              direction="row"
              alignItems="center"
              spacing={1.25}
              sx={{
                px: 1.25,
                py: 0.25,
                borderRadius: 1.5,
                bgcolor: granted ? 'action.hover' : 'transparent',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {Icon && (
                <Icon
                  fontSize="small"
                  sx={{ color: granted ? 'primary.main' : 'text.disabled', flexShrink: 0 }}
                />
              )}
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  color: granted ? 'text.primary' : 'text.secondary',
                  textDecorationLine: granted ? 'none' : 'line-through',
                }}
              >
                {label}
              </Typography>
              {locked ? (
                <Tooltip title="Dashboard stays available for everyone">
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <LockIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    {switchControl}
                  </Stack>
                </Tooltip>
              ) : (
                switchControl
              )}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};

export default PageAccessMatrix;
