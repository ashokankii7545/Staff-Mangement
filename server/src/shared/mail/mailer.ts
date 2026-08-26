import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * Mailer – SINGLETON owner of the SMTP transport.
 * When SMTP credentials are absent the getter yields null and callers fall
 * back to console-stub logging (dev friendly, zero crash risk).
 */
class Mailer {
  private static instance: Mailer | null = null;

  private transporter: Transporter | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): Mailer {
    if (!Mailer.instance) {
      Mailer.instance = new Mailer();
    }
    return Mailer.instance;
  }

  /** True when real emails can be sent. */
  public get configured(): boolean {
    return Boolean(env.smtp.email && env.smtp.password);
  }

  /** Lazily created shared transport (gmail service or explicit host). */
  public get transport(): Transporter | null {
    if (!this.configured) return null;
    if (this.transporter) return this.transporter;

    const transportOptions = env.smtp.host
      ? {
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.secure,
          auth: { user: env.smtp.email!, pass: env.smtp.password! },
        }
      : {
          service: 'gmail',
          auth: { user: env.smtp.email!, pass: env.smtp.password! },
        };

    this.transporter = nodemailer.createTransport(transportOptions);

    // Fail fast & loud on bad credentials – but never crash the server.
    void this.transporter.verify((err) => {
      if (err) logger.error('SMTP configuration problem', err);
      else logger.info(`SMTP ready – emails will be sent from ${env.smtp.email}`);
    });

    return this.transporter;
  }
}

export const mailer = Mailer.getInstance();
