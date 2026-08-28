import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import { z } from 'zod';
import { alpha } from '@mui/material/styles';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';

import GenericDialog from '../../../shared/ui/GenericDialog';
import StatusBadge from '../../../shared/ui/StatusBadge';
import AppButton from '../../../shared/ui/AppButton';
import { GenericFormEngine, useNotification, ReviewDialog } from '../../../shared/ui';
import { useAppQuery, useAppMutation } from '../../../shared/hooks';
import { useAuth } from '../../../shared/auth/AuthContext';
import { GET_MY_DOCUMENTS, GET_SALARY_RECORDS, GET_BONUS_RECORDS, GET_DOCUMENT_REQUESTS } from '../../../graphql/queries';
import { UPLOAD_DOCUMENT, DELETE_MY_DOCUMENT, REVIEW_DOCUMENT } from '../../../graphql/mutations';

// Staff may upload PERSONAL documents only. Salary slips and bonuses are
// employer-managed FORM records that an admin adds - staff see them read-only.
const ALL_CATEGORIES = [
  { value: 'ID_PROOF', label: 'ID Proof' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'OTHER', label: 'Other' },
];
const CATEGORY_LABEL = {};
ALL_CATEGORIES.forEach((c) => { CATEGORY_LABEL[c.value] = c.label; });

const categoryColor = (cat) => (cat === 'CERTIFICATE' ? 'secondary' : 'default');

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const monthLabel = (m) => dayjs(`${m}-01`).format('MMM YYYY');

const DetailRow = ({ icon: Icon, label, value }) => (
  <Stack direction="row" spacing={1.5} alignItems="center">
    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', minWidth: 24, justifyContent: 'center' }}>
      <Icon fontSize="small" />
    </Box>
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word' }}>{value || '-'}</Typography>
    </Stack>
  </Stack>
);

const EmptyState = ({ icon: Icon, message }) => (
  <Box sx={{ textAlign: 'center', py: 4 }}>
    <Icon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
    <Typography variant="body2" color="text.secondary">{message}</Typography>
  </Box>
);

const filePicker = (value, onChange) => (
  <AppButton variant="outlined" component="label" startIcon={<UploadFileOutlinedIcon />} fullWidth sx={{ py: 1.25 }}>
    {value ? 'File attached - click to change' : 'Choose file (PDF, JPG, PNG - max 5 MB)'}
    <input
      hidden
      type="file"
      accept=".pdf,.jpg,.jpeg,.png,.webp"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return;
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result);
        reader.readAsDataURL(file);
      }}
    />
  </AppButton>
);

