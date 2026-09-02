import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SecurityIcon from '@mui/icons-material/Security';
import FaceIcon from '@mui/icons-material/Face';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import SaveIcon from '@mui/icons-material/Save';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BoltIcon from '@mui/icons-material/Bolt';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import { GET_SETTINGS, GET_PUBLIC_CONFIG } from '../../graphql/queries';
import { UPDATE_SETTINGS } from '../../graphql/mutations';
import SendAnnouncementDialog from './components/SendAnnouncementDialog';
import { PageHeader, AppButton, useNotification } from '../../shared/ui';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';

const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// Punch identity options (kept in sync with server ATTENDANCE_METHODS).
const METHOD_OPTIONS = [
  {
    value: 'FACE',
    label: 'Face Selfie',
    icon: FaceIcon,
    caption: 'Camera selfie with server-side face match (current default).',
  },
  {
    value: 'FINGERPRINT',
    label: 'Fingerprint',
    icon: FingerprintIcon,
    caption: 'Phone fingerprint / Face ID via the device secure prompt.',
  },
  {
    value: 'BOTH',
    label: 'Both',
    icon: DoneAllIcon,
    caption: 'Staff picks face or fingerprint at punch time.',
  },
];

const DEFAULTS = {
  organizationName: 'EdgeAttendance',
  officeName: 'Head Office',
  officeLatitude: 28.6139,
  officeLongitude: 77.209,
  geofenceRadius: 200,
  shiftStartTime: '09:00',
  shiftEndTime: '18:00',
  lateThresholdMinutes: 15,
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  attendanceMethod: 'FACE',
  vpnStrictMode: false,
  autoApproveAttendance: true,
  mailFromName: 'EdgeAttendance Admin',
  mailFromAddress: '',
  regularizationAutoApproveDays: 0,
  emailNotifications: { userUpdates: true, broadcasts: true, adminAlerts: true },
  leavePolicy: { casualPerMonth: 1, sickAnnual: 6, earnedAnnual: 12 },
};

