import nodemailer from 'nodemailer';
import { config } from '../config/environment.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    return null;
  }
  const transportOptions = process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      }
    : {
        service: 'gmail',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      };
  transporter = nodemailer.createTransport(transportOptions);
  // Fail fast & loud if credentials are wrong – but never crash the server
  transporter.verify((err) => {
    if (err) console.error('⚠️ SMTP configuration problem:', err.message);
    else console.log(`📧 SMTP ready – emails will be sent from ${process.env.SMTP_EMAIL}`);
  });
  return transporter;
};

// ────────────────────────────────────────────────────────────────────────────
// BRANDING – the ADMIN controls how every email identifies itself
// (organizationName / mailFromName / mailFromAddress live in Settings and are
// editable from Settings → "Email & Branding"). Cached 30s to avoid hammering DB.
// ────────────────────────────────────────────────────────────────────────────
let brandCache = { data: null, at: 0 };

export const getEmailBranding = async () => {
  const fallback = {
    organizationName: 'EdgeAttendance',
    mailFromName: 'EdgeAttendance Admin',
    mailFromAddress: process.env.SMTP_EMAIL || '',
  };
  if (brandCache.data && Date.now() - brandCache.at < 30_000) return brandCache.data;
  try {
    const settings = await Settings.findOne().lean();
    brandCache = {
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
    brandCache = { data: fallback, at: Date.now() };
  }
  return brandCache.data;
};

/**
 * Master switches – Settings → Email Notifications. Returns true unless an
 * admin explicitly muted that category. Password-reset mails bypass this
 * entirely (they call sendEmail directly): security flows are never muteable.
 */
const notificationPrefEnabled = async (key) => {
  try {
    const settings = await Settings.findOne().select('emailNotifications').lean();
    return settings?.emailNotifications?.[key] !== false;
  } catch {
    return true; // fail open – never silently eat mail over a DB hiccup
  }
};

export const sendEmail = async ({ to, subject, html }) => {
  const mailer = getTransporter();
  if (!mailer) {
    console.log(`\n[MAIL STUB] To: ${to}\nSubject: ${subject}\nBody: ${html}\n(Configure SMTP_EMAIL and SMTP_PASSWORD in .env to send real emails)`);
    return;
  }

  try {
    const branding = await getEmailBranding();
    const fromAddress = branding.mailFromAddress || process.env.SMTP_EMAIL;
    await mailer.sendMail({
      from: `"${branding.mailFromName}" <${fromAddress}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to} (from ${fromAddress})`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// PREMIUM TEMPLATE – one consistent chrome for EVERY email (Outlook-safe)
// ────────────────────────────────────────────────────────────────────────────
const TONES = {
  success: { bg: '#DEF7EC', fg: '#116149', border: '#A9E3CC' },
  error: { bg: '#FDECEC', fg: '#9F1B24', border: '#F3C3C5' },
  warning: { bg: '#FCF4D6', fg: '#6B5204', border: '#EFDD8F' },
  info: { bg: '#E7F0FE', fg: '#0B3E8F', border: '#C4D9FB' },
  neutral: { bg: '#F0F0F0', fg: '#393939', border: '#DCDCDC' },
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const renderBrandEmail = async ({
  recipientName = '',
  heading,
  pill = null,
  introText = '',
  rows = [],
  noteText = '',
  cta = {},
  preheader = '',
}) => {
  const branding = await getEmailBranding();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const org = escapeHtml(branding.organizationName);
  const tone = TONES[pill?.tone] || TONES.info;
  const name = escapeHtml(recipientName);
  const ctaText = escapeHtml(cta.text || 'Open AttendEase');
  const ctaUrl = `${frontendUrl}${cta.path || '/'}`;
  // Inbox preview text (hidden preheader) – shows beside the subject line
  const preheaderText = escapeHtml(
    String(preheader || introText || heading || '').replace(/<[^>]+>/g, '')
  ).slice(0, 140);
  const monogram =
    String(branding.organizationName || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'AE';
  const year = new Date().getFullYear();

  const pillHtml = pill
    ? `<div style="margin:10px 0 0;">
        <span style="display:inline-block;padding:5px 14px;border-radius:999px;background:${tone.bg};color:${tone.fg};border:1px solid ${tone.border};font-size:12px;font-weight:700;letter-spacing:0.6px;">${escapeHtml(pill.label)}</span>
      </div>`
    : '';

  const introHtml = introText
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#393939;">${introText}</p>`
    : '';

  const rowsHtml = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;background:#FAFAFA;border:1px solid #E8E8E8;border-radius:10px;">
        ${rows
          .map(
            ([label, value], i) => `
        <tr>
          <td style="padding:${i === 0 ? '14px' : '12px'} 18px ${i === rows.length - 1 ? '14px' : '6px'} 18px;width:38%;font-size:11px;font-weight:700;letter-spacing:0.8px;color:#6F6F6F;text-transform:uppercase;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:${i === 0 ? '14px' : '12px'} 18px ${i === rows.length - 1 ? '14px' : '6px'} 6px;font-size:14px;font-weight:600;color:#161616;line-height:1.55;vertical-align:top;">${value}</td>
        </tr>`
          )
          .join('')}
      </table>`
    : '';

  const noteHtml = noteText
    ? `<p style="margin:18px 0 0;padding:12px 16px;background:#F4F4F4;border-left:3px solid #0F62FE;border-radius:6px;font-size:13.5px;line-height:1.6;color:#393939;">${noteText}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F4F4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheaderText}&nbsp;&zwnj;</div>
<div style="background-color:#F4F4F4;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#FFFFFF;border:1px solid #E0E0E0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background-color:#161616;padding:20px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td width="40" bgcolor="#0F62FE" style="width:40px;height:40px;line-height:40px;border-radius:10px;text-align:center;font-size:16px;font-weight:800;color:#FFFFFF;">${monogram}</td>
                <td style="padding-left:12px;font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:0.3px;">${org}</td>
              </tr></table>
            </td>
            <td align="right" style="font-size:10px;color:#9A9A9A;letter-spacing:1.4px;font-weight:600;line-height:1.6;">ATTENDANCE<br />&amp; STOCK PLATFORM</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td bgcolor="#0F62FE" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
    <tr>
      <td style="padding:34px 34px 6px 34px;">
        <h2 style="margin:0;font-size:20px;line-height:1.35;color:#161616;">${heading}</h2>
        ${pillHtml}
        ${name ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#393939;">Hi <strong>${name}</strong>,</p>` : ''}
        ${introHtml}
        ${rowsHtml}
        ${noteHtml}
        ${name ? `<p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#393939;">Warm regards,<br /><strong style="color:#161616;">The ${org} Team</strong></p>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 34px 38px 34px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td bgcolor="#0F62FE" style="border-radius:8px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.3px;">${ctaText}</a>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#8D8D8D;line-height:1.6;">Button not working? Paste this link in your browser:<br /><a href="${ctaUrl}" style="color:#0F62FE;word-break:break-all;">${ctaUrl}</a></p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#FAFAFA;border-top:1px solid #E8E8E8;padding:18px 34px;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#B5B5B5;">© ${year} ${org}</p>
        <p style="margin:0;font-size:12px;color:#8D8D8D;line-height:1.7;">This is an automated message from <strong>${org}</strong> – please do not reply directly.<br />Need help? Contact your administrator or raise a request inside the app.</p>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`;
};

/** Generic branded sender used by every email in the system */
export const sendTemplateEmail = async (to, options) => {
  if (!to) return;
  // Category switch: user-facing update mails can be muted org-wide
  if (!(await notificationPrefEnabled('userUpdates'))) return;
  await sendEmail({
    to,
    subject: options.subject,
    html: await renderBrandEmail(options),
  });
};

export const sendAdminNotificationEmail = async ({ title, message, link, pill, rows, noteText }) => {
  try {
    // Category switch: admin alert mails (signups etc.)
    if (!(await notificationPrefEnabled('adminAlerts'))) return;
    const admins = await User.find({ role: 'ADMIN', isActive: true }).select('email');
    const adminEmails = admins.map(a => a.email).filter(Boolean);
    
    if (adminEmails.length === 0) return;

    await sendTemplateEmail(adminEmails.join(','), {
      subject: `[AttendEase] ${title}`,
      heading: title,
      introText: message,
      pill,
      rows,
      noteText,
      cta: { text: 'Review in Dashboard', path: link || '/' },
    });
  } catch (err) {
    console.error('Failed to notify admins via email:', err.message);
  }
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  await sendTemplateEmail(email, {
    subject: 'Reset your password – AttendEase',
    heading: 'Password Reset Request',
    introText: 'We received a request to reset the password for your account. Click the button below to choose a new one. This secure link expires in 1 hour.',
    noteText: 'If you did not request a password reset, you can safely ignore this email – your current password keeps working.',
    cta: { text: 'Reset Password', path: `/reset-password?token=${resetLink.split('token=')[1]}` },
  });
};

export const sendUserApprovalEmail = async (user) => {
  await sendTemplateEmail(user.email, {
    subject: 'Your AttendEase account has been approved',
    heading: 'Welcome Aboard!',
    pill: { label: 'ACCOUNT APPROVED', tone: 'success' },
    introText: 'Your account has been approved by an administrator. You can now log in and start marking your attendance.',
    rows: [
      ['Employee ID', `<strong>${user.employeeId}</strong>`],
      ['Role', user.role],
    ],
    cta: { text: 'Log In Now', path: '/login' },
  });
};

export const sendProfileUpdateEmail = async (user) => {
  await sendTemplateEmail(user.email, {
    subject: 'Your AttendEase profile was updated',
    heading: 'Profile Updated',
    introText: 'Your profile information was recently updated by an administrator. Please log in to review your current shift timings and assigned site.',
    cta: { text: 'View Profile', path: '/' },
  });
};

export const sendBroadcastEmail = async (subject, message) => {
  try {
    // Category switch: org-wide announcements
    if (!(await notificationPrefEnabled('broadcasts'))) return;
    const staff = await User.find({ isActive: true }).select('email');
    const staffEmails = staff.map((u) => u.email).filter(Boolean);
    if (staffEmails.length === 0) return;

    await sendTemplateEmail(staffEmails.join(','), {
      subject: `[Announcement] ${subject}`,
      heading: subject,
      pill: { label: 'ANNOUNCEMENT', tone: 'info' },
      introText: message,
      cta: { text: 'Open AttendEase', path: '/' },
    });
  } catch (err) {
    console.error('Failed to broadcast email:', err.message);
  }
};

export const sendStockRequestEmail = async (request) => {
  try {
    if (!(await notificationPrefEnabled('adminAlerts'))) return;
    const admins = await User.find({ role: 'ADMIN', isActive: true }).select('email');
    const adminEmails = admins.map((a) => a.email).filter(Boolean);
    if (adminEmails.length === 0) return;

    const medStr = `${request.medicineName}${request.strength ? ` (${request.strength})` : ''}`;
    const qtyStr = `${request.quantity} ${request.unit}`;

    await sendTemplateEmail(adminEmails.join(','), {
      subject: `Action Required: New Stock Request for ${request.medicineName}`,
      heading: 'Stock Replenishment Request',
      pill: { 
        label: request.urgency === 'URGENT' ? 'URGENT RESTOCK' : 'NEW STOCK REQUEST', 
        tone: request.urgency === 'URGENT' ? 'error' : 'warning' 
      },
      introText: `<strong>${request.requestedBy.name}</strong> has submitted a new stock request. Please review the details below and arrange for supply as soon as possible.`,
      rows: [
        ['Medicine Item', `<strong>${medStr}</strong>`],
        ['Requested Qty', qtyStr],
        ['Urgency Level', request.urgency],
        ...(request.notes ? [['Staff Notes', request.notes]] : []),
      ],
      noteText: 'You can update the status of this request to ORDERED or SUPPLIED from the admin dashboard.',
      cta: { text: 'Review Request', path: '/stock' },
    });
  } catch (err) {
    console.error('Failed to send stock request email:', err.message);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// GENERIC TEMPLATES – every user-facing update reuses this consistent chrome
// ────────────────────────────────────────────────────────────────────────────
export const sendUserUpdateEmail = async (user, { subject, heading, introText, lines = [], buttonText, buttonPath = '/', pill = null }) => {
  try {
    if (!user?.email || String(user.email).endsWith('@company.com')) return; // placeholder accounts get no spam
    // Legacy callers pass "<strong>Label:</strong> value" strings – parse them
    // into clean label/value rows for the premium template.
    const rows = lines.map((line) => {
      const m = /^<strong>(.+?):<\/strong>\s*([\s\S]*)$/.exec(line);
      return m ? [m[1], m[2]] : ['Details', line];
    });
    await sendTemplateEmail(user.email, {
      subject,
      heading,
      recipientName: user.name,
      introText,
      rows,
      pill,
      cta: { text: buttonText || 'Open AttendEase', path: buttonPath },
    });
  } catch (err) {
    console.error(`Failed to send update email to ${user?.email}:`, err.message);
  }
};

/** Admin-relevant site/holiday/settings changes go to every active admin */
export const sendAdminChangeEmail = async ({ title, lines = [], buttonText = 'Open Dashboard', buttonPath = '/admin' }) => {
  try {
    // Category switch: admin change-alert mails
    if (!(await notificationPrefEnabled('adminAlerts'))) return;
    const admins = await User.find({ role: 'ADMIN', isActive: true }).select('email name');
    for (const admin of admins) {
      await sendUserUpdateEmail(admin, {
        subject: `[AttendEase] ${title}`,
        heading: title,
        lines,
        buttonText,
        buttonPath,
      });
    }
  } catch (err) {
    console.error('Failed to send admin change email:', err.message);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// USER DECISION EMAILS
// ────────────────────────────────────────────────────────────────────────────
export const sendLeaveDecisionEmail = (user, { status, leaveType, startDate, endDate, feedback, reviewerName }) =>
  sendUserUpdateEmail(user, {
    subject: `Your ${leaveType} leave was ${status === 'APPROVED' ? 'approved' : 'rejected'}`,
    heading: status === 'APPROVED' ? 'Leave Approved' : 'Leave Request Rejected',
    introText: `Your ${leaveType} leave request has been reviewed by ${reviewerName || 'the administrator'}.`,
    lines: [
      `<strong>Dates:</strong> ${startDate} – ${endDate}`,
      `<strong>Status:</strong> ${status}`,
      ...(feedback ? [`<strong>Comments:</strong> ${feedback}`] : []),
    ],
    pill: status === 'APPROVED'
      ? { label: 'LEAVE APPROVED', tone: 'success' }
      : { label: 'LEAVE REJECTED', tone: 'error' },
    buttonText: 'View My Leaves',
    buttonPath: '/leaves',
  });

export const sendRegularizationDecisionEmail = (user, { status, date, checkInTime, checkOutTime, feedback }) =>
  sendUserUpdateEmail(user, {
    subject: `Punch regularization ${status === 'APPROVED' ? 'approved' : 'rejected'} for ${date}`,
    heading: status === 'APPROVED' ? 'Attendance Regularized' : 'Regularization Rejected',
    introText: 'Your punch regularization request has been processed.',
    lines: [
      `<strong>Date:</strong> ${date}`,
      `<strong>Punch times:</strong> ${checkInTime} – ${checkOutTime}`,
      `<strong>Status:</strong> ${status}`,
      ...(feedback ? [`<strong>Comments:</strong> ${feedback}`] : []),
    ],
    pill: status === 'APPROVED'
      ? { label: 'REGULARIZED', tone: 'success' }
      : { label: 'REJECTED', tone: 'error' },
    buttonText: 'View History',
    buttonPath: '/history',
  });

export const sendAttendanceReviewEmail = (user, { status, date, punchType, comments }) =>
  sendUserUpdateEmail(user, {
    subject: `Your ${date} attendance was ${status === 'APPROVED' ? 'approved' : 'rejected'}`,
    heading: status === 'APPROVED' ? 'Attendance Approved' : 'Attendance Rejected',
    introText: 'A flagged attendance record of yours has been reviewed by an administrator.',
    lines: [
      `<strong>Date:</strong> ${date}`,
      `<strong>Punch:</strong> ${punchType}`,
      ...(comments ? [`<strong>Admin comments:</strong> ${comments}`] : []),
    ],
    pill: status === 'APPROVED'
      ? { label: 'ATTENDANCE APPROVED', tone: 'success' }
      : { label: 'ATTENDANCE REJECTED', tone: 'error' },
    buttonText: 'View History',
    buttonPath: '/history',
  });

export const sendAccountStatusEmail = (user, { isActive }) =>
  sendUserUpdateEmail(user, {
    subject: isActive ? 'Your AttendEase account is active again' : 'Your AttendEase account has been deactivated',
    heading: isActive ? 'Account Activated ✅' : 'Account Deactivated',
    introText: isActive
      ? 'Good news! Your account has been re-activated by the administrator. You can log in and mark attendance as usual.'
      : 'Your account has been deactivated by the administrator. You will not be able to log in until it is re-activated.',
    buttonText: isActive ? 'Log In Now' : 'Contact Admin',
    buttonPath: isActive ? '/login' : '/',
  });

export const sendTemporaryDutyEmail = (user, { officeName, startDate, endDate, reason, cleared = false }) =>
  sendUserUpdateEmail(user, {
    subject: cleared ? `Temporary duty at ${officeName} removed` : `Temporary duty assigned at ${officeName}`,
    heading: cleared ? 'Temporary Duty Removed' : 'Temporary Duty Assigned 📍',
    introText: cleared
      ? `You are no longer on temporary duty at <strong>${officeName}</strong>. Your attendance site is back to your permanent assignment.`
      : `You have been assigned temporary duty at <strong>${officeName}</strong>. Mark your attendance there during this period.`,
    lines: cleared ? [] : [
      `<strong>From:</strong> ${startDate}`,
      `<strong>To:</strong> ${endDate}`,
      ...(reason ? [`<strong>Reason:</strong> ${reason}`] : []),
    ],
    buttonText: 'View Attendance',
    buttonPath: '/attendance',
  });

export const sendDayOffEmail = (user, { date, reason, revoked = false }) =>
  sendUserUpdateEmail(user, {
    subject: revoked ? `Day off on ${date} revoked` : `Day off granted on ${date} 🎉`,
    heading: revoked ? 'Day Off Revoked' : 'Day Off Granted 🎉',
    introText: revoked
      ? `Your day off on <strong>${date}</strong> has been revoked. Regular attendance applies on that day now.`
      : `The admin has granted you a day off on <strong>${date}</strong>. You are not required to mark attendance.`,
    lines: !revoked && reason ? [`<strong>Reason:</strong> ${reason}`] : [],
    buttonText: 'View Attendance',
    buttonPath: '/attendance',
  });

/** Welcome mail for admin-created accounts (they are APPROVED instantly) */
export const sendStaffWelcomeEmail = async (user, { temporaryPassword } = {}) => {
  await sendTemplateEmail(user.email, {
    subject: 'Welcome to AttendEase – your account is ready',
    heading: `Welcome aboard!`,
    pill: { label: 'ACCOUNT READY', tone: 'success' },
    introText: 'An administrator has created your AttendEase account. Everything is set up and ready to go.',
    rows: [
      ['Employee ID', `<strong>${user.employeeId}</strong>`],
      ['Role', user.role],
      ['Login Email', user.email],
      temporaryPassword
        ? ['Temporary Password', `${temporaryPassword} <span style="color:#8D8D8D;">(change it after first login)</span>`]
        : ['Password', 'Collect your initial password from the administrator'],
    ],
    cta: { text: 'Log In Now', path: '/login' },
  });
};

/** Self-signup rejected – tell the requester why */
export const sendSignupRejectionEmail = (user, note) =>
  sendUserUpdateEmail(user, {
    subject: 'Your AttendEase access request was not approved',
    heading: 'Access Request Rejected',
    introText: 'Unfortunately, your signup request was not approved by the administrator.',
    lines: note ? [`<strong>Note from admin:</strong> ${note}`] : [],
    buttonText: 'Contact Support',
    buttonPath: '/login',
  });

// ────────────────────────────────────────────────────────────────────────────
// ADMIN CHANGE EMAILS – sites / holidays / settings
// ────────────────────────────────────────────────────────────────────────────
export const sendOfficeChangeEmail = ({ action, office }) =>
  sendAdminChangeEmail({
    title: `Site ${action}: ${office.name}`,
    lines: [
      `<strong>Site:</strong> ${office.name}`,
      office.address ? `<strong>Address:</strong> ${office.address}` : '',
      `<strong>Coordinates:</strong> ${Number(office.latitude).toFixed(5)}, ${Number(office.longitude).toFixed(5)}`,
      `<strong>Geofence radius:</strong> ${office.geofenceRadius}m`,
      action === 'deleted' ? '<strong>Status:</strong> Deactivated (soft delete)' : '',
    ].filter(Boolean),
    buttonText: 'Manage Sites',
    buttonPath: '/offices',
  });

export const sendHolidayChangeEmail = ({ action, holiday }) =>
  sendAdminChangeEmail({
    title: `Holiday ${action}: ${holiday.name}`,
    lines: [
      `<strong>Holiday:</strong> ${holiday.name}`,
      `<strong>Date:</strong> ${new Date(holiday.date).toDateString()}`,
      holiday.type ? `<strong>Type:</strong> ${holiday.type}` : '',
    ].filter(Boolean),
    buttonText: 'Manage Holidays',
    buttonPath: '/holidays',
  });

export const sendSettingsChangeEmail = (adminName) =>
  sendAdminChangeEmail({
    title: 'Organization settings updated',
    lines: [
      `<strong>Updated by:</strong> ${adminName}`,
      'Global geofence / shift configuration has changed.',
    ],
    buttonText: 'Review Settings',
    buttonPath: '/settings',
  });
