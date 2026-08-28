import { useMemo, useState } from 'react';
import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import LocalPharmacyOutlinedIcon from '@mui/icons-material/LocalPharmacyOutlined';

import { useNavigate } from 'react-router-dom';
import { useAppQuery, useAppMutation } from '../../../shared/hooks';
import {
  GET_PENDING_USERS,
  GET_ALL_LEAVE_REQUESTS,
  GET_ALL_REGULARIZATIONS,
  GET_ALL_DOCUMENTS,
  GET_ALL_MEDICINE_REQUESTS,
} from '../../../graphql/queries';
import {
  REVIEW_USER_SIGNUP,
  REVIEW_LEAVE_REQUEST,
  REVIEW_REGULARIZATION,
  REVIEW_DOCUMENT,
  REVIEW_MEDICINE_REQUEST,
} from '../../../graphql/mutations';
import { AppButton, StatusBadge, EmptyState, DataListSkeleton, ReviewDialog, useNotification } from '../../../shared/ui';

/**
 * ActionCenter – the dashboard command center. One panel that surfaces EVERY
 * pending item an admin must act on (signups, leaves, regularizations,
 * documents, medicine requests) and lets them approve/reject inline without
 * leaving the page. Each work-type is described declaratively (DRY) so the
 * list, counts, quick-approve and review-dialog logic are shared.
 */

const POLL = 15000;