const SettingsPage = () => {
  const notify = useNotification();
  const { data, loading } = useAppQuery(GET_SETTINGS);
  const [form, setForm] = useState(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);

  // Hydrate the form once server settings arrive (never overwrite user edits).
  // Merge defensively so nested objects / arrays are never left undefined even
  // if a partial settings object comes back from the cache (e.g. after a
  // branding-only mutation that doesn't return every field).
  useEffect(() => {
    if (data?.settings && !hydrated) {
      const s = data.settings;
      setForm({
        ...DEFAULTS,
        ...s,
        workingDays: Array.isArray(s.workingDays) ? s.workingDays : DEFAULTS.workingDays,
        emailNotifications: { ...DEFAULTS.emailNotifications, ...(s.emailNotifications ?? {}) },
        leavePolicy: { ...DEFAULTS.leavePolicy, ...(s.leavePolicy ?? {}) },
      });
      setHydrated(true);
    }
  }, [data?.settings, hydrated]);

  const [updateSettings, { loading: saving }] = useAppMutation(UPDATE_SETTINGS, {
    successMessage: 'Settings saved successfully',
    onError: (err) => notify.error(err.message),
    // Refresh the public branding config (org name + logo) that the sidebar and
    // login page read, so the new value is in the cache immediately and does not
    // briefly flip back to the previously-cached value.
    refetchQueries: [{ query: GET_PUBLIC_CONFIG }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      // keep local state authoritative after save
      setHydrated(true);
    },
  });

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const saveShiftSettings = () => {
    updateSettings({
      variables: {
        input: {
          shiftStartTime: form.shiftStartTime,
          shiftEndTime: form.shiftEndTime,
          lateThresholdMinutes: Number(form.lateThresholdMinutes),
        },
      },
    });
  };

  const saveAutomationSettings = () => {
    updateSettings({
      variables: {
        input: {
          regularizationAutoApproveDays: Number(form.regularizationAutoApproveDays) || 0,
          autoApproveAttendance: !!form.autoApproveAttendance,
          leavePolicy: {
            casualPerMonth: Number(form.leavePolicy?.casualPerMonth) || 0,
            sickAnnual: Number(form.leavePolicy?.sickAnnual) || 0,
            earnedAnnual: Number(form.leavePolicy?.earnedAnnual) || 0,
          },
          emailNotifications: {
            userUpdates: !!form.emailNotifications?.userUpdates,
            broadcasts: !!form.emailNotifications?.broadcasts,
            adminAlerts: !!form.emailNotifications?.adminAlerts,
          },
        },
      },
    });
  };

  const savePolicySettings = () => {
    updateSettings({
      variables: {
        input: {
          workingDays: form.workingDays,
          vpnStrictMode: !!form.vpnStrictMode,
        },
      },
    });
  };

  const savePunchMethodSettings = () => {
    updateSettings({
      variables: {
        input: {
          attendanceMethod: form.attendanceMethod || 'FACE',
        },
      },
    });
  };

  const saveBrandingSettings = () => {
    updateSettings({
      variables: {
        input: {
          organizationName: form.organizationName?.trim() || 'EdgeAttendance',
          appLogoBase64: form.appLogoBase64 || undefined,
          mailFromName: form.mailFromName?.trim() || undefined,
          mailFromAddress: form.mailFromAddress?.trim() || '',
        },
      },
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      set({ appLogoBase64: reader.result, appLogoPreview: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const toggleDay = (day) => {
    set({
      workingDays: form.workingDays.includes(day)
        ? form.workingDays.filter((d) => d !== day)
        : [...form.workingDays, day],
    });
  };

  if (loading && !data) {
    return (
      <Stack spacing={3}>
        <PageHeader title="Global Settings" subtitle="Site location, shift timings and attendance policy" />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Global Settings"
        subtitle="Site location, shift timings and attendance policy"
        backButton="/"
      />

      {/* ── Shift Timing ── */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AccessTimeIcon color="primary" />
            <Typography variant="subtitle1">Shift Timing</Typography>
          </Stack>
          <Divider sx={{ my: 2 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="time"
              label="Shift Start"
              value={form.shiftStartTime}
              onChange={(e) => set({ shiftStartTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              type="time"
              label="Shift End"
              value={form.shiftEndTime}
              onChange={(e) => set({ shiftEndTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              type="number"
              label="Late After (min)"
              value={form.lateThresholdMinutes}
              onChange={(e) => set({ lateThresholdMinutes: e.target.value })}
              inputProps={{ min: 0, max: 240 }}
              helperText="Grace minutes after shift start"
              sx={{ width: { sm: 220 } }}
            />
          </Stack>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <AppButton
              variant="contained"
              startIcon={<SaveIcon fontSize="small" />}
              onClick={saveShiftSettings}
              loading={saving}
            >
              Save Shift
            </AppButton>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Attendance Policy ── */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1}>
            <SecurityIcon color="primary" />
            <Typography variant="subtitle1">Attendance Policy</Typography>
          </Stack>
          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={!!form.vpnStrictMode}
                onChange={(e) => set({ vpnStrictMode: e.target.checked })}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  VPN Strict Mode
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  OFF (recommended): suspected VPN punches are accepted but flagged for admin
                  review. ON: suspected VPN punches are blocked outright.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 3 }}
          />

          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
            <CalendarMonthIcon fontSize="small" color="primary" />
            <Typography variant="body2" fontWeight={600}>
              Working Days
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 1 }}>
            {WEEK_DAYS.map((day) => (
              <Chip
                key={day}
                label={day.slice(0, 3)}
                onClick={() => toggleDay(day)}
                color={form.workingDays?.includes(day) ? 'primary' : 'default'}
                variant={form.workingDays?.includes(day) ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Non-working days are excluded from absence expectations.
          </Typography>

          <Stack direction="row" justifyContent="flex-end">
            <AppButton
              variant="contained"
              startIcon={<SaveIcon fontSize="small" />}
              onClick={savePolicySettings}
              loading={saving}
            >
              Save Policy
            </AppButton>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Punch Verification Method (FACE / FINGERPRINT / BOTH) ── */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FingerprintIcon color="primary" />
            <Typography variant="subtitle1">Punch Verification Method</Typography>
          </Stack>
          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            How staff confirm their identity when clocking in/out. Switching to FINGERPRINT or BOTH
            automatically emails every staff member who has not registered a fingerprint yet.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {METHOD_OPTIONS.map((opt) => {
              const selected = (form.attendanceMethod || 'FACE') === opt.value;
              return (
                <Card
                  key={opt.value}
                  variant="outlined"
                  onClick={() => set({ attendanceMethod: opt.value })}
                  sx={{
                    flex: '1 1 0',
                    cursor: 'pointer',
                    borderRadius: 2,
                    borderWidth: 2,
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? 'action.selected' : 'background.paper',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <opt.icon
                        fontSize="small"
                        color={selected ? 'primary' : 'action'}
                      />
                      <Typography variant="body2" fontWeight={700}>
                        {opt.label}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {opt.caption}
                    </Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <AppButton
              variant="contained"
              startIcon={<SaveIcon fontSize="small" />}
              onClick={savePunchMethodSettings}
              loading={saving}
            >
              Save Method
            </AppButton>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Leave Policy ── */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <CalendarMonthIcon color="primary" />
            <Typography variant="subtitle1">Leave Policy</Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="number"
              label="Casual Leave / month"
              value={form.leavePolicy?.casualPerMonth ?? 1}
              onChange={(e) => set({ leavePolicy: { ...form.leavePolicy, casualPerMonth: e.target.value } })}
              inputProps={{ min: 0, max: 10 }}
              helperText="Credited to every active staff member monthly"
              fullWidth
            />
            <TextField
              type="number"
              label="Sick Leave / year (upfront)"
              value={form.leavePolicy?.sickAnnual ?? 6}
              onChange={(e) => set({ leavePolicy: { ...form.leavePolicy, sickAnnual: e.target.value } })}
              inputProps={{ min: 0, max: 60 }}
              helperText="Granted in full each January (use-it-or-lose-it)"
              fullWidth
            />
            <TextField
              type="number"
              label="Earned Leave / year"
              value={form.leavePolicy?.earnedAnnual ?? 12}
              onChange={(e) => set({ leavePolicy: { ...form.leavePolicy, earnedAnnual: e.target.value } })}
              inputProps={{ min: 0, max: 60 }}
              helperText="Credited annually – carries forward"
              fullWidth
            />
          </Stack>

          <Alert severity="info" sx={{ mt: 2 }}>
            Accrual runs automatically (monthly for CL · yearly for SL/EL). Admins can still fine-tune any
            individual's balance from Staff Management → Edit.
          </Alert>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <AppButton
              variant="contained"
              startIcon={<SaveIcon fontSize="small" />}
              onClick={saveAutomationSettings}
              loading={saving}
            >
              Save Leave Policy
            </AppButton>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Review Automation ── */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <BoltIcon color="primary" />
            <Typography variant="subtitle1">Review Automation</Typography>
          </Stack>

          <TextField
            type="number"
            label="Auto-approve regularizations after (days)"
            value={form.regularizationAutoApproveDays ?? 0}
            onChange={(e) => set({ regularizationAutoApproveDays: e.target.value })}
            inputProps={{ min: 0, max: 90 }}
            helperText="PENDING requests older than this many days are auto-APPROVED by a daily server sweep. 0 = disabled."
            sx={{ width: { xs: '100%', sm: 340 } }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={!!form.autoApproveAttendance}
                onChange={(e) => set({ autoApproveAttendance: e.target.checked })}
              />
            }
            label="Auto-approve clean punches"
            sx={{ mt: 1.5 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5, mb: 1 }}>
            A punch with verified face, valid geofence and no VPN/device flag is APPROVED automatically.
            Only anomalies (VPN, face mismatch) reach the approval queue. Turn OFF to review every punch manually.
          </Typography>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <AppButton
              variant="contained"
              startIcon={<SaveIcon fontSize="small" />}
              onClick={saveAutomationSettings}
              loading={saving}
            >
              Save Automation
            </AppButton>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Email Notifications ── */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <NotificationsActiveIcon color="primary" />
            <Typography variant="subtitle1">Email Notifications</Typography>
          </Stack>

          <Stack spacing={1}>
            {[
              ['userUpdates', 'Staff update mails', 'Leave / attendance / regularization decisions, welcome & profile mails'],
              ['broadcasts', 'Broadcast announcements', 'Admin announcements sent to every active staff member'],
              ['adminAlerts', 'Admin alert mails', 'Signup requests and site / holiday / settings change alerts'],
            ].map(([key, label, desc]) => (
              <FormControlLabel
                key={key}
                sx={{
                  ml: 0,
                  justifyContent: 'space-between',
                  px: 1.25,
                  py: 0.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                }}
                control={
                  <Switch
                    checked={!!form.emailNotifications?.[key]}
                    onChange={(e) =>
                      set({ emailNotifications: { ...form.emailNotifications, [key]: e.target.checked } })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="caption" color="text.secondary">{desc}</Typography>
                  </Box>
                }
                labelPlacement="start"
              />
            ))}
          </Stack>

          <Alert severity="info" sx={{ mt: 1.5 }}>
            Password-reset mails ALWAYS send – security flows can never be muted.
          </Alert>

          <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 2 }}>
            <AppButton
              variant="outlined"
              startIcon={<CampaignOutlinedIcon fontSize="small" />}
              onClick={() => setAnnounceOpen(true)}
            >
              Send Announcement
            </AppButton>
            <AppButton
              variant="contained"
              startIcon={<SaveIcon fontSize="small" />}
              onClick={saveAutomationSettings}
              loading={saving}
            >
              Save Email Preferences
            </AppButton>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Email & Branding ── */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <MailOutlineIcon color="primary" />
            <Typography variant="subtitle1">Email &amp; Branding</Typography>
          </Stack>

          <Alert severity="info" icon={<MailOutlineIcon fontSize="inherit" />} sx={{ mb: 2 }}>
            Every outgoing email – approvals, rejections, welcome mails, announcements – is sent
            from this identity and signed with this organization name.
            {form.mailFromAddress ? (
              <>
                {' '}Currently sending as <strong>{form.mailFromAddress}</strong>.
              </>
            ) : (
              ' Leave the address empty to use the SMTP account configured on the server.'
            )}
          </Alert>

          <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Avatar 
                  src={form.appLogoPreview || form.appLogo} 
                  sx={{ width: 64, height: 64, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                />
                <Button component="label" variant="outlined" size="small">
                  Upload App Logo
                  <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
                </Button>
              </Box>
            <TextField
              label="Organization Name"
              placeholder="e.g. EdgeAttendance"
              value={form.organizationName || ''}
              onChange={(e) => set({ organizationName: e.target.value })}
              helperText="Shown in the email header and footer signature"
              fullWidth
            />
            <TextField
              label="Sender Display Name"
              placeholder="e.g. EdgeAttendance Admin"
              value={form.mailFromName || ''}
              onChange={(e) => set({ mailFromName: e.target.value })}
              helperText='The "From" name staff see in their inbox'
              fullWidth
            />
            <TextField
              label="Sender Email Address"
              type="email"
              placeholder="e.g. admin@edgeattendance.com"
              value={form.mailFromAddress || ''}
              onChange={(e) => set({ mailFromAddress: e.target.value })}
              helperText="Empty = server's default SMTP account. Use a domain you own so emails avoid spam folders."
              fullWidth
            />
          </Stack>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <AppButton
              variant="contained"
              startIcon={<SaveIcon fontSize="small" />}
              onClick={saveBrandingSettings}
              loading={saving}
            >
              Save Email Identity
            </AppButton>
          </Stack>
        </CardContent>
      </Card>

      {/* Master org-wide announcement from Settings – one compose form reaches
          every staff member by email + in-app notification. */}
      <SendAnnouncementDialog
        open={announceOpen}
        onClose={() => setAnnounceOpen(false)}
      />
    </Stack>
  );
};

export default SettingsPage;



