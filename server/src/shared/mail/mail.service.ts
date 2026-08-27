import { env } from '../../config/env.js';
import { DEFAULTS } from '../../config/constants.js';
import { logger } from '../logger/logger.js';
import { mailer } from './mailer.js';
import { renderBrandEmail, type EmailTemplateOptions, type PillSpec, type TemplateRow } from './email-template.js';
import type { IUserDocument } from '../../modules/user/user.model.js';
import type { IMedicineRequest } from '../../modules/medicine/medicine.model.js';
import { settingsRepository } from '../../modules/settings/settings.repository.js';
import { userRepository } from '../../modules/user/user.repository.js';

/** Minimal shape of anything that can receive an email. */
export interface MailRecipient {
  email?: string | null;
  name?: string | null;
  employeeId?: string;
  role?: string;
}

export interface EmailBranding {
  organizationName: string;
  mailFromName: string;
  mailFromAddress: string;
}

type PrefKey = 'userUpdates' | 'broadcasts' | 'adminAlerts';

/** Generic user-facing update email options (premium chrome). */
export interface UserUpdateEmailOptions {
  subject: string;
  heading: string;
  introText?: string;
  /** Legacy format allowed: `<strong>Label:</strong> value` strings */
  lines?: string[];
  buttonText?: string;
  buttonPath?: string;
  pill?: PillSpec | null;
}

export interface AdminChangeEmailOptions {
  title: string;
  lines?: string[];
  buttonText?: string;
  buttonPath?: string;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * MAIL SERVICE – SINGLETON facade over every outbound email in the system.
 * ────────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *   • SMTP sending (console-stub fallback when SMTP is not configured)
 *   • ADMIN-controlled branding cache (Settings → Email & Branding)
 *   • Category master switches so admins can mute non-critical mails
 */
class MailService {
  private static instance: MailService | null = null;

  private brandCache: { data: EmailBranding | null; at: number } = { data: null, at: 0 };

  private constructor() {}

  public static getInstance(): MailService {
    if (!MailService.instance) {
      MailService.instance = new MailService();
    }
    return MailService.instance;
  }

  // ── Branding (cached 30s to avoid hammering the DB) ───────────────────────

  public async getEmailBranding(): Promise<EmailBranding> {
    const fallback: EmailBranding = {
      organizationName: DEFAULTS.ORGANIZATION_NAME,
      mailFromName: `${DEFAULTS.ORGANIZATION_NAME} Admin`,
      mailFromAddress: env.smtp.email ?? '',
    };
    if (this.brandCache.data && Date.now() - this.brandCache.at < 30_000) {
      return this.brandCache.data;
    }
    try {
      const settings = await settingsRepository.queries.findFirstLean();
      this.brandCache = {
        data: settings
          ? {
              organizationName: settings.organizationName || fallback.organizationName,
              mailFromName: settings.mailFromName || fallback.mailFromName,
              mailFromAddress: settings.mailFromAddress || fallback.mailFromAddress,
            }
          : fallback,
        at: Date.now(),
      };
    } catch {
      this.brandCache = { data: fallback, at: Date.now() };
    }
    return this.brandCache.data!;
  }

  /** Category switch – true unless an admin explicitly muted that category. */
  public async notificationPrefEnabled(key: PrefKey): Promise<boolean> {
    try {
      const settings = await settingsRepository.queries.findFirstLean();
      return settings?.emailNotifications?.[key] !== false;
    } catch {
      return true; // fail open – never silently eat mail over a DB hiccup
    }
  }

  // ── Core senders ──────────────────────────────────────────────────────────

  public async sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
    const transport = mailer.transport;
    if (!transport) {
      logger.debug(
        `[mail:stub] To: ${to} | Subject: ${subject} | Body: ${html} (configure SMTP_EMAIL & SMTP_PASSWORD in .env for real emails)`,
      );
      return;
    }

    try {
      const branding = await this.getEmailBranding();
      const fromAddress = branding.mailFromAddress || env.smtp.email;
      await transport.sendMail({
        from: `"${branding.mailFromName}" <${fromAddress}>`,
        to,
        subject,
        html,
      });
      logger.info(`Email sent to ${to} (from ${fromAddress})`);
    } catch (error) {
      logger.error(`Failed to send email to ${to}`, error);
    }
  }

