/** Indian medicine GST slabs (HSN 3004) – mirrors server constants. */
export const MEDICINE_GST_RATES = [0, 5, 12];

/**
 * Pharmacy-grade medicine master vocabulary – mirrors the server contract in
 * server/src/config/constants.ts (Drugs & Cosmetics Act schedules, dosage
 * forms & therapeutic classes used by Indian retail pharmacy software).
 */
export const MEDICINE_DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Drops',
  'Injection',
  'Cream / Ointment / Gel',
  'Inhaler',
  'Sachet / Powder',
  'Lozenges',
  'Other',
];

export const MEDICINE_SCHEDULES = [
  { value: 'OTC', label: 'OTC – No prescription needed' },
  { value: 'H', label: 'Schedule H (Prescription required)' },
  { value: 'H1', label: 'Schedule H1 (Prescription + register)' },
  { value: 'X', label: 'Schedule X (Prescription retained)' },
];

export const MEDICINE_CATEGORIES = [
  'Analgesic / Antipyretic',
  'Antibiotic',
  'Antacid / GI',
  'Antiallergic',
  'Antihypertensive',
  'Antidiabetic',
  'Multivitamin / Supplement',
  'Respiratory / Cough & Cold',
  'Skin / Dermatology',
  'Other',
];

/** Schedule H/H1/X legally need a prescription; OTC doesn't. */
export const isPrescriptionRequired = (schedule) => schedule && schedule !== 'OTC';

export const DRAWER_WIDTH = 260;

/** Mini-rail width when the sidebar is collapsed on desktop */
export const DRAWER_COLLAPSED_WIDTH = 76;

export const STATUS_COLORS = {
  PRESENT: { color: 'success.main', bg: 'success.light', label: 'Present' },
  LATE: { color: 'warning.main', bg: 'warning.light', label: 'Late' },
  HALF_DAY: { color: 'secondary.main', bg: 'secondary.light', label: 'Half Day' },
  ABSENT: { color: 'error.main', bg: 'error.light', label: 'Absent' },
  HOLIDAY: { color: 'info.main', bg: 'info.light', label: 'Holiday' },
};

export const NAV_ITEMS_STAFF = [
  { label: 'Dashboard', path: '/', icon: 'Dashboard' },
  { label: 'My Profile', path: '/profile', icon: 'Person' },
  { label: 'Mark Attendance', path: '/attendance', icon: 'CameraAlt' },
  { label: 'Stock Requests', path: '/stock', icon: 'LocalPharmacy' },
  { label: 'My History', path: '/history', icon: 'History' },
  { label: 'My Leaves', path: '/leaves', icon: 'EventNote' },
  // "My Documents" removed – staff manage documents inside My Profile → Overview.
];

export const NAV_ITEMS_ADMIN = [
  { label: 'Dashboard', path: '/', icon: 'Dashboard' },
  { label: 'All Records', path: '/history', icon: 'History' },
  { label: 'Approvals', path: '/approvals', icon: 'FactCheck' },
  { label: 'Staff Management', path: '/staff', icon: 'People' },
  { label: 'Sites', path: '/offices', icon: 'LocationOn' },
  { label: 'Holidays', path: '/holidays', icon: 'Event' },
  { label: 'Stock Requests', path: '/stock', icon: 'LocalPharmacy' },
  { label: 'Medicine Catalog', path: '/medicines', icon: 'Medication' },
  { label: 'Documents', path: '/documents', icon: 'FolderShared' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
];

/**
 * Every first-class page with its route key – single source of truth for the
 * per-staff Page-Access matrix (Staff Management → Edit → Page Access).
 * Access model: DEFAULT = ALL pages open. Admins WITHDRAW specific pages by
 * adding their `key` to a user's restrictedPages[].
 * The Dashboard ('/') is locked-open so no one can ever lock themselves out
 * of the app's home fallback.
 */
export const PAGE_CATALOG = [
  { key: '/', label: 'Dashboard', icon: 'Dashboard', locked: true },
  { key: '/attendance', label: 'Mark Attendance', icon: 'CameraAlt' },
  { key: '/history', label: 'History / Records', icon: 'History' },
  { key: '/leaves', label: 'My Leaves', icon: 'EventNote' },
  { key: '/stock', label: 'Stock Requests', icon: 'LocalPharmacy' },
  { key: '/documents', label: 'Documents', icon: 'FolderShared' },
  { key: '/admin', label: 'Admin Overview', icon: 'AdminPanelSettings' },
  { key: '/staff', label: 'Staff Management', icon: 'People' },
  { key: '/offices', label: 'Sites', icon: 'LocationOn' },
  { key: '/holidays', label: 'Holidays', icon: 'Event' },
  { key: '/approvals', label: 'Approvals', icon: 'FactCheck' },
  { key: '/medicines', label: 'Medicine Catalog', icon: 'Medication' },
  { key: '/settings', label: 'Global Settings', icon: 'Settings' },
];

/**
 * Canonical display names for every first-class route.
 * Single source of truth used by the Topbar to auto-derive the breadcrumb
 * trail – guarantees crumbs can never point at dead routes like /dashboard.
 */
export const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/attendance': 'Mark Attendance',
  '/history': 'Attendance History',
  '/leaves': 'My Leaves',
  '/stock': 'Stock Requests',
  '/medicines': 'Medicine Catalog',
  '/documents': 'Documents',
  '/admin': 'Admin Overview',
  '/staff': 'Staff Management',
  '/offices': 'Sites',
  '/holidays': 'Holidays',
  '/approvals': 'Approvals',
  '/settings': 'Settings',
};

/**
 * Build a breadcrumb trail from a pathname.
 * Returns [{ label, href }] excluding the root (the Topbar renders the root
 * as a Home-icon crumb). Unknown segments fall back to a Title-Cased slug so
 * deep links never render raw URLs.
 */
export const getBreadcrumbTrail = (pathname) => {
  if (!pathname || pathname === '/') return [];
  const segments = pathname.split('/').filter(Boolean);
  let accumulated = '';
  return segments.map((segment) => {
    accumulated += `/${segment}`;
    const label =
      ROUTE_TITLES[accumulated] ||
      segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { label, href: accumulated };
  });
};


