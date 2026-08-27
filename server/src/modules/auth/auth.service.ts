import { nextSequence } from '../user/counter.model.js';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/logger.js';
import {
  ApprovalPendingError,
  ApprovalRejectedError,
  AuthenticationError,
  ForbiddenError,
  ValidationError,
} from '../../shared/errors/app.errors.js';
import { checkRateLimit } from '../../shared/security/rate-limiter.util.js';
import { saveBase64Image } from '../../shared/utils/file-upload.util.js';
import { hashPassword } from '../../shared/utils/password.util.js';
import { getFaceEmbeddingFromBase64 } from '../../shared/utils/face.util.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { notificationService } from '../notification/notification.service.js';
import { userRepository } from '../user/user.repository.js';
import { signAuthToken } from '../../shared/utils/jwt.util.js';
import { verifyPassword } from '../../shared/utils/password.util.js';
import { getFaceEmbeddingFromBase64 } from '../../shared/utils/face.util.js';
import { leaveService } from '../leave/leave.service.js';
import { notificationRepository } from '../notification/notification.repository.js';
import type { IUser, IUserDocument } from '../user/user.model.js';
import type { Role } from '../../config/constants.js';

export interface AuthPayload {
  token: string;
  user: IUserDocument;
}

export interface SignUpInputShape {
  name: string;
  email: string;
  password: string;
  avatarBase64?: string | null;
}

const APPROVAL_PENDING_MSG = 'Sign-up requests stay PENDING until an administrator approves them. Login unlocks right after approval.';
const APPROVAL_REJECTED_MSG = 'Your access request was rejected by an administrator.';

/** Throwaway inbox providers commonly used to farm PENDING approval spam */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com',
  'guerrillamail.com', 'yopmail.com', 'trashmail.com', 'getnada.com',
  'dispostable.com', 'sharklasers.com', 'throwawaymail.com',
]);

// ────────────────────────────────────────────────────────────────────────────
// AUTH SERVICE – SINGLETON owner of every identity flow
// ────────────────────────────────────────────────────────────────────────────
class AuthService {
  private static instance: AuthService | null = null;

  private readonly googleClient = new OAuth2Client(env.googleClientId);

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  /**
   * Normalize an email so trivial aliases cannot farm duplicate accounts.
   * Gmail ignores dots locally and treats "+tag" as an alias:
   *   rahul.sharma+12@gmail.com → rahulsharma@gmail.com
   */
  public normalizeEmail(raw: string): string {
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
  }

  private assertNotDisposable(email: string): void {
    const domain = String(email).split('@')[1] || '';
    if (DISPOSABLE_DOMAINS.has(domain)) {
      throw new ValidationError('Disposable or temporary email providers are not allowed.');
    }
  }