/** Self-profile dialog (Topbar > My Profile). Read-only payroll, personal docs only. */
const ProfileDialog = ({ open, onClose, user }) => {
  const notify = useNotification();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('details');
  const [catFilter, setCatFilter] = useState('ALL');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);

  const userId = user?.id;

  const { data: docsData, loading: docsLoading, refetch: refetchDocs } = useAppQuery(GET_MY_DOCUMENTS, {
    skip: !open,
    fetchPolicy: 'cache-and-network',
  });
  const { data: salaryData, loading: salaryLoading } = useAppQuery(GET_SALARY_RECORDS, {
    variables: { userId },
    skip: !open || !userId,
  });
  const { data: bonusData, loading: bonusLoading } = useAppQuery(GET_BONUS_RECORDS, {
    variables: { userId },
    skip: !open || !userId,
  });
  const { data: requestData, refetch: refetchRequests } = useAppQuery(GET_DOCUMENT_REQUESTS, {
    variables: { userId },
    skip: !open || !userId,
  });

  const myDocs = useMemo(() => docsData?.myDocuments || [], [docsData]);
  const filteredDocs = useMemo(
    () => (catFilter === 'ALL' ? myDocs : myDocs.filter((d) => d.category === catFilter)),
    [myDocs, catFilter],
  );
  const salaryRecords = salaryData?.salaryRecords || [];
  const bonusRecords = bonusData?.bonusRecords || [];
  const pendingRequests = useMemo(
    () => (requestData?.documentRequests || []).filter((r) => r.status === 'PENDING'),
    [requestData],
  );

  const [uploadDocument, { loading: uploading }] = useAppMutation(UPLOAD_DOCUMENT, {
    successMessage: 'Document uploaded - admin notified',
    onCompleted: () => { setUploadOpen(false); refetchDocs(); refetchRequests(); },
    onError: (err) => notify.error(err.message),
  });
  const [deleteDocument, { loading: deleting }] = useAppMutation(DELETE_MY_DOCUMENT, {
    successMessage: 'Document deleted',
    onCompleted: () => refetchDocs(),
    onError: (err) => notify.error(err.message),
  });
  const [reviewDocument, { loading: reviewing }] = useAppMutation(REVIEW_DOCUMENT, {
    successMessage: 'Document reviewed',
    onCompleted: () => { setReviewTarget(null); refetchDocs(); },
    onError: (err) => notify.error(err.message),
  });

  const TAB_ITEMS = [
    { key: 'details', label: 'Details' },
    { key: 'documents', label: `Documents (${myDocs.length})` },
    { key: 'salary', label: `Salary (${salaryRecords.length})` },
    { key: 'bonus', label: `Bonus (${bonusRecords.length})` },
  ];

  const close = () => { setTab('details'); setUploadOpen(false); onClose(); };

  return (
    <GenericDialog open={open} onClose={close} title="My Profile" maxWidth="sm">
      {!user ? (
        <Alert severity="error">Profile could not be loaded.</Alert>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: 'divider' }}>
          <Box
            sx={(theme) => ({
              px: 2.5, py: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
              borderBottom: '1px solid', borderColor: 'divider',
            })}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={user.avatar || undefined} sx={{ width: 52, height: 52, bgcolor: 'primary.main', fontWeight: 600, fontSize: '1.25rem' }}>
                {user.name?.charAt(0)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" fontWeight={700} noWrap>{user.name}</Typography>
                  <StatusBadge status={user.isActive ? 'ACTIVE' : 'ERROR'} label={user.isActive ? 'Active' : 'Inactive'} size="small" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {user.employeeId || '-'} | {user.role}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ px: 1, borderBottom: '1px solid', borderColor: 'divider', minHeight: 44 }}>
            {TAB_ITEMS.map((t) => (
              <Tab key={t.key} value={t.key} label={t.label} sx={{ minHeight: 44 }} />
            ))}
          </Tabs>

          <Box sx={{ p: 2.5 }}>
            {tab === 'details' && (
              <Stack spacing={2.5}>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                  <DetailRow icon={BadgeOutlinedIcon} label="Employee ID" value={user.employeeId} />
                  <DetailRow icon={EmailOutlinedIcon} label="Email" value={user.email} />
                  <DetailRow icon={BusinessOutlinedIcon} label="Site" value={user.assignedOffice?.name} />
                  <DetailRow icon={EventAvailableOutlinedIcon} label="Joined" value={user.createdAt ? dayjs(user.createdAt).format('DD MMM YYYY') : undefined} />
                </Box>
                <Divider />
                <DetailRow icon={VerifiedUserOutlinedIcon} label="Status" value={user.isActive ? 'Active' : 'Inactive'} />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Leave Balances</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" variant="outlined" label={`Casual: ${user.leaveBalances?.casual ?? 0}`} />
                    <Chip size="small" variant="outlined" label={`Sick: ${user.leaveBalances?.sick ?? 0}`} />
                    <Chip size="small" variant="outlined" label={`Earned: ${user.leaveBalances?.earned ?? 0}`} />
                  </Stack>
                </Box>
              </Stack>
            )}

            {tab === 'documents' && (
              docsLoading && myDocs.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} /></Box>
              ) : (
                <Stack spacing={2}>
                  {pendingRequests.length > 0 && (
                    <Alert
                      severity="warning"
                      icon={<MailOutlineOutlinedIcon fontSize="small" />}
                      action={(
                        <AppButton size="small" onClick={() => setUploadOpen(true)}>
                          Upload
                        </AppButton>
                      )}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        Admin requested {pendingRequests.length === 1 ? 'a document' : `${pendingRequests.length} documents`} from you
                      </Typography>
                      {pendingRequests.map((r) => (
                        <Typography key={r.id} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {CATEGORY_LABEL[r.category] || r.category}{r.note ? ` - ${r.note}` : ''}
                        </Typography>
                      ))}
                    </Alert>
                  )}
                  <Stack direction="row" justifyContent="flex-end">
                    <AppButton variant="contained" size="small" startIcon={<UploadFileOutlinedIcon fontSize="small" />} onClick={() => setUploadOpen(true)}>
                      Upload Document
                    </AppButton>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label="All" color={catFilter === 'ALL' ? 'primary' : 'default'} variant={catFilter === 'ALL' ? 'filled' : 'outlined'} onClick={() => setCatFilter('ALL')} />
                    {ALL_CATEGORIES.map((c) => (
                      <Chip key={c.value} size="small" label={c.label} color={catFilter === c.value ? 'primary' : 'default'} variant={catFilter === c.value ? 'filled' : 'outlined'} onClick={() => setCatFilter(c.value)} />
                    ))}
                  </Stack>
                  {filteredDocs.length === 0 ? (
                    <EmptyState icon={DescriptionOutlinedIcon} message="No documents uploaded yet." />
                  ) : (
                    <Stack spacing={1.25}>
                      {filteredDocs.map((doc) => (
                        <Stack key={doc.id} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>{doc.title}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                              <Chip size="small" color={categoryColor(doc.category)} label={CATEGORY_LABEL[doc.category] || doc.category} />
                              <StatusBadge status={doc.status} size="small" />
                              {doc.createdAt && (
                                <Typography variant="caption" color="text.disabled">Uploaded {dayjs(doc.createdAt).format('DD MMM YYYY')}</Typography>
                              )}
                            </Stack>
                            {doc.adminFeedback && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Feedback: {doc.adminFeedback}</Typography>
                            )}
                          </Box>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {doc.fileUrl && (
                              <IconButton size="small" component="a" href={doc.fileUrl} target="_blank" rel="noopener" aria-label={doc.title}>
                                <OpenInNewOutlinedIcon fontSize="small" />
                              </IconButton>
                            )}
                            {doc.status !== 'VERIFIED' && (
                              <IconButton size="small" color="error" disabled={deleting} onClick={() => deleteDocument({ variables: { id: doc.id } })} aria-label="Delete document">
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            )}
                            {isAdmin && doc.status === 'PENDING' && (
                              <AppButton size="small" onClick={() => setReviewTarget(doc)}>Review</AppButton>
                            )}
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              )
            )}

            {tab === 'salary' && (
              salaryLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} /></Box>
              ) : salaryRecords.length === 0 ? (
                <EmptyState icon={PaymentsOutlinedIcon} message="Salary slips are added by your admin." />
              ) : (
                <Stack spacing={1.25}>
                  {salaryRecords.map((r) => (
                    <Stack key={r.id} direction="row" alignItems="center" spacing={2} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>{monthLabel(r.month)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Basic {inr(r.basic)} | HRA {inr(r.hra)} | Allow {inr(r.allowances)} | Ded {inr(r.deductions)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="subtitle1" fontWeight={700} color="primary.main">{inr(r.netPay)}</Typography>
                        <Typography variant="caption" color="text.secondary">Net Pay</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              )
            )}

            {tab === 'bonus' && (
              bonusLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} /></Box>
              ) : bonusRecords.length === 0 ? (
                <EmptyState icon={PaymentsOutlinedIcon} message="Bonuses are added by your admin." />
              ) : (
                <Stack spacing={1.25}>
                  {bonusRecords.map((r) => (
                    <Stack key={r.id} direction="row" alignItems="center" spacing={2} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>{monthLabel(r.month)}{r.reason ? ` - ${r.reason}` : ''}</Typography>
                      </Box>
                      <Typography variant="subtitle1" fontWeight={700} color="success.main">{inr(r.amount)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )
            )}
          </Box>
        </Card>
      )}

      <GenericDialog open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} title="Upload Document" subtitle="Uploads are reviewed by your admin">
        <GenericFormEngine
          fields={[
            { name: 'title', type: 'text', label: 'Document Title', placeholder: 'e.g. Aadhaar Card, Certificate', gridSize: { xs: 12 } },
            { name: 'category', type: 'select', label: 'Category', options: ALL_CATEGORIES, gridSize: { xs: 12 } },
            { name: 'fileBase64', type: 'custom', label: 'File', gridSize: { xs: 12 }, render: ({ value, onChange }) => filePicker(value, onChange) },
          ]}
          schema={z.object({ title: z.string().min(1, 'Title is required'), category: z.enum(['ID_PROOF', 'CERTIFICATE', 'OTHER']), fileBase64: z.string().min(1, 'Please choose a file') })}
          initialValues={{ title: '', category: 'ID_PROOF', fileBase64: '' }}
          submitLabel={uploading ? 'Uploading...' : 'Upload'}
          hideReset
          onSubmit={async (values) => {
            const r = await uploadDocument({ variables: { input: { title: values.title.trim(), category: values.category, fileBase64: values.fileBase64 } } });
            if (r.error) throw new Error(r.errorMessage);
          }}
        />
      </GenericDialog>

      {isAdmin && (
        <ReviewDialog
          open={!!reviewTarget}
          onClose={() => setReviewTarget(null)}
          title="Review Document"
          loading={reviewing}
          details={[{ label: 'Document', value: `${reviewTarget?.title ?? ''} (${CATEGORY_LABEL[reviewTarget?.category] || reviewTarget?.category || ''})` }]}
          options={[{ value: 'VERIFIED', label: 'Verify' }, { value: 'REJECTED', label: 'Reject' }]}
          initialDecision="VERIFIED"
          feedbackLabel="Remarks (Optional)"
          feedbackRows={2}
          onSubmit={(decision, remarks) => reviewDocument({ variables: { id: reviewTarget.id, status: decision, adminFeedback: remarks } })}
        >
          <AppButton variant="outlined" component="a" href={reviewTarget?.fileUrl} target="_blank" rel="noopener" fullWidth>
            Open Document
          </AppButton>
        </ReviewDialog>
      )}
    </GenericDialog>
  );
};

export default ProfileDialog;
