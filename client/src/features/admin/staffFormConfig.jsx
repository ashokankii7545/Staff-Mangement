import { z } from 'zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PageAccessMatrix from './components/PageAccessMatrix';
import StaffPhotoPicker from './components/StaffPhotoPicker';

/**
 * staffFormConfig – SINGLE SOURCE OF TRUTH for the "Add / Edit Staff" forms.
 * Consumed by BOTH StaffManagement (full page) and QuickAddStaffModal, so the
 * two can never drift apart again (this split previously shipped a real bug:
 * Quick Add wrote `assignedOffice` while the server expects `officeId`).
 */

export const BLANK_STAFF_FORM = {
  name: '', email: '', password: '', role: 'STAFF', officeId: '', avatarBase64: null,
};

const photoField = {
  name: 'avatarBase64',
  type: 'custom',
  label: 'Profile Photo',
  gridSize: { xs: 12 },
  render: ({ value, onChange }) => (
    <Box sx={{ mb: 1, width: '100%' }}>
      <Alert severity="info" icon={<CameraAltIcon fontSize="inherit" />} sx={{ mb: 2 }}>
        Add a clear front-facing photo – attendance selfies are face-verified against it.
      </Alert>
      <StaffPhotoPicker value={value} onChange={onChange} />
    </Box>
  ),
};

/** Quick-Add variant of the photo field (photo is MANDATORY there). */
const requiredPhotoField = {
  ...photoField,
  helperText: 'Face verification at punch time depends on this photo.',
};

export const ADD_STAFF_FIELDS = (officeOptions) => [
  photoField,
  { name: 'name', type: 'text', label: 'Full Name', required: true, gridSize: { xs: 12, sm: 6 } },
  { name: 'email', type: 'email', label: 'Email', required: true, gridSize: { xs: 12, sm: 6 } },
  { name: 'password', type: 'password', label: 'Password', required: true, gridSize: { xs: 12, sm: 6 } },
  {
    name: 'role',
    type: 'select',
    label: 'System Role',
    options: [{ value: 'STAFF', label: 'Staff' }, { value: 'ADMIN', label: 'Admin' }],
    gridSize: { xs: 12, sm: 6 },
  },
  {
    name: 'officeId',
    type: 'select',
    label: 'Assigned Base Site',
    options: [{ value: '', label: 'Default / Head Office' }, ...officeOptions],
    gridSize: { xs: 12 },
  },
];

export const EDIT_STAFF_FIELDS = (officeOptions) => [
  // Accordion sections – the long edit dialog reads as short, scannable pages
  { type: 'section', label: 'Personal Details' },
  { name: 'name', type: 'text', label: 'Full Name', gridSize: { xs: 12, sm: 6 } },
  { name: 'email', type: 'email', label: 'Email', gridSize: { xs: 12, sm: 6 } },
  {
    name: 'role',
    type: 'select',
    label: 'System Role',
    options: [{ value: 'STAFF', label: 'Staff' }, { value: 'ADMIN', label: 'Admin' }],
    gridSize: { xs: 12, sm: 6 },
  },
  { type: 'section', label: 'Site & Shift' },
  {
    name: 'officeId',
    type: 'select',
    label: 'Assigned Base Site',
    options: [{ value: '', label: 'Default / Head Office' }, ...officeOptions],
    gridSize: { xs: 12, sm: 6 },
  },
  { name: 'shiftStartTime', type: 'time', label: 'Shift Start (Optional)', gridSize: { xs: 12, sm: 6 } },
  { name: 'shiftEndTime', type: 'time', label: 'Shift End (Optional)', gridSize: { xs: 12, sm: 6 } },
  { type: 'section', label: 'Leave Balances', defaultExpanded: false },
  { name: 'casual', type: 'number', label: 'Casual Leaves', gridSize: { xs: 12, sm: 4 } },
  { name: 'sick', type: 'number', label: 'Sick Leaves', gridSize: { xs: 12, sm: 4 } },
  { name: 'earned', type: 'number', label: 'Earned Leaves', gridSize: { xs: 12, sm: 4 } },
  // Per-account page visibility – ON by default for every page, admin
  // withdraws specific ones (stored as user.restrictedPages route keys)
  { type: 'section', label: 'Page Access', defaultExpanded: false },
  {
    name: 'restrictedPages',
    type: 'custom',
    label: 'Page Access',
    gridSize: { xs: 12 },
    render: ({ value, onChange }) => <PageAccessMatrix value={value} onChange={onChange} />,
  },
];

/** Quick Add requires a hire photo + stricter password policy up-front. */
export const QUICK_ADD_STAFF_SCHEMA = z.object({
  name: z.string().min(1, 'Full Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Za-z]/, 'Must include a letter')
    .regex(/[0-9]/, 'Must include a number'),
  avatarBase64: z.string().min(1, 'Profile photo is required'),
});

export { requiredPhotoField };