const ActionCenter = () => {
  const notify = useNotification();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [review, setReview] = useState(null); // { type, item }

  // ── One query per work-type (all pending-only) ──────────────────────────
  const signups = useAppQuery(GET_PENDING_USERS, { fetchPolicy: 'cache-and-network', pollInterval: POLL });
  const leaves = useAppQuery(GET_ALL_LEAVE_REQUESTS, { variables: { status: 'PENDING' }, fetchPolicy: 'cache-and-network', pollInterval: POLL });
  const regs = useAppQuery(GET_ALL_REGULARIZATIONS, { variables: { status: 'PENDING' }, fetchPolicy: 'cache-and-network', pollInterval: POLL });
  const docsQ = useAppQuery(GET_ALL_DOCUMENTS, { fetchPolicy: 'cache-and-network', pollInterval: POLL });
  const medsQ = useAppQuery(GET_ALL_MEDICINE_REQUESTS, { variables: { status: 'PENDING' }, fetchPolicy: 'cache-and-network', pollInterval: POLL });

  const pendingDocs = useMemo(
    () => (docsQ.data?.allDocuments || []).filter((d) => d.status === 'PENDING'),
    [docsQ.data],
  );

  // ── Mutations (inline approve/reject) ───────────────────────────────────
  const onDone = (msg, refetch) => {
    notify.success(msg);
    refetch?.();
    setReview(null);
  };
  const onFail = (e) => notify.error(e.message);

  const [reviewSignup, { loading: l1 }] = useAppMutation(REVIEW_USER_SIGNUP, { onCompleted: () => onDone('Signup reviewed', signups.refetch), onError: onFail });
  const [reviewLeave, { loading: l2 }] = useAppMutation(REVIEW_LEAVE_REQUEST, { onCompleted: () => onDone('Leave reviewed', leaves.refetch), onError: onFail });
  const [reviewReg, { loading: l3 }] = useAppMutation(REVIEW_REGULARIZATION, { onCompleted: () => onDone('Regularization reviewed', regs.refetch), onError: onFail });
  const [reviewDoc, { loading: l4 }] = useAppMutation(REVIEW_DOCUMENT, { onCompleted: () => onDone('Document reviewed', docsQ.refetch), onError: onFail });
  const [reviewMed, { loading: l5 }] = useAppMutation(REVIEW_MEDICINE_REQUEST, { onCompleted: () => onDone('Request reviewed', medsQ.refetch), onError: onFail });
  const reviewing = l1 || l2 || l3 || l4 || l5;

  // ── Declarative config: ONE shape drives every tab (DRY) ────────────────
  const SECTIONS = [
    {
      key: 'signups',
      label: 'Signups',
      icon: PersonAddAlt1Icon,
      query: signups,
      items: signups.data?.pendingUsers || [],
      title: (u) => u.name,
      subtitle: (u) => `${u.employeeId || 'New'} · ${u.email}`,
      quick: true, // supports one-click approve/reject
      approve: (u) => reviewSignup({ variables: { id: u.id, status: 'APPROVED', note: 'Approved from dashboard' } }),
      reject: (u) => reviewSignup({ variables: { id: u.id, status: 'REJECTED', note: 'Rejected from dashboard' } }),
      link: '/staff',
    },
    {
      key: 'leaves',
      label: 'Leaves',
      icon: EventNoteIcon,
      query: leaves,
      items: leaves.data?.allLeaveRequests || [],
      title: (r) => r.user?.name,
      subtitle: (r) => `${r.leaveType} · ${r.startDate === r.endDate ? dayjs(r.startDate).format('DD MMM') : `${dayjs(r.startDate).format('DD MMM')} – ${dayjs(r.endDate).format('DD MMM')}`}`,
      meta: (r) => r.reason,
      quick: true,
      approve: (r) => reviewLeave({ variables: { id: r.id, status: 'APPROVED', adminFeedback: 'Approved' } }),
      reject: (r) => reviewLeave({ variables: { id: r.id, status: 'REJECTED', adminFeedback: 'Declined' } }),
      link: '/approvals',
    },
    {
      key: 'regs',
      label: 'Regularizations',
      icon: EditCalendarIcon,
      query: regs,
      items: regs.data?.allRegularizations || [],
      title: (r) => r.user?.name,
      subtitle: (r) => `${dayjs(r.date).format('DD MMM YYYY')} · ${r.checkInTime || '—'}–${r.checkOutTime || '—'}`,
      meta: (r) => r.reason,
      quick: true,
      approve: (r) => reviewReg({ variables: { id: r.id, status: 'APPROVED', adminFeedback: 'Approved' } }),
      reject: (r) => reviewReg({ variables: { id: r.id, status: 'REJECTED', adminFeedback: 'Declined' } }),
      link: '/approvals',
    },
    {
      key: 'docs',
      label: 'Documents',
      icon: DescriptionOutlinedIcon,
      query: docsQ,
      items: pendingDocs,
      title: (d) => d.title,
      subtitle: (d) => `${d.uploadedBy?.name || '—'} · ${d.category}`,
      openHref: (d) => d.fileUrl,
      // Verify/reject needs the doc-specific verb → route through the review dialog.
      review: {
        title: 'Review Document',
        options: [{ value: 'VERIFIED', label: 'Verify' }, { value: 'REJECTED', label: 'Reject' }],
        initial: 'VERIFIED',
        details: (d) => [{ label: 'Document', value: `${d.title} (${d.category})` }],
        submit: (d, decision, feedback) => reviewDoc({ variables: { id: d.id, status: decision, adminFeedback: feedback } }),
      },
      link: '/documents',
    },
    {
      key: 'meds',
      label: 'Medicine',
      icon: LocalPharmacyOutlinedIcon,
      query: medsQ,
      items: medsQ.data?.allMedicineRequests || [],
      title: (m) => m.medicineName,
      subtitle: (m) => `${m.requestedBy?.name || '—'} · ${m.quantity} ${m.unit}${m.isNewMedicine ? ' · NEW' : ''}`,
      meta: (m) => m.notes,
      review: {
        title: 'Review Stock Request',
        options: [{ value: 'ORDERED', label: 'Mark Ordered' }, { value: 'SUPPLIED', label: 'Mark Supplied' }, { value: 'REJECTED', label: 'Reject' }],
        initial: 'ORDERED',
        details: (m) => [{ label: 'Medicine', value: `${m.medicineName} · ${m.quantity} ${m.unit}` }],
        submit: (m, decision, feedback) => reviewMed({ variables: { id: m.id, status: decision, adminFeedback: feedback } }),
      },
      link: '/stock',
    },
  ];

  const totalPending = SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const active = SECTIONS[tab];
  const loading = active.query.loading && active.items.length === 0;
  const errored = !!active.query.error && active.items.length === 0;

  // Fixed body height keeps the panel the same size on every tab and whether it
  // holds 0 or 20 items – no collapsing gap next to the taller insights column.
  const BODY_H = 380;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ flexShrink: 0, px: 2.5, pt: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <TaskAltIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Needs your attention</Typography>
          {totalPending > 0 && <StatusBadge status="WARNING" label={`${totalPending} pending`} size="small" />}
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mt: 1, minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
        >
          {SECTIONS.map((s) => (
            <Tab
              key={s.key}
              icon={
                <Badge badgeContent={s.items.length} color="error" max={99}>
                  <s.icon fontSize="small" />
                </Badge>
              }
              iconPosition="start"
              label={s.label}
            />
          ))}
        </Tabs>
      </Box>

      {/* Body – grows to fill the column, with a floor so it never collapses */}
      <CardContent sx={{ p: 0, flex: 1, minHeight: BODY_H, overflowY: 'auto', '&:last-child': { pb: 0 } }}>
        {loading ? (
          <Box sx={{ p: 2 }}><DataListSkeleton rows={4} /></Box>
        ) : errored ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState
              variant="error"
              title={`Couldn't load ${active.label.toLowerCase()}`}
              description={active.query.errorMessage || 'Please try again.'}
              action={<AppButton variant="outlined" onClick={() => active.query.refetch()}>Retry</AppButton>}
            />
          </Box>
        ) : active.items.length === 0 ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState icon={TaskAltIcon} title={`No pending ${active.label.toLowerCase()}`} description="You're all caught up here." />
          </Box>
        ) : (
          <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
            {active.items.map((item) => (
              <Stack key={item.id} direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 1.25 }}>
                <Avatar
                  src={item.user?.avatar || item.uploadedBy?.avatar || item.requestedBy?.avatar}
                  sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.8125rem', fontWeight: 600 }}
                >
                  {String(active.title(item) || '?').charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{active.title(item)}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">{active.subtitle(item)}</Typography>
                  {active.meta?.(item) && (
                    <Typography variant="caption" color="text.disabled" noWrap display="block">“{active.meta(item)}”</Typography>
                  )}
                </Box>

                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                  {active.openHref && (
                    <Tooltip title="Open">
                      <IconButton size="small" component="a" href={active.openHref(item)} target="_blank" rel="noopener">
                        <OpenInNewIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {active.quick ? (
                    <>
                      <Tooltip title="Approve">
                        <span>
                          <IconButton size="small" color="success" disabled={reviewing} onClick={() => active.approve(item)}>
                            <CheckIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Reject">
                        <span>
                          <IconButton size="small" color="error" disabled={reviewing} onClick={() => active.reject(item)}>
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  ) : (
                    <AppButton size="small" variant="outlined" onClick={() => setReview({ section: active, item })}>
                      Review
                    </AppButton>
                  )}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>

      {/* Footer: jump to the full queue for the active tab */}
      <Box sx={{ flexShrink: 0, px: 2.5, py: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
        <AppButton size="small" variant="text" onClick={() => navigate(active.link)}>
          Open {active.label} →
        </AppButton>
      </Box>

      {/* Shared review dialog (documents / medicine – multi-outcome) */}
      {review?.section?.review && (
        <ReviewDialog
          open
          onClose={() => setReview(null)}
          title={review.section.review.title}
          loading={reviewing}
          details={review.section.review.details(review.item)}
          options={review.section.review.options}
          initialDecision={review.section.review.initial}
          onSubmit={(decision, feedback) => review.section.review.submit(review.item, decision, feedback)}
        />
      )}
    </Card>
  );
};

export default ActionCenter;
