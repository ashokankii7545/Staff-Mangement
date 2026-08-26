import { env } from '../../config/env.js';
import type { EmailBranding } from './mail.service.js';

export type PillTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

export interface PillSpec {
  label: string;
  tone: PillTone;
}

export type TemplateRow = [label: string, valueHtml: string];

export interface EmailTemplateOptions {
  subject: string;
  recipientName?: string;
  heading: string;
  pill?: PillSpec | null;
  introText?: string;
  rows?: TemplateRow[];
  noteText?: string;
  cta?: { text?: string; path?: string };
  preheader?: string;
}

const TONES: Record<PillTone, { bg: string; fg: string; border: string }> = {
  success: { bg: '#DEF7EC', fg: '#116149', border: '#A9E3CC' },
  error: { bg: '#FDECEC', fg: '#9F1B24', border: '#F3C3C5' },
  warning: { bg: '#FCF4D6', fg: '#6B5204', border: '#EFDD8F' },
  info: { bg: '#E7F0FE', fg: '#0B3E8F', border: '#C4D9FB' },
  neutral: { bg: '#F0F0F0', fg: '#393939', border: '#DCDCDC' },
};

export const escapeHtml = (value = ''): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * PREMIUM TEMPLATE – one consistent, Outlook-safe chrome for EVERY email.
 * Branding (organization name / from-name / monogram) comes from Settings so
 * the ADMIN controls how every message identifies itself.
 */
export const renderBrandEmail = async (
  options: EmailTemplateOptions,
  branding: EmailBranding,
): Promise<string> => {
  const frontendUrl = env.frontendUrl;
  const org = escapeHtml(branding.organizationName);
  const tone = TONES[options.pill?.tone ?? 'info'];
  const name = escapeHtml(options.recipientName ?? '');
  const ctaText = escapeHtml(options.cta?.text || 'Open AttendEase');
  const ctaUrl = `${frontendUrl}${options.cta?.path || '/'}`;
  const rows = options.rows ?? [];

  // Inbox preview text (hidden preheader) beside the subject line
  const preheaderText = escapeHtml(
    String(options.preheader || options.introText || options.heading || '').replace(/<[^>]+>/g, ''),
  ).slice(0, 140);

  const monogram =
    String(branding.organizationName || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'AE';
  const year = new Date().getFullYear();

  const pillHtml = options.pill
    ? `<div style="margin:10px 0 0;">
        <span style="display:inline-block;padding:5px 14px;border-radius:999px;background:${tone.bg};color:${tone.fg};border:1px solid ${tone.border};font-size:12px;font-weight:700;letter-spacing:0.6px;">${escapeHtml(options.pill.label)}</span>
      </div>`
    : '';

  const introHtml = options.introText
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#393939;">${options.introText}</p>`
    : '';

  const rowsHtml = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;background:#FAFAFA;border:1px solid #E8E8E8;border-radius:10px;">
        ${rows
          .map(
            ([label, value], i) => `
        <tr>
          <td style="padding:${i === 0 ? '14px' : '12px'} 18px ${i === rows.length - 1 ? '14px' : '6px'} 18px;width:38%;font-size:11px;font-weight:700;letter-spacing:0.8px;color:#6F6F6F;text-transform:uppercase;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:${i === 0 ? '14px' : '12px'} 18px ${i === rows.length - 1 ? '14px' : '6px'} 6px;font-size:14px;font-weight:600;color:#161616;line-height:1.55;vertical-align:top;">${value}</td>
        </tr>`,
          )
          .join('')}
      </table>`
    : '';

  const noteHtml = options.noteText
    ? `<p style="margin:18px 0 0;padding:12px 16px;background:#F4F4F4;border-left:3px solid #0F62FE;border-radius:6px;font-size:13.5px;line-height:1.6;color:#393939;">${options.noteText}</p>`
    : '';

  return buildDocument({
    heading: options.heading,
    preheaderText, org, monogram, name,
    pillHtml, introHtml, rowsHtml, noteHtml,
    ctaText, ctaUrl, year,
  });
};

/** Fragment bag consumed by the document builder. */
interface BrandEmailParts {
  heading: string;
  preheaderText: string;
  org: string;
  monogram: string;
  name: string;
  pillHtml: string;
  introHtml: string;
  rowsHtml: string;
  noteHtml: string;
  ctaText: string;
  ctaUrl: string;
  year: number;
}

/** Assemble the final Outlook-safe HTML document from rendered fragments. */
const buildDocument = (parts: BrandEmailParts): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(parts.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F4F4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${parts.preheaderText}&nbsp;&zwnj;</div>
<div style="background-color:#F4F4F4;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#FFFFFF;border:1px solid #E0E0E0;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background-color:#161616;padding:20px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td width="40" bgcolor="#0F62FE" style="width:40px;height:40px;line-height:40px;border-radius:10px;text-align:center;font-size:16px;font-weight:800;color:#FFFFFF;">${parts.monogram}</td>
                <td style="padding-left:12px;font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:0.3px;">${parts.org}</td>
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
        <h2 style="margin:0;font-size:20px;line-height:1.35;color:#161616;">${parts.heading}</h2>
        ${parts.pillHtml}
        ${parts.name ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#393939;">Hi <strong>${parts.name}</strong>,</p>` : ''}
        ${parts.introHtml}
        ${parts.rowsHtml}
        ${parts.noteHtml}
        ${parts.name ? `<p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#393939;">Warm regards,<br /><strong style="color:#161616;">The ${parts.org} Team</strong></p>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 34px 38px 34px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td bgcolor="#0F62FE" style="border-radius:8px;">
              <a href="${parts.ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.3px;">${parts.ctaText}</a>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#8D8D8D;line-height:1.6;">Button not working? Paste this link in your browser:<br /><a href="${parts.ctaUrl}" style="color:#0F62FE;word-break:break-all;">${parts.ctaUrl}</a></p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#FAFAFA;border-top:1px solid #E8E8E8;padding:18px 34px;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:1px;color:#B5B5B5;">© ${parts.year} ${parts.org}</p>
        <p style="margin:0;font-size:12px;color:#8D8D8D;line-height:1.7;">This is an automated message from <strong>${parts.org}</strong> – please do not reply directly.<br />Need help? Contact your administrator or raise a request inside the app.</p>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`;
