import Notification from '../models/Notification.js';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/environment.js';
import User from '../models/User.js';
import { saveBase64Image } from '../utils/fileUpload.js';
import { ValidationError, AuthenticationError, ForbiddenError } from '../utils/errors.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { pushNotification, notifyAdmins } from './notification.service.js';
import { initialBalancesForNewHire } from './leaveAccrual.service.js';
import {
  sendStaffWelcomeEmail,
  sendSignupRejectionEmail,
  sendUserApprovalEmail,
} from './mail.service.js';

const googleClient = new OAuth2Client(config.googleClientId);

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// ── SECURITY HELPERS ────────────────────────────────────────────────────────
/**
 * Normalize an email so trivial aliases cannot farm duplicate accounts.
 * Gmail ignores dots locally and treats "+tag" as an alias:
 *   rahul.sharma+12@gmail.com → rahulsharma@gmail.com   (canonical form)
 * Other providers only get the "+tag" stripped.
 */
export const normalizeEmail = (raw) => {
  const email = String(raw || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at === -1) return email;
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    local = local.split('+')[0].replace(/\./g, '');
  } else if (local.includes('+')) {
    local = local.split('+')[0];
  }
  return `${local}@${domain}`;
};

/** Throwaway inbox providers commonly used to farm PENDING approval spam */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com',
  'guerrillamail.com', 'yopmail.com', 'trashmail.com', 'getnada.com',
  'dispostable.com', 'sharklasers.com', 'throwawaymail.com',
]);

const assertNotDisposable = (email) => {
  const domain = String(email).split('@')[1] || '';
  if (DISPOSABLE_DOMAINS.has(domain)) {
    throw ValidationError('Disposable or temporary email providers are not allowed.');
  }
};

/** Password policy – minimum 8 chars with letters AND numbers */
const assertStrongPassword = (password) => {
  const p = String(password || '');
  if (p.length < 8) {
    throw ValidationError('Password must be at least 8 characters long.');
  }
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    throw ValidationError('Password must contain both letters and numbers.');
  }
};

export const APPROVAL_PENDING_MSG =
  'Your account is awaiting admin approval. You will be able to log in once an administrator approves your request.';
const APPROVAL_REJECTED_MSG = 'Your access request was rejected by an administrator.';

/**
 * Login gate #2 (after credentials): account must be ACTIVE and APPROVED.
 * Self signups (password OR first-time Google) stay PENDING until an admin approves.
 */
const assertCanLogin = (user) => {
  if (!user.isActive) {
    throw ForbiddenError('Your account has been deactivated. Please contact your administrator.');
  }
  if (user.approvalStatus === 'PENDING') {
    throw new GraphQLError(APPROVAL_PENDING_MSG, { extensions: { code: 'APPROVAL_PENDING' } });
  }
  if (user.approvalStatus === 'REJECTED') {
    throw new GraphQLError(
      user.approvalNote ? `${APPROVAL_REJECTED_MSG} Note: ${user.approvalNote}` : APPROVAL_REJECTED_MSG,
      { extensions: { code: 'APPROVAL_REJECTED' } }
    );
  }
};

const assertValidNewAccount = async ({ employeeId, email }) => {
  if (employeeId) {
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(employeeId)) {
      throw ValidationError('Employee ID must be 3-20 characters (letters, numbers, - or _).');
    }
    const existing = await User.findOne({ employeeId });
    if (existing) {
      if (existing.approvalStatus === 'REJECTED') {
        await User.deleteOne({ _id: existing._id });
      } else {
        throw ValidationError(`Employee ID "${employeeId}" is already registered.`);
      }
    }
  }
  if (email) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.approvalStatus === 'REJECTED') {
        await User.deleteOne({ _id: existing._id });
      } else {
        throw ValidationError(`Email "${email}" is already registered.`);
      }
    }
  }
};

// ── EMPLOYEE-ID SCHEME ──────────────────────────────────────────────────────
// Derived straight from the LOGIN EMAIL – no opaque counters like EMP0001:
//
//   rahul.sharma@gmail.com  →  EMP-RAHULSHARMA      (staff)
//   manish@company.com      →  EMP-MANISH           (staff)
//   tgayn065@gmail.com      →  ADM-TGAYN065         (admin)
//
// Every account's email is already unique, so the handle is unique by
// construction – numbered suffixes (…2, …3) appear ONLY in the rare case
// where sanitization/truncation collides two handles.
// Legacy IDs (ADMIN001, EMP0001…) stay valid; login matches exact strings.