  /** Password policy – minimum 8 chars with letters AND numbers */
  private assertStrongPassword(password: string): void {
    const p = String(password || '');
    if (p.length < 8) throw new ValidationError('Password must be at least 8 characters long.');
    if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
      throw new ValidationError('Password must contain both letters and numbers.');
    }
  }

  /** Login gate #2 (after credentials): account must be ACTIVE and APPROVED. */
  private assertCanLogin(user: IUserDocument): void {
    if (!user.isActive) {
      throw new ForbiddenError(
        'Your account has been deactivated. Please contact your administrator.',
      );
    }
    if (user.approvalStatus === 'PENDING') {
      throw new ApprovalPendingError(APPROVAL_PENDING_MSG);
    }
    if (user.approvalStatus === 'REJECTED') {
      throw new ApprovalRejectedError(
        user.approvalNote
          ? `${APPROVAL_REJECTED_MSG} Note: ${user.approvalNote}`
          : APPROVAL_REJECTED_MSG,
      );
    }
  }

  /** Reject duplicate accounts; auto-purge previously REJECTED signups. */
  private async assertValidNewAccount(args: { employeeId?: string; email?: string }): Promise<void> {
    if (args.employeeId) {
      if (!/^[A-Za-z0-9_-]{3,20}$/.test(args.employeeId)) {
        throw new ValidationError('Employee ID must be 3-20 characters (letters, numbers, - or _).');
      }
      const existing = await userRepository.queries.findByEmployeeId(args.employeeId);
      if (existing) {
        if (existing.approvalStatus === 'REJECTED') {
          await userRepository.queries.deleteById(String(existing._id));
        } else {
          throw new ValidationError(`Employee ID "${args.employeeId}" is already registered.`);
        }
      }
    }
    if (args.email) {
      const existing = await userRepository.queries.findByEmail(args.email.toLowerCase());
      if (existing) {
        if (existing.approvalStatus === 'REJECTED') {
          await userRepository.queries.deleteById(String(existing._id));
        } else if (existing.approvalStatus === 'PENDING') {
          if (!existing.emailVerified) {
            // Delete unverified junk account so they can sign up fresh
            await userRepository.queries.deleteById(String(existing._id));
          } else {
            throw new ValidationError('Email is already registered and is currently PENDING admin approval.');
          }
        } else {
          throw new ValidationError('Email is already registered and APPROVED. Please log in.');
        }
      }
    }
  }

  // ── EMPLOYEE-ID SCHEME ────────────────────────────────────────────────────
  // Derived straight from the LOGIN EMAIL – no opaque counters like EMP0001:
  //   rahul.sharma@gmail.com → EMP-RAHULSHARMA (staff) · ADM-… (admin)
  // Numbered suffixes appear ONLY when sanitization collides two handles.
  private readonly ROLE_PREFIXES: Record<string, string> = { STAFF: 'EMP', ADMIN: 'ADM' };
  private readonly MAX_HANDLE_CHARS = 14;

  private sanitizeHandle(value: string): string {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, this.MAX_HANDLE_CHARS);
  }

  /** Email local-part first, first name word second, timestamp as last resort */
  public deriveEmployeeHandle({ name, email }: { name?: string; email?: string } = {}): string {
    const emailLocal = String(email || '').split('@')[0];
    return (
      this.sanitizeHandle(emailLocal) ||
      this.sanitizeHandle(String(name || '').split(/\s+/)[0]).slice(0, 8) ||
      `U${Date.now().toString().slice(-7)}`
    );
  }

  /** Auto-generate a sequential unique employee ID (e.g. EMP1001) */
  public async generateEmployeeId(
    role = 'STAFF',
    identity?: { name?: string; email?: string }
  ): Promise<string> {
    const prefix = this.ROLE_PREFIXES[role] ?? this.ROLE_PREFIXES.STAFF;
    
    // Auto-increment the global employee sequence (atomic upsert in Postgres).
    const seqValue = await nextSequence('employeeId');
    // Starting at 1000: seq 1 -> 1001
    const numericPart = 1000 + seqValue;
    
    return `${prefix}${numericPart}`;
  }

  /**
   * Mint an Employee ID and create the user. On the rare concurrent race
   * (unique-constraint violation → ConflictError), regenerate once and retry
   * instead of failing.
   */
  private async persistWithUniqueEmployeeId(args: {
    role: string;
    identity: { name?: string; email?: string };
    buildUser: (employeeId: string) => Partial<IUser> | Promise<Partial<IUser>>;
  }): Promise<IUserDocument> {
    let employeeId = await this.generateEmployeeId(args.role, args.identity);
    try {
      return await userRepository.queries.create(await args.buildUser(employeeId));
    } catch (error) {
      const code = (error as { extensions?: { code?: string } }).extensions?.code;
      if (code !== 'CONFLICT') throw error; // duplicate on some other field
      employeeId = await this.generateEmployeeId(args.role, args.identity);
      return userRepository.queries.create(await args.buildUser(employeeId));
    }
  }

  /** Public: resolve a login identifier to an avatar URL for the login screen. */
  public async checkAvatar(identifier: string): Promise<string | null> {
    const user = await userRepository.queries.findByIdentifier(identifier);
    return user?.avatar || null;
  }

  // ── AUTH FLOWS ────────────────────────────────────────────────────────────

  /** Employee ID + password login. Blocked unless APPROVED + ACTIVE. */
  public async loginUser(args: {
    employeeId: string;
    password: string;
    ip?: string;
  }): Promise<AuthPayload> {
    checkRateLimit(`login:${args.ip ?? 'unknown'}:${String(args.employeeId || '').toUpperCase()}`);

    const user = await userRepository.queries.findByEmployeeId(args.employeeId);
    if (!user || !user.password) {
      throw new AuthenticationError('Invalid Employee ID or password.');
    }

    const ok = await verifyPassword(user, args.password);
    if (!ok) {
      throw new AuthenticationError('Invalid Employee ID or password.');
    }

    this.assertCanLogin(user);
    return {
      token: signAuthToken({ id: String(user._id), role: user.role as Role }),
      user,
    };
  }

  /**
   * Google One-Tap / button login.
   *  - New Google account → PENDING user created, admins notified.
   *  - Existing by email  → googleId linked (Google verified the address).
   */
  public async googleLogin(args: { credential: string; ip?: string }): Promise<AuthPayload> {
    checkRateLimit(`google:${args.ip ?? 'unknown'}`);

    const ticket = await this.googleClient.verifyIdToken({
      idToken: args.credential,
      audience: env.googleClientId,
    });
    const profile = ticket.getPayload();

    if (!profile?.email || profile.email_verified === false) {
      throw new AuthenticationError('Google account email could not be verified.');
    }

    const email = profile.email.toLowerCase();
    let user = await userRepository.queries.findByGoogleIdOrEmail(profile.sub, email);

    if (!user) {
      throw new AuthenticationError('Email not registered. Please sign up or contact an Administrator.');
    }
    if (!user.googleId) {
      // Email matched an existing account – safe to link, Google verified it.
      const patch: Partial<IUser> = { googleId: profile.sub };
      if (!user.avatar && profile.picture) patch.avatar = profile.picture;
      user = (await userRepository.queries.updateById(String(user._id), patch)) ?? user;
    }

    this.assertCanLogin(user);
    return {
      token: signAuthToken({ id: String(user._id), role: user.role as Role }),
      user,
    };
  }

  /** Admin-created staff – APPROVED instantly, optional hire photo as avatar. */
  public async registerStaff(input: {
    name: string;
    email: string;
    password: string;
    role?: string | null;
    officeId?: string | null;
    avatarBase64?: string | null;
  }): Promise<IUserDocument> {
    const role = input.role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const email = this.normalizeEmail(input.email || '');
    this.assertStrongPassword(input.password);
    await this.assertValidNewAccount({ email });

    // New hires START on the company leave policy.
    const startingBalances = await leaveService.initialBalancesForNewHire();

    const createdUser = await this.persistWithUniqueEmployeeId({
      role,
      identity: { name: input.name, email },
      buildUser: async (employeeId) => ({
        employeeId,
        name: String(input.name).trim(),
        email: email || `${employeeId.toLowerCase()}@company.com`,
        password: String(input.password),
        role,
        assignedOffice: (input.officeId || null) as never,
        approvalStatus: 'APPROVED', // admin vouches for this person
        leaveBalances: startingBalances,
        ...(input.avatarBase64 && {
          avatar: await saveBase64Image(input.avatarBase64, `staff-${employeeId}-${Date.now()}`),
        }),
      }),
    });

    // Welcome the new hire over email (fire-and-forget – never block signup).
    void mailService.sendStaffWelcomeEmail(createdUser).catch((e) => logger.error(e));
    return createdUser;
  }

  /** Public self-signup – PENDING account + admins notified. */
  public async signupUser(args: SignUpInputShape & { ip?: string }): Promise<{ success: boolean; message: string }> {
    checkRateLimit(`signup:${args.ip ?? 'unknown'}`);

    // Alias-normalize (Gmail dots/+tags) BEFORE any duplicate lookup – blocks
    // infinite "user+1@ / user+2@" style account farming.
    const cleanEmail = this.normalizeEmail(args.email);
    this.assertNotDisposable(cleanEmail);
    this.assertStrongPassword(args.password);
    await this.assertValidNewAccount({ email: cleanEmail });

    const startingBalances = await leaveService.initialBalancesForNewHire();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await this.persistWithUniqueEmployeeId({
      role: 'STAFF',
      identity: { name: args.name, email: cleanEmail },
      buildUser: async (employeeId) => {
        let faceEmbedding: number[] | null = null;
        if (args.avatarBase64) {
          faceEmbedding = await getFaceEmbeddingFromBase64(args.avatarBase64);
          if (!faceEmbedding && env.faceServiceUrl) {
            throw new ValidationError('Could not extract face data. Please take a clearer photo.');
          }
        }
        return {
          employeeId,
          name: String(args.name).trim(),
          email: cleanEmail,
          password: String(args.password),
          role: 'STAFF',
          loginMethod: 'PASSWORD',
          approvalStatus: 'PENDING',
          leaveBalances: startingBalances,
          faceEmbedding: faceEmbedding ?? [],
          emailVerified: false,
          verificationOtp: otp,
          verificationOtpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          ...(args.avatarBase64 && {
            avatar: await saveBase64Image(args.avatarBase64, `staff-${employeeId}-${Date.now()}`),
          }),
        };
      },
    });

    // Send OTP email instead of notifying admins immediately
    void mailService.sendSignupOTPEmail(cleanEmail, user.name, otp).catch(e => logger.error(e));

    return {
      success: true,
      message:
        'OTP sent! Please check your email to verify your account.',
    };
  }

  /** Verify Email OTP */
  public async verifyEmailOTP(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = this.normalizeEmail(email);
    const user = await userRepository.queries.findByEmail(cleanEmail);
    if (!user) throw new ValidationError('User not found.');
    if (user.emailVerified) throw new ValidationError('Email is already verified.');
    
    if (user.verificationOtp !== otp) throw new ValidationError('Invalid verification code.');
    if (!user.verificationOtpExpiry || user.verificationOtpExpiry < new Date()) {
      throw new ValidationError('Verification code has expired. Please request a new one.');
    }

    await userRepository.queries.updateById(String(user._id), {
      emailVerified: true,
      verificationOtp: null,
      verificationOtpExpiry: null,
    });

    // Now notify admins since the email is verified
    await notificationService.notifyAdmins({
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
      message: 'Email verified! Sign-up requests stay PENDING until an administrator approves them. Login unlocks right after approval.',
    };
  }

  /** Resend Email OTP */
  public async resendEmailOTP(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = this.normalizeEmail(email);
    const user = await userRepository.queries.findByEmail(cleanEmail);
    if (!user) throw new ValidationError('User not found.');
    if (user.emailVerified) throw new ValidationError('Email is already verified.');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await userRepository.queries.updateById(String(user._id), {
      verificationOtp: otp,
      verificationOtpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    void mailService.sendSignupOTPEmail(cleanEmail, user.name, otp).catch(e => logger.error(e));

    return {
      success: true,
      message: 'A new OTP has been sent to your email.',
    };
  }

  /** Admin decision on a pending signup – requester is notified in-app. */
  public async reviewUserSignup(
    userId: string,
    status: string,
    note?: string | null,
    officeId?: string | null,
  ): Promise<IUserDocument> {
    const target = await userRepository.queries.findById(userId);
    if (!target) throw new ValidationError('User not found.');
    if (target.role === 'ADMIN') {
      throw new ForbiddenError('Admin accounts cannot be reviewed here.');
    }

    const patch: Partial<IUser> = {
      approvalStatus: status as IUser['approvalStatus'],
      approvalNote: note || '',
    };
    if (status === 'APPROVED') {
      if (officeId) patch.assignedOffice = officeId;
      patch.isActive = true;
    }
    if (status === 'REJECTED') {
      patch.isActive = false;
    }

    const updatedTarget = (await userRepository.queries.updateById(String(target._id), patch)) ?? target;
    if (status === 'APPROVED') void mailService.sendUserApprovalEmail(updatedTarget);
    if (status === 'REJECTED') void mailService.sendSignupRejectionEmail(updatedTarget, note);

    // Delete the signup request notifications for all admins
    await notificationRepository.queries.deleteSignupRequests(String(target._id));

    await notificationService.push({
      recipientIds: [String(target._id)],
      type: 'SIGNUP_DECISION',
      title: status === 'APPROVED' ? 'Your account has been approved ✅' : 'Your access request was rejected',
      message:
        status === 'APPROVED'
          ? `Welcome aboard, ${target.name}! You can now log in with Employee ID ${target.employeeId}.`
          : note || 'Please contact your administrator for details.',
      link: '/login',
    });

    const populated = await userRepository.queries.findById(String(target._id), {
      populate: ['assignedOffice'],
    });
    return populated ?? target;
  }

  /**
   * Logged-in user rotates their own password. Accounts WITHOUT a password
   * (Google-only sign-ins) may SET one directly – no current password needed.
   */
  public async changeUserPassword(args: {
    userId: string;
    currentPassword?: string | null;
    newPassword: string;
  }): Promise<boolean> {
    this.assertStrongPassword(args.newPassword);
    const user = await userRepository.queries.findById(args.userId);
    if (!user) throw new ValidationError('Account not found.');
    if (user.password) {
      const ok = await verifyPassword(user, String(args.currentPassword || ''));
      if (!ok) throw new ValidationError('Current password is incorrect.');
    }
    await userRepository.queries.updateById(String(user._id), { password: String(args.newPassword) });
    return true;
  }

  /** Always-allowed security mail with a single-use reset token link. */
  public async requestPasswordReset(email: string): Promise<boolean> {
    logger.info(`Password reset requested for email: ${email}`);
    const user = await userRepository.queries.findByEmail(email);
    if (!user) return true; // prevent enumeration
    
    const resetToken = crypto.randomUUID();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hr
    await user.save();

    await mailService.sendPasswordResetEmail(email, resetToken);
    return true;
  }

  public async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    const { UserModel } = await import('../user/user.model.js');
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });
    
    if (!user) throw new Error('Invalid or expired password reset token.');
    
    user.password = await hashPassword(newPassword);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    
    logger.info(`Password successfully reset for user: ${user.email}`);
    return true;
  }
}

export const authService = AuthService.getInstance();
