import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Typography, IconButton, CircularProgress, Alert, Stack, Avatar, Chip,
  Tabs, Tab
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import { alpha } from '@mui/material/styles';
import dayjs from 'dayjs';

import { useAppQuery, useAppMutation } from '../../shared/hooks';
import { GET_USER, GET_OFFICES, GET_ALL_DOCUMENTS, GET_SALARY_RECORDS } from '../../graphql/queries';
import { UPDATE_USER } from '../../graphql/mutations';
import GenericFormEngine from '../../shared/ui/GenericFormEngine';
import { EDIT_STAFF_FIELDS } from './staffFormConfig';
import GenericDataGrid from '../../shared/ui/GenericDataGrid';
import { useNotification } from '../../shared/ui';

const StaffProfilePage = ({ userId, onClose }) => {
  const [tab, setTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const notify = useNotification();

  const { data, loading, error, refetch } = useAppQuery(GET_USER, {
    variables: { id: userId },
    skip: !userId,
  });

  const { data: officeData } = useAppQuery(GET_OFFICES);
  const officeOptions = (officeData?.offices || []).map((o) => ({ value: o.id, label: o.name }));

  const { data: docsData } = useAppQuery(GET_ALL_DOCUMENTS);
  const { data: salaryData } = useAppQuery(GET_SALARY_RECORDS, {
    variables: { userId },
    skip: !userId,
  });

  const [updateUser, { loading: updating }] = useAppMutation(UPDATE_USER, {
    successMessage: 'Staff profile updated successfully',
    onCompleted: () => {
      setEditMode(false);
      refetch();
    },
    onError: (err) => notify.error(err.message),
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data?.user) {
    return (
      <Box p={3}>
        <Alert severity="error">Failed to load staff profile.</Alert>
      </Box>
    );
  }

  const user = data.user;
  const docs = (docsData?.allDocuments || []).filter(d => d.uploadedBy?.id === userId);
  
  const salaryRecords = salaryData?.salaryRecords || [];

  const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);

  const allFields = EDIT_STAFF_FIELDS(officeOptions);
  
  const initialValues = {
    name: user.name ?? '',
    email: user.email ?? '',
    role: user.role || 'STAFF',
    officeId: user.assignedOffice ? user.assignedOffice.id : '',
    casual: user.leaveBalances?.casual ?? 0,
    sick: user.leaveBalances?.sick ?? 6,
    earned: user.leaveBalances?.earned ?? 0,
    shiftStartTime: user.shiftStartTime || '',
    shiftEndTime: user.shiftEndTime || '',
    restrictedPages: user.restrictedPages ?? [],
  };

  const getFieldsForSection = (sectionLabels) => {
    const fields = [];
    let inTargetSection = false;
    for (const field of allFields) {
      if (field.type === 'section') {
        inTargetSection = sectionLabels.includes(field.label);
        continue;
      }
      if (inTargetSection) {
        fields.push({ ...field, disabled: !editMode });
      }
    }
    return fields;
  };

  const handleUpdate = async (values) => {
    // Merge new values into the complete edit object to satisfy the mutation
    const form = { ...initialValues, ...values };
    const input = {
      name: form.name,
      email: form.email,
      role: form.role,
      shiftStartTime: form.shiftStartTime || null,
      shiftEndTime: form.shiftEndTime || null,
      restrictedPages: Array.isArray(form.restrictedPages) ? form.restrictedPages : [],
      leaveBalances: {
        casual: parseInt(form.casual, 10) || 0,
        sick: parseInt(form.sick, 10) || 0,
        earned: parseInt(form.earned, 10) || 0,
      },
    };
    if (form.officeId) input.officeId = form.officeId;
    
    await updateUser({ variables: { id: user.id, input } });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      <Box sx={{ p: { xs: 1.5, sm: 2 }, position: 'relative', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        {onClose && (
          <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', top: 12, right: 12 }}>
            <CloseIcon />
          </IconButton>
        )}
        
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'center', sm: 'flex-start' }} textAlign={{ xs: 'center', sm: 'left' }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar 
              src={user.avatar || undefined} 
              sx={{ width: 64, height: 64, border: '3px solid', borderColor: 'background.paper', boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}` }}
            >
              {user.name?.charAt(0)}
            </Avatar>
            <Box sx={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', bgcolor: user.isActive ? 'success.main' : 'error.main', border: '2px solid', borderColor: 'background.paper' }} />
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent={{ xs: 'center', sm: 'flex-start' }} mb={0.5}>
              <Typography variant="h5" fontWeight={700} noWrap>
                {user.name}
              </Typography>
              <Chip label={user.role} variant="outlined" color="primary" size="small" sx={{ fontWeight: 600, height: 22 }} />
            </Stack>
            
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ color: 'text.secondary', mt: 0.5 }} justifyContent={{ xs: 'center', sm: 'flex-start' }}>
              <Chip label={user.employeeId || 'No ID'} size="small" sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontWeight: 600, height: 20, fontSize: '0.7rem' }} />
              <Stack direction="row" spacing={0.5} alignItems="center"><EmailOutlinedIcon fontSize="inherit" /><Typography variant="body2">{user.email}</Typography></Stack>
              <Stack direction="row" spacing={0.5} alignItems="center"><BusinessOutlinedIcon fontSize="inherit" /><Typography variant="body2">{user.assignedOffice?.name || 'No Branch'}</Typography></Stack>
              <Stack direction="row" spacing={0.5} alignItems="center"><EventAvailableOutlinedIcon fontSize="inherit" /><Typography variant="body2">Joined {dayjs(user.createdAt || new Date()).format('MMM YYYY')}</Typography></Stack>
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tabs value={tab} onChange={(e, v) => { setTab(v); setEditMode(false); }} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 44, flex: 1 }}>
          <Tab value="overview" label="Overview" sx={{ minHeight: 44 }} />
          <Tab value="site" label="Site & Shift" sx={{ minHeight: 44 }} />
          <Tab value="leaves" label="Leaves" sx={{ minHeight: 44 }} />
          <Tab value="documents" label={`Documents (${docs.length})`} sx={{ minHeight: 44 }} />
          <Tab value="salary" label={`Salary (${salaryRecords.length})`} sx={{ minHeight: 44 }} />
          <Tab value="access" label="Page Access" sx={{ minHeight: 44 }} />
        </Tabs>
        
        {['overview', 'site', 'leaves', 'access'].includes(tab) && (
          <IconButton 
            size="small" 
            onClick={() => setEditMode(!editMode)} 
            color={editMode ? 'primary' : 'default'}
            sx={{ mb: 1 }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, flex: 1, overflowY: 'auto' }}>
        {tab === 'overview' && (
          <GenericFormEngine 
            fields={getFieldsForSection(['Personal Details'])} 
            initialValues={initialValues} 
            onSubmit={handleUpdate}
            hideReset
            hideSubmit={!editMode}
            submitLabel={updating ? 'Saving…' : 'Save Changes'}
          />
        )}
        {tab === 'site' && (
          <GenericFormEngine 
            fields={getFieldsForSection(['Site & Shift'])} 
            initialValues={initialValues} 
            onSubmit={handleUpdate}
            hideReset
            hideSubmit={!editMode}
            submitLabel={updating ? 'Saving…' : 'Save Changes'}
          />
        )}
        {tab === 'leaves' && (
          <GenericFormEngine 
            fields={getFieldsForSection(['Leave Balances'])} 
            initialValues={initialValues} 
            onSubmit={handleUpdate}
            hideReset
            hideSubmit={!editMode}
            submitLabel={updating ? 'Saving…' : 'Save Changes'}
          />
        )}
        {tab === 'access' && (
          <GenericFormEngine 
            fields={getFieldsForSection(['Page Access'])} 
            initialValues={initialValues} 
            onSubmit={handleUpdate}
            hideReset
            hideSubmit={!editMode}
            submitLabel={updating ? 'Saving…' : 'Save Changes'}
          />
        )}
        
        {['overview', 'site', 'leaves', 'access'].includes(tab) && !editMode && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 4, textAlign: 'right' }}>
            View mode - fields are read-only. Use the edit (pencil) icon to change.
          </Typography>
        )}
        
        {tab === 'documents' && (
          <GenericDataGrid 
            rows={docs} 
            columns={[
              { id: 'title', label: 'Document Title', width: 250 },
              { id: 'status', label: 'Status', width: 120, render: (r) => <Chip size="small" label={r.status} color={r.status === 'VERIFIED' ? 'success' : 'warning'} /> },
              { id: 'createdAt', label: 'Uploaded On', width: 150, render: (r) => dayjs(r.createdAt).format('DD MMM YYYY') },
            ]} 
            hideToolbar
          />
        )}
        {tab === 'salary' && (
          <GenericDataGrid 
            rows={salaryRecords} 
            columns={[
              { id: 'month', label: 'Month/Year', width: 150, render: (r) => `${r.month} ${r.year}` },
              { id: 'netPay', label: 'Net Pay', width: 120, render: (r) => inr(r.netPay) },
              { id: 'status', label: 'Status', width: 120, render: (r) => <Chip size="small" label={r.status} color={r.status === 'PAID' ? 'success' : 'default'} /> },
            ]} 
            hideToolbar
          />
        )}
      </Box>
    </Box>
  );
};

StaffProfilePage.propTypes = {
  userId: PropTypes.string.isRequired,
  onClose: PropTypes.func,
};

export default StaffProfilePage;