const ROLE_PREFIXES = { STAFF: 'EMP', ADMIN: 'ADM' };
const MAX_HANDLE_CHARS = 14; // keeps IDs ≤ 18 chars (schema allows up to 20)

const sanitizeHandle = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_HANDLE_CHARS);

/** Email local-part first, first name word second, timestamp as last resort */
export const deriveEmployeeHandle = ({ name, email } = {}) => {
  const emailLocal = String(email || '').split('@')[0];
  return (
    sanitizeHandle(emailLocal) ||
    sanitizeHandle(String(name || '').split(/\s+/)[0]).slice(0, 8) ||
    `U${Date.now().toString().slice(-7)}`
  );
};

/** Auto-generate a unique employee ID from the hire's email (fallback: name) */
export const generateEmployeeId = async (role = 'STAFF', identity = {}) => {
  const prefix = ROLE_PREFIXES[role] || ROLE_PREFIXES.STAFF;
  const base = `${prefix}-${deriveEmployeeHandle(identity)}`;

  // Email uniqueness ⇒ the very first candidate almost always wins
  if (!(await User.exists({ employeeId: base }))) return base;

  for (let n = 2; n <= 998; n += 1) {
    const candidate = `${base}${n}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await User.exists({ employeeId: candidate }))) return candidate;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
};

/**
 * Mint an Employee ID and create the user. On the rare concurrent race where
 * another registration claims the same sequence (unique-index error 11000),
 * regenerate once and retry instead of failing the request.
 */
const persistWithUniqueEmployeeId = async ({ role, identity, buildUser }) => {
  let employeeId = await generateEmployeeId(role, identity);
  try {
    return await User.create(buildUser(employeeId));
  } catch (err) {
    if (err?.code !== 11000) throw err; // duplicate key on some other field
    employeeId = await generateEmployeeId(role, identity);
    return User.create(buildUser(employeeId));
  }
};

// ────────────────────────────────────────────────────────────────────────────
// AUTH FLOWS
// ────────────────────────────────────────────────────────────────────────────

/** Employee ID + password login. Blocked unless APPROVED + ACTIVE. */
export const loginUser = async ({ employeeId, password, ip }) => {
  checkRateLimit(`login:${ip}:${String(employeeId || '').toUpperCase()}`);

  const user = await User.findOne({ employeeId: String(employeeId).trim().toUpperCase() });
  if (!user || !user.password) {
    throw AuthenticationError('Invalid Employee ID or password.');
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    throw AuthenticationError('Invalid Employee ID or password.');
  }

  assertCanLogin(user);
  return { token: signToken(user), user };
};

/**
 * Google One-Tap / button login.
 *  - New Google account → PENDING user created, admins notified; blocked until approval.
 *  - Existing by email  → googleId linked (Google verified the address), same approval gate.
 */
export const googleLogin = async ({ credential, ip }) => {
  checkRateLimit(`google:${ip}`);

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: config.googleClientId,
  });
  const profile = ticket.getPayload();

  if (!profile?.email || profile.email_verified === false) {
    throw AuthenticationError('Google account email could not be verified.');
  }

  const email = profile.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] });

  if (!user) {
    throw AuthenticationError('Email not registered. Please sign up or contact an Administrator.');
  } else if (!user.googleId) {
    // Email matched an existing account - safe to link because Google verified it
    user.googleId = profile.sub;
    if (!user.avatar && profile.picture) user.avatar = profile.picture;
    await user.save();
  }

  assertCanLogin(user);
  return { token: signToken(user), user };
};

/** Admin-created staff - APPROVED instantly, optional hire photo saved as avatar */
export const registerStaff = async (input) => {
  const role = input.role === 'ADMIN' ? 'ADMIN' : 'STAFF';

  const email = normalizeEmail(input.email || '');
  assertStrongPassword(input.password);
  await assertValidNewAccount({ email });

  // New hires START on the company leave policy (CL for this month +
  // full-year SL upfront; EL joins the next annual credit)
  const startingBalances = await initialBalancesForNewHire();

  const createdUser = await persistWithUniqueEmployeeId({
    role,
    identity: { name: input.name, email },
    buildUser: (employeeId) => ({
      employeeId,
      name: String(input.name).trim(),
      email: email || `${employeeId.toLowerCase()}@company.com`,
      password: String(input.password),
      role,
      assignedOffice: input.officeId || null,
      approvalStatus: 'APPROVED', // admin vouches for this person
      leaveBalances: startingBalances,
      ...(input.avatarBase64 && {
        avatar: saveBase64Image(input.avatarBase64, `staff-${employeeId}-${Date.now()}`),
      }),
    }),
  });

  // Welcome the new hire over email (fire-and-forget – never block signup)
  sendStaffWelcomeEmail(createdUser).catch(console.error);

  return createdUser;
};

/** Public self-signup - PENDING account + admins notified */
export const signupUser = async ({ name, email, password, avatarBase64, ip }) => {
  checkRateLimit(`signup:${ip}`);

  // Alias-normalize (Gmail dots/+tags) BEFORE any duplicate lookup – blocks
  // infinite "user+1@ / user+2@" style account farming.
  const cleanEmail = normalizeEmail(email);
  assertNotDisposable(cleanEmail);
  assertStrongPassword(password);
  await assertValidNewAccount({ email: cleanEmail });

  const startingBalances = await initialBalancesForNewHire();

  const user = await persistWithUniqueEmployeeId({
    role: 'STAFF',
    identity: { name, email: cleanEmail },
    buildUser: (employeeId) => ({
      employeeId,
      name: String(name).trim(),
      email: cleanEmail,
      password: String(password),
      role: 'STAFF',
      loginMethod: 'PASSWORD',
      approvalStatus: 'PENDING',
      leaveBalances: startingBalances,
      ...(avatarBase64 && {
        avatar: saveBase64Image(avatarBase64, `staff-${employeeId}-${Date.now()}`),
      }),
    }),
  });

  await notifyAdmins({
    type: 'SIGNUP_REQUEST',
    title: 'New signup awaiting approval',
    message: `${user.name} has requested access to the system.`,
    link: '/approvals#signups',
    pill: { label: 'NEW SIGNUP', tone: 'info' },
    rows: [
      ['Name', user.name],
      ['Email', cleanEmail],
      ['Requested ID', user.employeeId],
    ],
    noteText: 'Please review and approve this account to grant access.',
  });

  return {
    success: true,
    message:
      'Signup request submitted! You can log in once an administrator approves your account.',
  };
};

/** Admin decision on a pending signup – requester is notified in-app */
export const reviewUserSignup = async (userId, status, note, officeId) => {
  const target = await User.findById(userId);
  if (!target) throw ValidationError('User not found.');
  if (target.role === 'ADMIN') throw ForbiddenError('Admin accounts cannot be reviewed here.');

  target.approvalStatus = status;
  target.approvalNote = note || '';
  if (status === 'APPROVED') {
    if (officeId) target.assignedOffice = officeId;
    target.isActive = true;
    sendUserApprovalEmail(target).catch(console.error);
  }
  if (status === 'REJECTED') {
    target.isActive = false;
    sendSignupRejectionEmail(target, note).catch(console.error);
  }

  await target.save();

  // Delete the signup request notifications for all admins
  await Notification.deleteMany({ 'meta.userId': String(target._id), type: 'SIGNUP_REQUEST' }).catch(() => {});

  await pushNotification({
    recipientIds: [target._id],
    type: 'SIGNUP_DECISION',
    title: status === 'APPROVED' ? 'Your account has been approved ✅' : 'Your access request was rejected',
    message:
      status === 'APPROVED'
        ? `Welcome aboard, ${target.name}! You can now log in with Employee ID ${target.employeeId}.`
        : note || 'Please contact your administrator for details.',
    link: '/login',
  });

  return target.populate('assignedOffice');
};

/**
 * Logged-in user rotates their own password. Accounts WITHOUT a password
 * (Google-only sign-ins) may SET one directly – no current password needed.
 */
export const changeUserPassword = async ({ userId, currentPassword, newPassword }) => {
  assertStrongPassword(newPassword);
  const user = await User.findById(userId);
  if (!user) throw new Error('Account not found.');
  if (user.password) {
    const ok = await user.comparePassword(String(currentPassword || ''));
    if (!ok) throw new Error('Current password is incorrect.');
  }
  user.password = String(newPassword);
  await user.save();
  return true;
};
