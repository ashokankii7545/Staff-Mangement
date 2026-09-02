import { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import Grid from '@mui/material/Grid2';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ApartmentIcon from '@mui/icons-material/Apartment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DescriptionIcon from '@mui/icons-material/Description';
import AddCommentIcon from '@mui/icons-material/AddComment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import LockPersonIcon from '@mui/icons-material/LockPerson';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import CircleIcon from '@mui/icons-material/Circle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import Chip from '@mui/material/Chip';

import dayjs from 'dayjs';

import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { useAuth } from '../../shared/auth/AuthContext';
import {
  GET_STAFF_PROFILE,
  GET_MY_PROFILE,
  GET_USER_DOCUMENTS,
  GET_OFFICES,
  GET_MY_DOCUMENTS,
  GET_MY_NOTIFICATIONS,
} from '../../graphql/queries';
import {
  UPDATE_USER,
  UPDATE_SALARY,
  UPDATE_BONUS,
  REQUEST_DOCUMENT,
  UPLOAD_DOCUMENT,
  DELETE_MY_DOCUMENT,
} from '../../graphql/mutations';
import {
  AppButton,
  GenericDialog,
  ConfirmDialog,
  DetailItem,
  StatusBadge,
  EmptyState,
  useNotification,
} from '../../shared/ui';
import { useFingerprint } from '../../shared/hooks/useFingerprint';
import PageAccessMatrix from '../admin/components/PageAccessMatrix';

// ── Tab metadata. `self` flags which tabs a staff member sees in self-view. ──
const ALL_TABS = [
  { value: 'overview', label: 'Overview', icon: PersonOutlineIcon, self: true },
  { value: 'site', label: 'Site & Shift', icon: PlaceOutlinedIcon, self: true },
  { value: 'leaves', label: 'Leaves', icon: EventAvailableIcon, self: true },
  { value: 'salary', label: 'Salary', icon: PaymentsOutlinedIcon, self: true },
  { value: 'bonus', label: 'Bonus', icon: CardGiftcardIcon, self: true },
  { value: 'access', label: 'Page Access', icon: LockPersonIcon, self: false },
  { value: 'notifications', label: 'Notifications', icon: NotificationsNoneIcon, self: true, adminHidden: true },
];

const CURRENCY_OPTS = [
  { value: 'INR', label: 'INR ₹' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
];
const FREQUENCY_OPTS = [
  { value: 'ONE_TIME', label: 'One-time' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];
const ROLE_OPTS = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'ADMIN', label: 'Admin' },
];
const DOC_CATEGORY_OPTS = [
  { value: 'ID_PROOF', label: 'ID Proof' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'OTHER', label: 'Other' },
];
const CATEGORY_LABEL = { ID_PROOF: 'ID Proof', CERTIFICATE: 'Certificate', OTHER: 'Other' };
const isImage = (url) => /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(url || '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ONE renderer for view + edit (DRY). View = shared DetailItem, edit = TextField. */
const SmartField = ({ label, value, editing, onChange, type = 'text', options, error, helperText, disabled, format, ...rest }) => {
  if (!editing) {
    let display = value;
    if (options) display = options.find((o) => o.value === value)?.label ?? value;
    else if (type === 'date' && value) display = dayjs(value).format('DD MMM YYYY');
    else if (format && value !== '' && value != null) display = format(value);
    const shown = display === '' || display == null ? '—' : String(display);
    return <DetailItem direction="column" label={label} value={shown} />;
  }
  // Numbers: block negatives + surface a numeric keypad on mobile.
  const numberProps = type === 'number' ? { inputProps: { min: 0, inputMode: 'numeric' } } : {};
  return (
    <TextField
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      type={options ? undefined : type}
      select={!!options}
      fullWidth
      size="small"
      error={!!error}
      helperText={error || helperText}
      disabled={disabled}
      InputLabelProps={type === 'time' || type === 'date' ? { shrink: true } : undefined}
      {...numberProps}
      {...rest}
    >
      {options?.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
};
SmartField.propTypes = {
  label: PropTypes.string,
  value: PropTypes.any,
  editing: PropTypes.bool,
  onChange: PropTypes.func,
  type: PropTypes.string,
  options: PropTypes.array,
  error: PropTypes.string,
  helperText: PropTypes.string,
  disabled: PropTypes.bool,
  format: PropTypes.func,
};

// Currency formatter for salary/bonus view mode (readability).
const CURRENCY_SYMBOL = { INR: '₹', USD: '$', EUR: '€' };
const money = (currency) => (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return `${CURRENCY_SYMBOL[currency] || ''}${n.toLocaleString('en-IN')}`;
};

const SectionCard = ({ title, action, children }) => (
  <Card variant="outlined" sx={{ borderRadius: 2 }}>
    <CardContent>
      {(title || action) && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          {title && <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>}
          {action}
        </Stack>
      )}
      {children}
    </CardContent>
  </Card>
);
SectionCard.propTypes = { title: PropTypes.string, action: PropTypes.node, children: PropTypes.node };

const blankForm = (user) => ({
  name: user.name ?? '',
  email: user.email ?? '',
  role: user.role ?? 'STAFF',
  officeId: user.assignedOffice?.id ?? '',
  shiftStartTime: user.shiftStartTime ?? '',
  shiftEndTime: user.shiftEndTime ?? '',
  casual: user.leaveBalances?.casual ?? 0,
  sick: user.leaveBalances?.sick ?? 0,
  earned: user.leaveBalances?.earned ?? 0,
  restrictedPages: Array.isArray(user.restrictedPages) ? user.restrictedPages : [],
  salary: {
    ctc: user.salary?.ctc ?? '',
    basic: user.salary?.basic ?? '',
    hra: user.salary?.hra ?? '',
    allowances: user.salary?.allowances ?? '',
    deductions: user.salary?.deductions ?? '',
    currency: user.salary?.currency ?? 'INR',
    effectiveFrom: user.salary?.effectiveFrom ? dayjs(user.salary.effectiveFrom).format('YYYY-MM-DD') : '',
  },
  bonus: {
    amount: user.bonus?.amount ?? '',
    reason: user.bonus?.reason ?? '',
    frequency: user.bonus?.frequency ?? 'ONE_TIME',
    payoutDate: user.bonus?.payoutDate ? dayjs(user.bonus.payoutDate).format('YYYY-MM-DD') : '',
  },
});

/**
 * ProfileDialog – generic full-screen user profile, shared by admin + staff.
 *  mode="admin" (default): admin edits any staff.
 *  mode="self": staff views their own profile (read-only) + can upload
 *  requested documents and see their notifications.
 */
const ProfileDialog = ({ open, staffId, onClose, onChanged, mode = 'admin' }) => {
  const notify = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user: authUser } = useAuth();
  const isSelfMode = mode === 'self';

  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [askDocOpen, setAskDocOpen] = useState(false);
  const [askDocTitle, setAskDocTitle] = useState('');
  const [askDocNote, setAskDocNote] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmRole, setConfirmRole] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', category: 'ID_PROOF', fileBase64: '' });
  const [deleteDoc, setDeleteDoc] = useState(null); // pending doc-delete confirmation

  // Admin loads any staff via user(id); staff loads their own via me.
  const adminProfile = useAppQuery(GET_STAFF_PROFILE, {
    variables: { id: staffId },
    skip: !staffId || !open || isSelfMode,
    fetchPolicy: 'cache-and-network',
  });
  const selfProfile = useAppQuery(GET_MY_PROFILE, {
    skip: !open || !isSelfMode,
    fetchPolicy: 'cache-and-network',
  });
  const data = isSelfMode ? { user: selfProfile.data?.me } : adminProfile.data;
  const loading = isSelfMode ? selfProfile.loading : adminProfile.loading;
  const refetch = isSelfMode ? selfProfile.refetch : adminProfile.refetch;

  const { data: officeData } = useAppQuery(GET_OFFICES, { skip: !open || isSelfMode });

  // Documents: admin reads the target user's docs; staff reads their own.
  const adminDocs = useAppQuery(GET_USER_DOCUMENTS, {
    variables: { userId: staffId },
    skip: !staffId || !open || isSelfMode,
    fetchPolicy: 'cache-and-network',
  });
  const selfDocs = useAppQuery(GET_MY_DOCUMENTS, {
    skip: !open || !isSelfMode,
    fetchPolicy: 'cache-and-network',
  });
  const documents = isSelfMode ? selfDocs.data?.myDocuments || [] : adminDocs.data?.userDocuments || [];
  const refetchDocs = isSelfMode ? selfDocs.refetch : adminDocs.refetch;

  // Notifications (self-view only).
  const notifQuery = useAppQuery(GET_MY_NOTIFICATIONS, {
    variables: { limit: 50 },
    skip: !open || !isSelfMode,
    fetchPolicy: 'cache-and-network',
  });
  const notifications = notifQuery.data?.myNotifications || [];

  // ── Device fingerprint (passkey) management — self view only ──
  // The biometric itself never leaves the device; only a public-key credential
  // is stored server-side. Staff register their own phone/laptop here.
  const {
    registerFingerprint,
    removeFingerprint,
    browserSupported: fpSupported,
    busy: fpBusy,
    errorMessage: fpError,
    clearError: clearFpError,
  } = useFingerprint();
  const [fpDeleteTarget, setFpDeleteTarget] = useState(null);
  const passkeys = useMemo(
    () => (isSelfMode ? selfProfile.data?.me?.passkeys : adminProfile.data?.user?.passkeys) || [],
    [isSelfMode, selfProfile.data, adminProfile.data],
  );

  useEffect(() => {
    if (fpError) {
      notify.error(fpError);
      clearFpError();
    }
  }, [fpError, notify.error, clearFpError]);

  const handleRegisterFingerprint = useCallback(async () => {
    const result = await registerFingerprint();
    if (result?.success) {
      notify.success(result.message || 'Fingerprint registered successfully!');
      refetch?.();
    }
  }, [registerFingerprint, notify.success, refetch]);

  const handleRemoveFingerprint = useCallback(async () => {
    const credentialId = fpDeleteTarget;
    setFpDeleteTarget(null);
    if (!credentialId) return;
    const result = await removeFingerprint(credentialId);
    if (result?.success) {
      notify.success(result.message || 'Fingerprint removed.');
      refetch?.();
    }
  }, [fpDeleteTarget, removeFingerprint, notify.success, refetch]);

  const user = data?.user;
  const officeOptions = useMemo(() => {
    const base = [
      { value: '', label: 'Default / Head Office' },
      ...(officeData?.offices || []).map((o) => ({ value: o.id, label: o.name })),
    ];
    // Self-view can't list offices; ensure the user's own office label resolves.
    if (user?.assignedOffice && !base.some((o) => o.value === user.assignedOffice.id)) {
      base.push({ value: user.assignedOffice.id, label: user.assignedOffice.name });
    }
    return base;
  }, [officeData, user]);

  const tabs = useMemo(
    () => ALL_TABS.filter((t) => (isSelfMode ? t.self : !t.adminHidden)),
    [isSelfMode],
  );

  const isSelfAccount = !!authUser && !!user && String(authUser.id) === String(user.id);
  // Editing is admin-only, and never for one's own role/access.
  const canEdit = !isSelfMode;

  useEffect(() => {
    if (user) {
      const next = blankForm(user);
      setForm(next);
      setBaseline(next);
    }
  }, [user]);

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setTab('overview');
      setConfirmClose(false);
      setPhotoOpen(false);
    }
  }, [open]);

  // Keep the active tab valid if the tab set changes (mode switch).
  useEffect(() => {
    if (!tabs.some((t) => t.value === tab)) setTab('overview');
  }, [tabs, tab]);

  const dirty = useMemo(
    () => !!form && !!baseline && JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const emailError = useMemo(() => {
    if (!editing || !form) return '';
    if (!form.email.trim()) return 'Email is required';
    if (!EMAIL_RE.test(form.email.trim())) return 'Enter a valid email';
    return '';
  }, [editing, form]);

  const nameError = useMemo(
    () => (editing && form && !form.name.trim() ? 'Name is required' : ''),
    [editing, form],
  );

  // Which tabs hold unsaved edits – powers the dirty dot on each tab (so an
  // admin never forgets a tab they changed before hitting the global Save).
  const dirtyTabs = useMemo(() => {
    if (!editing || !form || !baseline) return {};
    const diff = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
    return {
      overview: form.name !== baseline.name || form.email !== baseline.email || form.role !== baseline.role,
      site: form.officeId !== baseline.officeId || form.shiftStartTime !== baseline.shiftStartTime || form.shiftEndTime !== baseline.shiftEndTime,
      leaves: form.casual !== baseline.casual || form.sick !== baseline.sick || form.earned !== baseline.earned,
      salary: diff(form.salary, baseline.salary),
      bonus: diff(form.bonus, baseline.bonus),
      access: diff(form.restrictedPages, baseline.restrictedPages),
    };
  }, [editing, form, baseline]);

  const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const setSalary = (patch) => setForm((prev) => ({ ...prev, salary: { ...prev.salary, ...patch } }));
  const setBonus = (patch) => setForm((prev) => ({ ...prev, bonus: { ...prev.bonus, ...patch } }));

  const [updateUser] = useAppMutation(UPDATE_USER, { onError: (e) => notify.error(e.message) });
  const [updateSalary] = useAppMutation(UPDATE_SALARY, { onError: (e) => notify.error(e.message) });
  const [updateBonus] = useAppMutation(UPDATE_BONUS, { onError: (e) => notify.error(e.message) });
  const [requestDocument, { loading: requesting }] = useAppMutation(REQUEST_DOCUMENT, {
    successMessage: 'Document request sent',
    onCompleted: () => {
      setAskDocOpen(false);
      setAskDocTitle('');
      setAskDocNote('');
      refetchDocs?.();
    },
  });
  const [uploadDocument, { loading: uploading }] = useAppMutation(UPLOAD_DOCUMENT, {
    successMessage: 'Document uploaded',
    onCompleted: () => {
      setUploadOpen(false);
      setUploadForm({ title: '', category: 'ID_PROOF', fileBase64: '' });
      refetchDocs?.();
    },
    onError: (e) => notify.error(e.message),
  });
  const [deleteMyDocument, { loading: deletingDoc }] = useAppMutation(DELETE_MY_DOCUMENT, {
    successMessage: 'Document deleted',
    onCompleted: () => {
      setDeleteDoc(null);
      refetchDocs?.();
    },
    onError: (e) => notify.error(e.message),
  });

  const [saving, setSaving] = useState(false);
  const num = (v) => (v === '' || v == null ? null : Number(v));

  // GLOBAL save: persist EVERY changed section in one action, not just the
  // active tab. Diffs against the baseline snapshot so unchanged sections are
  // never touched (fewer writes, no accidental clobber).
  const doSave = async () => {
    setConfirmRole(false);
    if (nameError || emailError) {
      notify.warning(nameError || emailError);
      setTab('overview');
      return;
    }
    const b = baseline;
    const changed = (a, c) => JSON.stringify(a) !== JSON.stringify(c);
    const jobs = [];

    const coreChanged =
      form.name !== b.name ||
      form.email !== b.email ||
      form.role !== b.role ||
      form.officeId !== b.officeId ||
      form.shiftStartTime !== b.shiftStartTime ||
      form.shiftEndTime !== b.shiftEndTime ||
      changed(form.restrictedPages, b.restrictedPages) ||
      form.casual !== b.casual ||
      form.sick !== b.sick ||
      form.earned !== b.earned;

    if (coreChanged) {
      const input = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: isSelfAccount ? user.role : form.role, // never self-demote
        shiftStartTime: form.shiftStartTime || null,
        shiftEndTime: form.shiftEndTime || null,
        restrictedPages: isSelfAccount ? [] : form.restrictedPages,
        leaveBalances: {
          casual: parseInt(form.casual, 10) || 0,
          sick: parseInt(form.sick, 10) || 0,
          earned: parseInt(form.earned, 10) || 0,
        },
      };
      if (form.officeId) input.officeId = form.officeId;
      jobs.push(() => updateUser({ variables: { id: staffId, input } }));
    }

    if (changed(form.salary, b.salary)) {
      jobs.push(() =>
        updateSalary({
          variables: {
            userId: staffId,
            input: {
              ctc: num(form.salary.ctc),
              basic: num(form.salary.basic),
              hra: num(form.salary.hra),
              allowances: num(form.salary.allowances),
              deductions: num(form.salary.deductions),
              currency: form.salary.currency || 'INR',
              effectiveFrom: form.salary.effectiveFrom || null,
            },
          },
        }),
      );
    }

    if (changed(form.bonus, b.bonus)) {
      jobs.push(() =>
        updateBonus({
          variables: {
            userId: staffId,
            input: {
              amount: num(form.bonus.amount),
              reason: form.bonus.reason || null,
              frequency: form.bonus.frequency || 'ONE_TIME',
              payoutDate: form.bonus.payoutDate || null,
            },
          },
        }),
      );
    }

    if (jobs.length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      for (const job of jobs) {
        const res = await job();
        if (res?.error) throw new Error(res.errorMessage || 'Save failed');
      }
      const fresh = await refetch();
      if (fresh?.data?.user) setBaseline(blankForm(fresh.data.user));
      onChanged?.();
      setEditing(false);
      notify.success('Changes saved');
    } catch (e) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Role change is high-impact (grants/revokes admin) → confirm first.
  const handleSave = () => {
    if (!isSelfAccount && form && baseline && form.role !== baseline.role) {
      setConfirmRole(true);
      return;
    }
    doSave();
  };

  const submitAskDoc = () => {
    if (!askDocTitle.trim()) return notify.warning('Enter a document name');
    requestDocument({ variables: { userId: staffId, title: askDocTitle.trim(), note: askDocNote.trim() || null } });
  };

  const submitUpload = () => {
    if (!uploadForm.title.trim()) return notify.warning('Enter a document title');
    if (!uploadForm.fileBase64) return notify.warning('Choose a file');
    uploadDocument({
      variables: { input: { title: uploadForm.title.trim(), category: uploadForm.category, fileBase64: uploadForm.fileBase64 } },
    });
  };

  const requestClose = useCallback(() => {
    if (saving) return;
    if (editing && dirty) return setConfirmClose(true);
    onClose?.();
  }, [saving, editing, dirty, onClose]);

  const canSave = editing && dirty && !saving && !nameError && !emailError;

  const renderBody = () => {
    if (loading && !user) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      );
    }
    if (!user) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <EmptyState
            variant="error"
            title="Profile not found"
            description="This profile could not be loaded."
            action={<AppButton variant="outlined" onClick={() => refetch?.()}>Retry</AppButton>}
          />
        </Box>
      );
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header banner */}
        <Box
          sx={{
            flexShrink: 0,
            px: { xs: 2, sm: 3 },
            py: { xs: 1.5, sm: 2 },
            borderBottom: '1px solid',
            borderColor: 'divider',
            background: (t) => `linear-gradient(135deg, ${t.palette.action.hover} 0%, ${t.palette.background.paper} 100%)`,
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Tooltip title="View photo">
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <Box sx={{ width: 15, height: 15, borderRadius: '50%', bgcolor: user.isActive ? 'success.main' : 'text.disabled', border: '2px solid', borderColor: 'background.paper' }} />
                }
              >
                <Avatar
                  src={user.avatar || undefined}
                  onClick={() => setPhotoOpen(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPhotoOpen(true); } }}
                  role="button"
                  tabIndex={0}
                  aria-label="View profile photo"
                  sx={{ width: 72, height: 72, fontSize: 28, cursor: 'pointer', '&:hover': { opacity: 0.9 } }}
                >
                  {user.name?.charAt(0)?.toUpperCase()}
                </Avatar>
              </Badge>
            </Tooltip>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>{user.name}</Typography>
                <StatusBadge status={user.role === 'ADMIN' ? 'ERROR' : 'ACTIVE'} label={user.role} size="small" />
                {!user.isActive && <StatusBadge status="OFF_DUTY" label="Inactive" size="small" />}
              </Stack>
              <Stack direction="row" spacing={{ xs: 1.25, sm: 2 }} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 0.75, color: 'text.secondary' }}>
                <StatusBadge label={user.employeeId || '—'} bg="action.selected" color="text.primary" size="small" sx={{ fontFamily: 'monospace', letterSpacing: 0.5 }} />
                <MetaItem icon={MailOutlineIcon} text={user.email} />
                <MetaItem icon={ApartmentIcon} text={user.assignedOffice?.name || 'Default Site'} />
                <MetaItem icon={CalendarMonthIcon} text={`Joined ${user.createdAt ? dayjs(user.createdAt).format('MMM YYYY') : '—'}`} />
              </Stack>
            </Box>

            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignSelf: 'flex-start' }}>
              {canEdit && (
                <Tooltip title={editing ? 'Switch to view mode' : 'Edit profile'}>
                  <span>
                    <IconButton color={editing ? 'primary' : 'default'} onClick={() => setEditing((v) => !v)} aria-label="Toggle edit mode">
                      <EditIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              <IconButton onClick={requestClose} aria-label="Close" disabled={saving}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        {/* Master-detail body */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
          <Tabs
            orientation={isMobile ? 'horizontal' : 'vertical'}
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              flexShrink: 0,
              borderRight: { md: '1px solid' },
              borderBottom: { xs: '1px solid', md: 'none' },
              borderColor: 'divider',
              minWidth: { md: 220 },
              '& .MuiTabs-flexContainer': { alignItems: { md: 'stretch' } },
              '& .MuiTab-root': {
                minHeight: 46,
                textTransform: 'none',
                fontWeight: 600,
                justifyContent: 'flex-start',
                textAlign: 'left',
                pl: { md: 2.5 },
              },
            }}
          >
            {tabs.map((t) => (
              <Tab
                key={t.value}
                value={t.value}
                iconPosition="start"
                icon={<t.icon fontSize="small" />}
                label={
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ width: '100%' }}>
                    <span>{t.label}</span>
                    {dirtyTabs[t.value] && <CircleIcon sx={{ fontSize: 8, color: 'warning.main' }} />}
                  </Stack>
                }
              />
            ))}
          </Tabs>

          {/* Scroll region – content fills the full page width */}
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              {!form ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {tab === 'overview' && (
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, lg: 6 }}>
                        <SectionCard title="Personal Details">
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <SmartField label="Full Name" value={form.name} editing={editing} onChange={(v) => setField({ name: v })} error={nameError} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <SmartField label="Email" type="email" value={form.email} editing={editing} onChange={(v) => setField({ email: v })} error={emailError} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <SmartField
                                label="System Role"
                                value={form.role}
                                editing={editing}
                                onChange={(v) => setField({ role: v })}
                                options={ROLE_OPTS}
                                disabled={isSelfAccount}
                                helperText={isSelfAccount ? 'You cannot change your own role' : ''}
                              />
                            </Grid>
                          </Grid>
                        </SectionCard>
                      </Grid>
                      <Grid size={{ xs: 12, lg: 6 }}>
                        <DocumentsSection
                          documents={documents}
                          isSelfMode={isSelfMode}
                          onAskDoc={() => setAskDocOpen(true)}
                          onUpload={() => setUploadOpen(true)}
                          onDelete={(doc) => setDeleteDoc(doc)}
                        />
                      </Grid>

                      {/* Device fingerprint registration (attendance identity) */}
                      <Grid size={{ xs: 12 }}>
                        <SectionCard
                          title="Device Fingerprint (Attendance)"
                          action={
                            isSelfMode && (
                              <Tooltip title={fpSupported ? 'Register this device for fingerprint attendance' : 'This browser cannot register fingerprints'}>
                                <span>
                                  <AppButton
                                    size="small"
                                    variant="outlined"
                                    startIcon={<FingerprintIcon fontSize="small" />}
                                    onClick={handleRegisterFingerprint}
                                    loading={fpBusy}
                                    disabled={!fpSupported}
                                  >
                                    Add This Device
                                  </AppButton>
                                </span>
                              </Tooltip>
                            )
                          }
                        >
                          {isSelfMode && !fpSupported && (
                            <Typography variant="caption" color="warning.dark" display="block" sx={{ mb: 1 }}>
                              This browser/device does not support fingerprint registration. Open the app on a phone or laptop with a fingerprint sensor / Face ID / Windows Hello.
                            </Typography>
                          )}
                          {passkeys.length === 0 ? (
                            <EmptyState
                              compact
                              title="No fingerprint registered"
                              description={
                                isSelfMode
                                  ? 'Register this device so you can punch attendance with your fingerprint when the office enables Fingerprint mode.'
                                  : 'This staff member has not registered a fingerprint device yet.'
                              }
                            />
                          ) : (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {passkeys.map((pk) => (
                                <Chip
                                  key={pk.id}
                                  icon={<FingerprintIcon />}
                                  label={`${pk.deviceType || 'Device'} · ${pk.createdAt ? dayjs(pk.createdAt).format('DD MMM YYYY') : ''}${pk.lastUsedAt ? ` · last used ${dayjs(pk.lastUsedAt).format('DD MMM')}` : ''}`}
                                  onDelete={isSelfMode ? () => setFpDeleteTarget(pk.id) : undefined}
                                  deleteIcon={<DeleteOutlineIcon />}
                                  variant="outlined"
                                  size="small"
                                />
                              ))}
                            </Stack>
                          )}
                          {isSelfMode && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                              Your fingerprint never leaves this device — only a secure credential is stored, so it cannot be copied or misused.
                            </Typography>
                          )}
                        </SectionCard>
                      </Grid>
                    </Grid>
                  )}

                  {tab === 'site' && (
                    <SectionCard title="Site & Shift">
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <SmartField label="Assigned Office" value={form.officeId} editing={editing} onChange={(v) => setField({ officeId: v })} options={officeOptions} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                          <SmartField label="Shift Start" type="time" value={form.shiftStartTime} editing={editing} onChange={(v) => setField({ shiftStartTime: v })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                          <SmartField label="Shift End" type="time" value={form.shiftEndTime} editing={editing} onChange={(v) => setField({ shiftEndTime: v })} />
                        </Grid>
                      </Grid>
                    </SectionCard>
                  )}

                  {tab === 'leaves' && (
                    <SectionCard title="Leave Balances">
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <SmartField label="Casual" type="number" value={form.casual} editing={editing} onChange={(v) => setField({ casual: v })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <SmartField label="Sick" type="number" value={form.sick} editing={editing} onChange={(v) => setField({ sick: v })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <SmartField label="Earned" type="number" value={form.earned} editing={editing} onChange={(v) => setField({ earned: v })} />
                        </Grid>
                      </Grid>
                    </SectionCard>
                  )}

                  {tab === 'salary' && (
                    <SectionCard title="Salary">
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Annual CTC" type="number" value={form.salary.ctc} editing={editing} onChange={(v) => setSalary({ ctc: v })} format={money(form.salary.currency)} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Currency" value={form.salary.currency} editing={editing} onChange={(v) => setSalary({ currency: v })} options={CURRENCY_OPTS} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Basic" type="number" value={form.salary.basic} editing={editing} onChange={(v) => setSalary({ basic: v })} format={money(form.salary.currency)} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="HRA" type="number" value={form.salary.hra} editing={editing} onChange={(v) => setSalary({ hra: v })} format={money(form.salary.currency)} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Allowances" type="number" value={form.salary.allowances} editing={editing} onChange={(v) => setSalary({ allowances: v })} format={money(form.salary.currency)} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Deductions" type="number" value={form.salary.deductions} editing={editing} onChange={(v) => setSalary({ deductions: v })} format={money(form.salary.currency)} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Effective From" type="date" value={form.salary.effectiveFrom} editing={editing} onChange={(v) => setSalary({ effectiveFrom: v })} /></Grid>
                      </Grid>
                    </SectionCard>
                  )}

                  {tab === 'bonus' && (
                    <SectionCard title="Bonus">
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Amount" type="number" value={form.bonus.amount} editing={editing} onChange={(v) => setBonus({ amount: v })} format={money(form.salary.currency)} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Frequency" value={form.bonus.frequency} editing={editing} onChange={(v) => setBonus({ frequency: v })} options={FREQUENCY_OPTS} /></Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}><SmartField label="Payout Date" type="date" value={form.bonus.payoutDate} editing={editing} onChange={(v) => setBonus({ payoutDate: v })} /></Grid>
                        <Grid size={12}><SmartField label="Reason" value={form.bonus.reason} editing={editing} onChange={(v) => setBonus({ reason: v })} multiline={editing} minRows={2} /></Grid>
                      </Grid>
                    </SectionCard>
                  )}

                  {tab === 'access' && (
                    <SectionCard title="Page Access">
                      {isSelfAccount ? (
                        <EmptyState compact variant="permission" title="Self-access is locked" description="You cannot restrict your own pages." />
                      ) : (
                        // Always show the full matrix; switches are disabled in
                        // view mode and become editable when editing.
                        <PageAccessMatrix
                          value={form.restrictedPages}
                          onChange={(next) => setField({ restrictedPages: next })}
                          disabled={!editing}
                        />
                      )}
                    </SectionCard>
                  )}

                  {tab === 'notifications' && (
                    <SectionCard title="Notifications">
                      <NotificationsList items={notifications} loading={notifQuery.loading} />
                    </SectionCard>
                  )}
                </>
              )}
            </Box>
          </Box>
        </Box>

        {/* Save bar */}
        {editing && form && (
          <Box sx={{ flexShrink: 0, px: { xs: 2, sm: 3 }, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">{dirty ? 'Unsaved changes' : 'No changes'}</Typography>
            <Stack direction="row" spacing={1}>
              <AppButton variant="text" onClick={() => { setForm(baseline); setEditing(false); }} disabled={saving}>Cancel</AppButton>
              <AppButton variant="contained" startIcon={<SaveIcon fontSize="small" />} onClick={handleSave} loading={saving} disabled={!canSave}>Save Changes</AppButton>
            </Stack>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <>
      <GenericDialog open={open} onClose={requestClose} fullScreen dividers={false} contentSx={{ p: 0, height: '100vh' }} title={null} sx={{ borderRadius: 0 }}>
        {renderBody()}
      </GenericDialog>

      {/* Full photo viewer */}
      <Dialog open={photoOpen} onClose={() => setPhotoOpen(false)} maxWidth="sm" PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default' } }}>
        {user?.avatar ? (
          <Box component="img" src={user.avatar} alt={user?.name} sx={{ display: 'block', maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }} />
        ) : (
          <Box sx={{ width: 320, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Avatar sx={{ width: 160, height: 160, fontSize: 64 }}>{user?.name?.charAt(0)?.toUpperCase()}</Avatar>
          </Box>
        )}
      </Dialog>

      {/* Ask Doc (admin) */}
      <GenericDialog
        open={askDocOpen}
        onClose={() => !requesting && setAskDocOpen(false)}
        title="Request a Document"
        maxWidth="xs"
        loading={requesting}
        actions={
          <>
            <AppButton variant="text" onClick={() => setAskDocOpen(false)} disabled={requesting}>Cancel</AppButton>
            <AppButton variant="contained" onClick={submitAskDoc} loading={requesting}>Send Request</AppButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Document name" placeholder="e.g. PAN Card" value={askDocTitle} onChange={(e) => setAskDocTitle(e.target.value)} fullWidth autoFocus />
          <TextField label="Note (optional)" value={askDocNote} onChange={(e) => setAskDocNote(e.target.value)} fullWidth multiline minRows={2} />
        </Stack>
      </GenericDialog>

      {/* Upload Doc (staff self) */}
      <GenericDialog
        open={uploadOpen}
        onClose={() => !uploading && setUploadOpen(false)}
        title="Upload Document"
        maxWidth="xs"
        loading={uploading}
        actions={
          <>
            <AppButton variant="text" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</AppButton>
            <AppButton variant="contained" onClick={submitUpload} loading={uploading}>Upload</AppButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Document title" placeholder="e.g. Aadhaar Card" value={uploadForm.title} onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))} fullWidth autoFocus />
          <TextField label="Category" select value={uploadForm.category} onChange={(e) => setUploadForm((p) => ({ ...p, category: e.target.value }))} fullWidth>
            {DOC_CATEGORY_OPTS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <AppButton variant="outlined" component="label" startIcon={<UploadFileOutlinedIcon />} fullWidth sx={{ py: 1.25 }}>
            {uploadForm.fileBase64 ? 'File attached – change' : 'Choose file (PDF/JPG/PNG – max 5 MB)'}
            <input
              hidden
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) return notify.warning('File too large – max 5 MB');
                const reader = new FileReader();
                reader.onload = () => setUploadForm((p) => ({ ...p, fileBase64: reader.result }));
                reader.readAsDataURL(file);
              }}
            />
          </AppButton>
        </Stack>
      </GenericDialog>

      {/* Unsaved-changes guard */}
      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => { setConfirmClose(false); onClose?.(); }}
        title="Discard changes?"
        description="You have unsaved changes. Closing now will discard them."
        confirmText="Discard"
        variant="warning"
      />

      {/* High-impact role change guard */}
      <ConfirmDialog
        open={confirmRole}
        onClose={() => setConfirmRole(false)}
        onConfirm={doSave}
        title="Change system role?"
        description={
          form && baseline
            ? `This will change ${user?.name || 'this user'}'s role from ${baseline.role} to ${form.role}, which changes what they can access. Continue?`
            : 'This changes what this user can access. Continue?'
        }
        confirmText="Change role"
        variant="warning"
      />

      {/* Delete own document guard (staff self-view) */}
      <ConfirmDialog
        open={!!deleteDoc}
        onClose={() => !deletingDoc && setDeleteDoc(null)}
        onConfirm={() => deleteMyDocument({ variables: { id: deleteDoc.id } })}
        loading={deletingDoc}
        title="Delete document?"
        description={`“${deleteDoc?.title ?? ''}” will be permanently removed. This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Remove a registered fingerprint device (staff self-view) */}
      <ConfirmDialog
        open={!!fpDeleteTarget}
        onClose={() => setFpDeleteTarget(null)}
        onConfirm={handleRemoveFingerprint}
        loading={fpBusy}
        title="Remove fingerprint device?"
        description="This device will no longer be able to punch attendance with a fingerprint. You can register it again anytime."
        confirmText="Remove"
        variant="warning"
      />
    </>
  );
};

// ── Documents section (shared by admin + self) ──
const DocumentsSection = ({ documents, isSelfMode, onAskDoc, onUpload, onDelete }) => (
  <SectionCard
    title="Documents"
    action={
      isSelfMode ? (
        <AppButton size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon fontSize="small" />} onClick={onUpload}>Upload</AppButton>
      ) : (
        <AppButton size="small" variant="outlined" startIcon={<AddCommentIcon fontSize="small" />} onClick={onAskDoc}>Ask Doc</AppButton>
      )
    }
  >
    {documents.length === 0 ? (
      <EmptyState
        compact
        title="No documents yet"
        description={isSelfMode ? 'Upload ID proofs or certificates for verification.' : 'Use “Ask Doc” to request one from this staff member.'}
      />
    ) : (
      <Grid container spacing={2}>
        {documents.map((doc) => {
          // Staff may remove only their own not-yet-verified uploads.
          const canDelete = isSelfMode && doc.status !== 'VERIFIED';
          return (
            <Grid size={{ xs: 6, sm: 4 }} key={doc.id}>
              <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, position: 'relative' }}>
                {canDelete && (
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => onDelete?.(doc)}
                      aria-label={`Delete ${doc.title}`}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        zIndex: 1,
                        bgcolor: 'background.paper',
                        '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' },
                      }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <CardActionArea component="a" href={doc.fileUrl} target="_blank" rel="noopener">
                  <Box sx={{ height: 110, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {isImage(doc.fileUrl) ? (
                      <Box component="img" src={doc.fileUrl} alt={doc.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <DescriptionIcon sx={{ fontSize: 44, color: 'text.disabled' }} />
                    )}
                  </Box>
                  <Box sx={{ p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.5}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 500 }} title={doc.title}>{doc.title}</Typography>
                      <OpenInNewIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{CATEGORY_LABEL[doc.category] || doc.category}</Typography>
                      <StatusBadge status={doc.status} size="small" />
                    </Stack>
                    {doc.createdAt && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                        {dayjs(doc.createdAt).format('DD MMM YYYY')}
                      </Typography>
                    )}
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    )}
  </SectionCard>
);
DocumentsSection.propTypes = {
  documents: PropTypes.array,
  isSelfMode: PropTypes.bool,
  onAskDoc: PropTypes.func,
  onUpload: PropTypes.func,
  onDelete: PropTypes.func,
};

// ── Notifications list with dates ──
const NotificationsList = ({ items, loading }) => {
  if (loading && items.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>;
  }
  if (items.length === 0) {
    return <EmptyState compact title="No notifications" description="You are all caught up." />;
  }
  return (
    <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
      {items.map((n) => (
        <Stack key={n.id} direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1.25 }}>
          <CircleIcon sx={{ fontSize: 9, mt: 0.75, color: n.isRead ? 'transparent' : 'primary.main', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: n.isRead ? 500 : 700 }}>{n.title}</Typography>
            {n.message && <Typography variant="body2" color="text.secondary">{n.message}</Typography>}
            <Typography variant="caption" color="text.secondary">
              {dayjs(n.createdAt).format('DD MMM YYYY, h:mm A')}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
};
NotificationsList.propTypes = { items: PropTypes.array, loading: PropTypes.bool };

const MetaItem = ({ icon: Icon, text }) => (
  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
    <Icon sx={{ fontSize: 15 }} />
    <Typography variant="body2" noWrap>{text}</Typography>
  </Stack>
);
MetaItem.propTypes = { icon: PropTypes.elementType, text: PropTypes.node };

ProfileDialog.propTypes = {
  open: PropTypes.bool,
  staffId: PropTypes.string,
  onClose: PropTypes.func,
  onChanged: PropTypes.func,
  mode: PropTypes.oneOf(['admin', 'self']),
};

export default ProfileDialog;