  /** Generic branded sender used by every template-based email. */
  public async sendTemplateEmail(to: string | null | undefined, options: EmailTemplateOptions): Promise<void> {
    if (!to) return;
    if (!(await this.notificationPrefEnabled('userUpdates'))) return;
    const branding = await this.getEmailBranding();
    await this.sendEmail({ to, subject: options.subject, html: await renderBrandEmail(options, branding) });
  }

  /** Fan-out an alert email to every active admin. */
  public async sendAdminNotificationEmail(args: {
    title: string;
    message?: string;
    link?: string;
    pill?: PillSpec | null;
    rows?: TemplateRow[];
    noteText?: string;
  }): Promise<void> {
    try {
      if (!(await this.notificationPrefEnabled('adminAlerts'))) return;
      const admins = await userRepository.queries.findActiveAdminEmails();
      if (admins.length === 0) return;

      await this.sendTemplateEmail(admins.join(','), {
        subject: `[German Homeopathy] ${args.title}`,
        heading: args.title,
        introText: args.message,
        pill: args.pill,
        rows: args.rows,
        noteText: args.noteText,
        cta: { text: 'Review in Dashboard', path: args.link || '/' },
      });
    } catch (error) {
      logger.error('Failed to notify admins via email', error);
    }
  }

  /** Generic user-facing update email reusing the premium chrome. */
  public async sendUserUpdateEmail(
    recipient: MailRecipient | null | undefined,
    options: UserUpdateEmailOptions,
  ): Promise<void> {
    try {
      if (!recipient?.email || String(recipient.email).endsWith('@company.com')) return;

      // Legacy callers pass "<strong>Label:</strong> value" strings – parse them
      // into clean label/value rows for the premium template.
      const rows = (options.lines ?? []).map((line): TemplateRow => {
        const match = /^<strong>(.+?):<\/strong>\s*([\s\S]*)$/.exec(line);
        return match ? [match[1], match[2]] : ['Details', line];
      });

      await this.sendTemplateEmail(recipient.email, {
        subject: options.subject,
        heading: options.heading,
        recipientName: recipient.name ?? '',
        introText: options.introText,
        rows,
        pill: options.pill,
        cta: { text: options.buttonText || 'Open German Homeopathy', path: options.buttonPath || '/' },
      });
    } catch (error) {
      logger.error(`Failed to send update email to ${recipient?.email}`, error);
    }
  }

  /** Admin-relevant site/holiday/settings changes go to every active admin. */
  public async sendAdminChangeEmail(args: AdminChangeEmailOptions): Promise<void> {
    try {
      if (!(await this.notificationPrefEnabled('adminAlerts'))) return;
      const admins = await userRepository.queries.findActiveAdmins();
      for (const admin of admins) {
        await this.sendUserUpdateEmail(
          { email: admin.email, name: admin.name },
          {
            subject: `[German Homeopathy] ${args.title}`,
            heading: args.title,
            lines: args.lines,
            buttonText: args.buttonText,
            buttonPath: args.buttonPath,
          },
        );
      }
    } catch (error) {
      logger.error('Failed to send admin change email', error);
    }
  }

  // ── SECURITY / ACCOUNT EMAILS ─────────────────────────────────────────────

  /** Signup Verification OTP */
  public async sendSignupOTPEmail(email: string, name: string, otp: string): Promise<void> {
    try {
      await this.sendTemplateEmail(email, {
        subject: '[German Homeopathy] Verify your email address',
        heading: 'Email Verification',
        introText: `Hi ${name},\n\nYour 6-digit verification code is:\n\n**${otp}**\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`,
      });
    } catch (error) {
      logger.error('Failed to send OTP email', error);
    }
  }

