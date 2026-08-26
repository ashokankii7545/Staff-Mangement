/**
 * ============================================================================
 * ENTITY CATALOG – single source of truth for tables & schemas
 * ============================================================================
 * Har module ki table/schema yahan define hoti hai. Grids aur forms isi
 * catalog se apne columns/fields derive karte hain – duplicate definitions
 * khatam. Naya module? Yahan entry add karo, page sirf compose karta hai.
 *
 *   import { signupGridColumns, userEntity } from '<shared>/catalog/entities';
 *   <GenericDataGrid columns={signupGridColumns(handleApprove, handleReject)} />
 *
 * Column shape = GenericDataGrid contract:
 *   { id, label, width?, align?, sortable?, valueGetter?, render?, exportValue? }
 * Field shape = GenericFormEngine contract:
 *   { name, label, type, required?, options?, helperText?, gridSize? }
 */
import dayjs from 'dayjs';
import { createElement as h } from 'react';
import Typography from '@mui/material/Typography';

// ── Shared vocabularies ──────────────────────────────────────────────────────


export const ROLES = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'ADMIN', label: 'Admin' },
];

export const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// ── USER / STAFF ─────────────────────────────────────────────────────────────
export const userEntity = {
  id: 'user',
  label: 'Staff',
  /** Canonical schema – forms derive from this */
  fields: [
    { name: 'employeeId', label: 'Employee ID', type: 'text', required: true },
    { name: 'name', label: 'Full Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', helperText: 'Required for Google Sign-in' },
    { name: 'password', label: 'Password', type: 'password' },
        { name: 'role', label: 'Role', type: 'select', defaultValue: 'STAFF', options: ROLES },
    { name: 'officeId', label: 'Assigned Site', type: 'select', helperText: 'If none, uses global settings' },
  ],
  /** Base roster columns – pages append computed/action columns on top */
  gridColumns: [
    { id: 'employeeId', label: 'Emp ID', width: 120 },
    { id: 'name', label: 'Name', width: 200 },
    { id: 'email', label: 'Email', width: 220, sortable: false },
      ],
};

// ── PENDING SIGNUPS (admin approval queue) ───────────────────────────────────
export const signupGridColumns = ({ onApprove, onReject }) => [
  { id: 'employeeId', label: 'Emp ID', width: 120 },
  { id: 'name', label: 'Name', width: 180 },
  { id: 'email', label: 'Email', width: 240, sortable: false },
    {
    id: 'loginMethod',
    label: 'Method',
    width: 110,
    align: 'center',
    sortable: false,
    // render injected by caller if custom badge needed; default plain text
    render: null,
  },
  {
    id: 'createdAt',
    label: 'Requested On',
    width: 140,
    valueGetter: (row) => dayjs(row.createdAt).format('DD MMM YYYY'),
    render: (row) =>
      h(Typography, { variant: 'body2' }, dayjs(row.createdAt).format('DD MMM YYYY')),
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 200,
    sortable: false,
    render: (row) => {
      const kids = [];
      if (onApprove) {
        kids.push(
          h(
            'button',
            { key: 'a', type: 'button', onClick: () => onApprove(row), style: { marginRight: 8 } },
            'Approve'
          )
        );
      }
      if (onReject) {
        kids.push(
          h('button', { key: 'r', type: 'button', onClick: () => onReject(row) }, 'Reject')
        );
      }
      return h('div', { style: { display: 'flex', gap: 8 } }, kids);
    },
  },
];

// ── LEAVE REQUESTS ───────────────────────────────────────────────────────────
export const leaveEntity = {
  id: 'leaveRequest',
  label: 'Leave Request',
  fields: [
    {
      name: 'leaveType',
      label: 'Leave Type',
      type: 'select',
      required: true,
      options: [
        { value: 'CASUAL', label: 'Casual Leave' },
        { value: 'SICK', label: 'Sick Leave' },
        { value: 'EARNED', label: 'Earned Leave' },
      ],
    },
    { name: 'startDate', label: 'From', type: 'date', required: true },
    { name: 'endDate', label: 'To', type: 'date', required: true },
    { name: 'reason', label: 'Reason', type: 'text', multiline: true, required: true },
  ],
};

export default {
    ROLES,
  WEEK_DAYS,
  userEntity,
  signupGridColumns,
  leaveEntity,
};
