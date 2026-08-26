import { useState } from 'react';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { z } from 'zod';

import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import GenericDialog from '../../shared/ui/GenericDialog';
import PageHeader from '../../shared/ui/PageHeader';
import AppButton from '../../shared/ui/AppButton';
import StatusBadge from '../../shared/ui/StatusBadge';
import { GenericFormEngine, useNotification, ReviewDialog } from '../../shared/ui';
import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { useAuth } from '../../shared/auth/AuthContext';
import { GET_MY_DOCUMENTS, GET_ALL_DOCUMENTS } from '../../graphql/queries';
import { UPLOAD_DOCUMENT, DELETE_MY_DOCUMENT, REVIEW_DOCUMENT } from '../../graphql/mutations';

const CATEGORY_LABEL = { ID_PROOF: 'ID Proof', CERTIFICATE: 'Certificate', OTHER: 'Other' };

const UPLOAD_SCHEMA = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.enum(['ID_PROOF', 'CERTIFICATE', 'OTHER']),
  fileBase64: z.string().min(1, 'Please choose a file'),
});

const DocumentsPage = () => {
  const { isAdmin } = useAuth();
  const notify = useNotification();

  const myQuery = useAppQuery(GET_MY_DOCUMENTS, { fetchPolicy: 'cache-and-network' });
  const myDocuments = myQuery.data?.myDocuments || [];

  const allQuery = useAppQuery(GET_ALL_DOCUMENTS, { skip: !isAdmin, fetchPolicy: 'cache-and-network' });
  const allDocuments = allQuery.data?.allDocuments || [];

  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const openReview = (row) => setReviewTarget(row);

  const [uploadDocument, { loading: uploading }] = useAppMutation(UPLOAD_DOCUMENT, {
    successMessage: 'Document uploaded – the owner has been notified',
    onCompleted: () => setUploadOpen(false),
    refetchQueries: [{ query: GET_MY_DOCUMENTS }, { query: GET_ALL_DOCUMENTS }],
    onError: (err) => notify.error(err.message),
  });

  const [deleteDocument, { loading: deleting }] = useAppMutation(DELETE_MY_DOCUMENT, {
    successMessage: 'Document deleted',
    refetchQueries: [{ query: GET_MY_DOCUMENTS }],
    onError: (err) => notify.error(err.message),
  });

  const [reviewDocument, { loading: reviewing }] = useAppMutation(REVIEW_DOCUMENT, {
    successMessage: 'Document reviewed',
    refetchQueries: [{ query: GET_ALL_DOCUMENTS }, { query: GET_MY_DOCUMENTS }],
    onError: (err) => notify.error(err.message),
  });

  // Fields live inside the component so the file picker can raise toasts
  const uploadFields = [
    { name: 'title', type: 'text', label: 'Document Title', placeholder: 'e.g. Aadhaar Card, B.Pharm Certificate', gridSize: { xs: 12 } },
    {
      name: 'category',
      type: 'select',
      label: 'Category',
      options: [
        { value: 'ID_PROOF', label: 'ID Proof' },
        { value: 'CERTIFICATE', label: 'Certificate' },
        { value: 'OTHER', label: 'Other' },
      ],
      gridSize: { xs: 12 },
    },
    {
      name: 'fileBase64',
      type: 'custom',
      label: 'File',
      gridSize: { xs: 12 },
      render: ({ value, onChange }) => (
        <AppButton
          variant="outlined"
          component="label"
          startIcon={<UploadFileOutlinedIcon />}
          fullWidth
          sx={{ py: 1.25 }}
        >
          {value ? 'File attached – click to change' : 'Choose file (PDF, JPG, PNG – max 5 MB)'}
          <input
            hidden
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                notify.warning('File too large – maximum 5 MB');
                return;
              }
              const reader = new FileReader();
              reader.onload = () => onChange(reader.result);
              reader.readAsDataURL(file);
            }}
          />
        </AppButton>
      ),
    },
  ];

  const submitUpload = async (values) => {
    await uploadDocument({
      variables: {
        input: {
          title: values.title.trim(),
          category: values.category,
          fileBase64: values.fileBase64,
        },
      },
    });
  };

  const myColumns = [
    { id: 'title', label: 'Document', width: 200, render: (r) => (
        <Typography variant="body2" fontWeight={600}>{r.title}</Typography>
      ) },
    { id: 'category', label: 'Category', width: 120, render: (r) => CATEGORY_LABEL[r.category] || r.category },
    { id: 'status', label: 'Status', width: 110, align: 'center', render: (r) => <StatusBadge status={r.status} /> },
    { id: 'adminFeedback', label: 'Owner Remarks', width: 200, sortable: false, render: (r) =>
        r.adminFeedback ? <Typography variant="caption">{r.adminFeedback}</Typography> : <Typography variant="caption" color="text.secondary">—</Typography> },
    { id: 'createdAt', label: 'Uploaded On', width: 130, valueGetter: (r) => r.createdAt, render: (r) => (
        <Typography variant="body2">{dayjs(r.createdAt).format('DD MMM YYYY')}</Typography>
      ) },
    { id: 'actions', label: 'Actions', width: 120, sortable: false, align: 'center', render: (r) => (
        <Stack direction="row" spacing={0.5} justifyContent="center">
          <IconButton size="small" component="a" href={r.fileUrl} target="_blank" rel="noopener" aria-label="Open document">
            <OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
          {r.status !== 'VERIFIED' && (
            <IconButton size="small" color="error" disabled={deleting} onClick={() => deleteDocument({ variables: { id: r.id } })} aria-label="Delete document">
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Stack>
      ) },
  ];

  const adminColumns = [
    { id: 'title', label: 'Document', width: 180, render: (r) => (
        <Typography variant="body2" fontWeight={600}>{r.title}</Typography>
      ) },
    { id: 'uploadedBy', label: 'Staff', width: 180, sortable: false, render: (r) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>{r.uploadedBy?.name?.charAt(0)}</Avatar>
          <Box>
            <Typography variant="body2" fontSize={13} fontWeight={600}>{r.uploadedBy?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{r.uploadedBy?.employeeId}</Typography>
          </Box>
        </Stack>
      ) },
    { id: 'category', label: 'Category', width: 110, render: (r) => CATEGORY_LABEL[r.category] || r.category },
    { id: 'status', label: 'Status', width: 110, align: 'center', render: (r) => <StatusBadge status={r.status} /> },
    { id: 'createdAt', label: 'Uploaded On', width: 120, valueGetter: (r) => r.createdAt, render: (r) => (
        <Typography variant="body2">{dayjs(r.createdAt).format('DD MMM YYYY')}</Typography>
      ) },
    { id: 'actions', label: 'Actions', width: 150, sortable: false, align: 'center', render: (r) => (
        r.status === 'PENDING' ? (
          <AppButton size="small" onClick={() => openReview(r)}>Review</AppButton>
        ) : (
          <Stack direction="row" spacing={0.5} justifyContent="center">
            <IconButton size="small" component="a" href={r.fileUrl} target="_blank" rel="noopener" aria-label="Open document">
              <OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
            {r.reviewedBy?.name && (
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                by {r.reviewedBy.name}
              </Typography>
            )}
          </Stack>
        )
      ) },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <PageHeader
        title={isAdmin ? 'Document Vault' : 'My Documents'}
        subtitle={isAdmin ? 'Verify documents uploaded by staff (optional uploads)' : 'Upload ID proofs and certificates for verification – completely optional'}
        action={!isAdmin ? (
          <AppButton variant="contained" startIcon={<UploadFileOutlinedIcon fontSize="small" />} onClick={() => setUploadOpen(true)}>
            Upload Document
          </AppButton>
        ) : undefined}
      />

      <Card sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        {isAdmin ? (
          <GenericDataGrid
            title="All Uploaded Documents"
            rows={allDocuments}
            columns={adminColumns}
            loading={allQuery.loading}
            error={allQuery.error}
            onRetry={() => allQuery.refetch()}
          />
        ) : (
          <GenericDataGrid
            title="My Uploads"
            rows={myDocuments}
            columns={myColumns}
            loading={myQuery.loading}
            error={myQuery.error}
            onRetry={() => myQuery.refetch()}
          />
        )}
      </Card>

      {/* Upload dialog – same JSON-driven form engine as every other dialog */}
      <GenericDialog
        open={uploadOpen}
        onClose={() => !uploading && setUploadOpen(false)}
        title="Upload Document"
        maxWidth="xs"
      >
        <GenericFormEngine
          fields={uploadFields}
          schema={UPLOAD_SCHEMA}
          initialValues={{ title: '', category: 'ID_PROOF', fileBase64: '' }}
          submitLabel="Upload"
          hideReset
          onSubmit={submitUpload}
        />
      </GenericDialog>

      {/* Admin review dialog */}
      <ReviewDialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title="Review Document"
        loading={reviewing}
        details={[
          {
            label: 'Document',
            value: `${reviewTarget?.title ?? ''} (${CATEGORY_LABEL[reviewTarget?.category] || reviewTarget?.category || ''})`,
          },
        ]}
        options={[
          { value: 'VERIFIED', label: 'Verify' },
          { value: 'REJECTED', label: 'Reject' },
        ]}
        initialDecision="VERIFIED"
        feedbackLabel="Remarks (Optional)"
        feedbackRows={2}
        onSubmit={(decision, remarks) =>
          reviewDocument({
            variables: { id: reviewTarget.id, status: decision, adminFeedback: remarks },
          })
        }
      >
        <AppButton
          variant="outlined"
          component="a"
          href={reviewTarget?.fileUrl}
          target="_blank"
          rel="noopener"
          fullWidth
        >
          Open Document
        </AppButton>
      </ReviewDialog>
    </Box>
  );
};

export default DocumentsPage;