  /** Password reset link mail – security flow, always template-branded. */
  public async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    await this.sendTemplateEmail(email, {
      subject: 'Reset your password – German Homeopathy',
      heading: 'Password Reset Request',
      introText:
        'We received a request to reset the password for your account. Click the button below to choose a new one. This secure link expires in 1 hour.',
      noteText:
        'If you did not request a password reset, you can safely ignore this email – your current password keeps working.',
      cta: { text: 'Reset Password', path: `/reset-password?token=${resetToken}` },
    });
  }

  /** Self-signup approved by an admin. */
  public async sendUserApprovalEmail(
    recipient: MailRecipient & { employeeId?: string; role?: string },
  ): Promise<void> {
    await this.sendTemplateEmail(recipient.email ?? undefined, {
      subject: 'Your German Homeopathy account has been approved',
      heading: 'Welcome Aboard!',
      pill: { label: 'ACCOUNT APPROVED', tone: 'success' },
      introText:
        'Your account has been approved by an administrator. You can now log in and start marking your attendance.',
      rows: [
        ['Employee ID', `<strong>${recipient.employeeId}</strong>`],
        ['Role', String(recipient.role)],
      ],
      cta: { text: 'Log In Now', path: '/login' },
    });
  }

  public async sendProfileUpdateEmail(recipient: MailRecipient): Promise<void> {
    await this.sendTemplateEmail(recipient.email ?? undefined, {
      subject: 'Your German Homeopathy profile was updated',
      heading: 'Profile Updated',
      introText:
        'Your profile information was recently updated by an administrator. Please log in to review your current shift timings and assigned site.',
      cta: { text: 'View Profile', path: '/' },
    });
  }

  /** Org-wide announcement to all active staff. */
  public async sendBroadcastEmail(subject: string, message: string): Promise<void> {
    try {
      if (!(await this.notificationPrefEnabled('broadcasts'))) return;
      const staff = await userRepository.queries.findActiveStaffEmails();
      if (staff.length === 0) return;

      await this.sendTemplateEmail(staff.join(','), {
        subject: `[Announcement] ${subject}`,
        heading: subject,
        pill: { label: 'ANNOUNCEMENT', tone: 'info' },
        introText: message,
        cta: { text: 'Open German Homeopathy', path: '/' },
      });
    } catch (error) {
      logger.error('Failed to broadcast email', error);
    }
  }

  /** New stock request → every active admin. */
  public async sendStockRequestEmail(
    request: IMedicineRequest & { requestedBy?: MailRecipient | null },
  ): Promise<void> {
    try {
      if (!(await this.notificationPrefEnabled('adminAlerts'))) return;
      const admins = await userRepository.queries.findActiveAdminEmails();
      if (admins.length === 0) return;

      const medStr = `${request.medicineName}${request.strength ? ` (${request.strength})` : ''}`;
      await this.sendTemplateEmail(admins.join(','), {
        subject:
          request.isNewMedicine
            ? `Action Required: New Medicine "${request.medicineName}" requested (not in catalogue)`
            : `Action Required: New Stock Request for ${request.medicineName}`,
        heading: 'Stock Replenishment Request',
        pill:
          request.isNewMedicine
            ? { label: 'NEW MEDICINE – ADD TO CATALOGUE', tone: 'error' }
            : request.urgency === 'URGENT'
              ? { label: 'URGENT RESTOCK', tone: 'error' }
              : { label: 'NEW STOCK REQUEST', tone: 'warning' },
        introText:
          request.isNewMedicine
            ? `<strong>${request.requestedBy?.name}</strong> requested a medicine that is <strong>not yet in your catalogue</strong>. Please review it below and consider adding it to your Medicine Catalog.`
            : `<strong>${request.requestedBy?.name}</strong> has submitted a new stock request. Please review the details below and arrange for supply as soon as possible.`,
        rows: [
          ['Medicine Item', `<strong>${medStr}</strong>`],
          ['Requested Qty', `${request.quantity} ${request.unit}`],
          ['Urgency Level', request.urgency],
          ...(request.notes ? [['Staff Notes', request.notes] as TemplateRow] : []),
        ],
        noteText: request.isNewMedicine
          ? 'This medicine was typed in by staff and matched nothing in your catalogue – they may have forgotten to tell you about it earlier. You can add it from Medicine Catalog.'
          : 'You can update the status of this request to ORDERED or SUPPLIED from the admin dashboard.',
        cta: { text: 'Review Request', path: '/stock' },
      });
    } catch (error) {
      logger.error('Failed to send stock request email', error);
    }
  }

  public async sendLeaveDecisionEmail(
    recipient: MailRecipient,
    args: { status: string; leaveType: string; startDate: string; endDate: string; feedback?: string | null; reviewerName?: string | null },
  ): Promise<void> {
    await this.sendUserUpdateEmail(recipient, {
      subject: `Your ${args.leaveType} leave was ${args.status === 'APPROVED' ? 'approved' : 'rejected'}`,
      heading: args.status === 'APPROVED' ? 'Leave Approved' : 'Leave Request Rejected',
      introText: `Your ${args.leaveType} leave request has been reviewed by ${args.reviewerName || 'the administrator'}.`,
      lines: [
        `<strong>Dates:</strong> ${args.startDate} – ${args.endDate}`,
        `<strong>Status:</strong> ${args.status}`,
        ...(args.feedback ? [`<strong>Comments:</strong> ${args.feedback}`] : []),
      ],
      pill:
        args.status === 'APPROVED'
          ? { label: 'LEAVE APPROVED', tone: 'success' }
          : { label: 'LEAVE REJECTED', tone: 'error' },
      buttonText: 'View My Leaves',
      buttonPath: '/leaves',
    });
  }

  public async sendRegularizationDecisionEmail(
    recipient: MailRecipient,
    args: { status: string; date: string; checkInTime: string; checkOutTime: string; feedback?: string | null },
  ): Promise<void> {
    await this.sendUserUpdateEmail(recipient, {
      subject: `Punch regularization ${args.status === 'APPROVED' ? 'approved' : 'rejected'} for ${args.date}`,
      heading: args.status === 'APPROVED' ? 'Attendance Regularized' : 'Regularization Rejected',
      introText: 'Your punch regularization request has been processed.',
      lines: [
        `<strong>Date:</strong> ${args.date}`,
        `<strong>Punch times:</strong> ${args.checkInTime} – ${args.checkOutTime}`,
        `<strong>Status:</strong> ${args.status}`,
        ...(args.feedback ? [`<strong>Comments:</strong> ${args.feedback}`] : []),
      ],
      pill:
        args.status === 'APPROVED'
          ? { label: 'REGULARIZED', tone: 'success' }
          : { label: 'REJECTED', tone: 'error' },
      buttonText: 'View History',
      buttonPath: '/history',
    });
  }

  public async sendAttendanceReviewEmail(
    recipient: MailRecipient,
    args: { status: string; date: string; punchType: string; comments?: string | null },
  ): Promise<void> {
    await this.sendUserUpdateEmail(recipient, {
      subject: `Your ${args.date} attendance was ${args.status === 'APPROVED' ? 'approved' : 'rejected'}`,
      heading: args.status === 'APPROVED' ? 'Attendance Approved' : 'Attendance Rejected',
      introText: 'A flagged attendance record of yours has been reviewed by an administrator.',
      lines: [
        `<strong>Date:</strong> ${args.date}`,
        `<strong>Punch:</strong> ${args.punchType}`,
        ...(args.comments ? [`<strong>Admin comments:</strong> ${args.comments}`] : []),
      ],
      pill:
        args.status === 'APPROVED'
          ? { label: 'ATTENDANCE APPROVED', tone: 'success' }
          : { label: 'ATTENDANCE REJECTED', tone: 'error' },
      buttonText: 'View History',
      buttonPath: '/history',
    });
  }

  public async sendAccountStatusEmail(
    recipient: MailRecipient & { name?: string },
    args: { isActive: boolean },
  ): Promise<void> {
    await this.sendUserUpdateEmail(recipient, {
      subject: args.isActive
        ? 'Your German Homeopathy account is active again'
        : 'Your German Homeopathy account has been deactivated',
      heading: args.isActive ? 'Account Activated ✅' : 'Account Deactivated',
      introText: args.isActive
        ? 'Good news! Your account has been re-activated by the administrator. You can log in and mark attendance as usual.'
        : 'Your account has been deactivated by the administrator. You will not be able to log in until it is re-activated.',
      buttonText: args.isActive ? 'Log In Now' : 'Contact Admin',
      buttonPath: args.isActive ? '/login' : '/',
    });
  }

  public async sendTemporaryDutyEmail(
    recipient: MailRecipient,
    args: { officeName: string; startDate?: string; endDate?: string; reason?: string | null; cleared?: boolean },
  ): Promise<void> {
    await this.sendUserUpdateEmail(recipient, {
      subject: args.cleared
        ? `Temporary duty at ${args.officeName} removed`
        : `Temporary duty assigned at ${args.officeName}`,
      heading: args.cleared ? 'Temporary Duty Removed' : 'Temporary Duty Assigned 📍',
      introText: args.cleared
        ? `You are no longer on temporary duty at <strong>${args.officeName}</strong>. Your attendance site is back to your permanent assignment.`
        : `You have been assigned temporary duty at <strong>${args.officeName}</strong>. Mark your attendance there during this period.`,
      lines: args.cleared
        ? []
        : [
            `<strong>From:</strong> ${args.startDate}`,
            `<strong>To:</strong> ${args.endDate}`,
            ...(args.reason ? [`<strong>Reason:</strong> ${args.reason}`] : []),
          ],
      buttonText: 'View Attendance',
      buttonPath: '/attendance',
    });
  }

  public async sendDayOffEmail(
    recipient: MailRecipient,
    args: { date: string; reason?: string | null; revoked?: boolean },
  ): Promise<void> {
    await this.sendUserUpdateEmail(recipient, {
      subject: args.revoked ? `Day off on ${args.date} revoked` : `Day off granted on ${args.date} 🎉`,
      heading: args.revoked ? 'Day Off Revoked' : 'Day Off Granted 🎉',
      introText: args.revoked
        ? `Your day off on <strong>${args.date}</strong> has been revoked. Regular attendance applies on that day now.`
        : `The admin has granted you a day off on <strong>${args.date}</strong>. You are not required to mark attendance.`,
      lines: !args.revoked && args.reason ? [`<strong>Reason:</strong> ${args.reason}`] : [],
      buttonText: 'View Attendance',
      buttonPath: '/attendance',
    });
  }

  /** Welcome mail for admin-created accounts (APPROVED instantly). */
  public async sendStaffWelcomeEmail(
    recipient: MailRecipient & { employeeId?: string; role?: string },
    options: { temporaryPassword?: string } = {},
  ): Promise<void> {
    await this.sendTemplateEmail(recipient.email ?? undefined, {
      subject: 'Welcome to German Homeopathy – your account is ready',
      heading: 'Welcome aboard!',
      pill: { label: 'ACCOUNT READY', tone: 'success' },
      introText: 'An administrator has created your German Homeopathy account. Everything is set up and ready to go.',
      rows: [
        ['Employee ID', `<strong>${recipient.employeeId}</strong>`],
        ['Role', String(recipient.role)],
        ['Login Email', String(recipient.email)],
        options.temporaryPassword
          ? ['Temporary Password', `${options.temporaryPassword} <span style="color:#8D8D8D;">(change it after first login)</span>`]
          : ['Password', 'Collect your initial password from the administrator'],
      ],
      cta: { text: 'Log In Now', path: '/login' },
    });
  }

  /** Self-signup rejected – tell the requester why. */
  public async sendSignupRejectionEmail(recipient: MailRecipient, note?: string | null): Promise<void> {
    await this.sendUserUpdateEmail(recipient, {
      subject: 'Your German Homeopathy access request was not approved',
      heading: 'Access Request Rejected',
      introText: 'Unfortunately, your signup request was not approved by the administrator.',
      lines: note ? [`<strong>Note from admin:</strong> ${note}`] : [],
      buttonText: 'Contact Support',
      buttonPath: '/login',
    });
  }

  // ── ADMIN CHANGE EMAILS – sites / holidays / settings ─────────────────────

  public async sendOfficeChangeEmail(args: {
    action: string;
    office: { name: string; address?: string; latitude: number; longitude: number; geofenceRadius?: number };
  }): Promise<void> {
    await this.sendAdminChangeEmail({
      title: `Site ${args.action}: ${args.office.name}`,
      lines: [
        `<strong>Site:</strong> ${args.office.name}`,
        args.office.address ? `<strong>Address:</strong> ${args.office.address}` : '',
        `<strong>Coordinates:</strong> ${Number(args.office.latitude).toFixed(5)}, ${Number(args.office.longitude).toFixed(5)}`,
        `<strong>Geofence radius:</strong> ${args.office.geofenceRadius}m`,
        args.action === 'deleted' ? '<strong>Status:</strong> Deactivated (soft delete)' : '',
      ].filter(Boolean),
      buttonText: 'Manage Sites',
      buttonPath: '/offices',
    });
  }

  public async sendHolidayChangeEmail(args: {
    action: string;
    holiday: { name: string; date: Date | string; type?: string };
  }): Promise<void> {
    await this.sendAdminChangeEmail({
      title: `Holiday ${args.action}: ${args.holiday.name}`,
      lines: [
        `<strong>Holiday:</strong> ${args.holiday.name}`,
        `<strong>Date:</strong> ${new Date(args.holiday.date).toDateString()}`,
        args.holiday.type ? `<strong>Type:</strong> ${args.holiday.type}` : '',
      ].filter(Boolean),
      buttonText: 'Manage Holidays',
      buttonPath: '/holidays',
    });
  }

  public async sendSettingsChangeEmail(adminName: string): Promise<void> {
    await this.sendAdminChangeEmail({
      title: 'Organization settings updated',
      lines: [
        `<strong>Updated by:</strong> ${adminName}`,
        'Global geofence / shift configuration has changed.',
      ],
      buttonText: 'Review Settings',
      buttonPath: '/settings',
    });
  }
}

export const mailService = MailService.getInstance();
