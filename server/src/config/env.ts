import dotenv from 'dotenv';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * ENV CONFIGURATION – THE SINGLE SOURCE OF TRUTH
 * ────────────────────────────────────────────────────────────────────────────
 * Rules of this file (enforced by convention & code review):
 *   1. This is the ONLY file in the entire backend that imports `dotenv`
 *      or reads `process.env` directly.
 *   2. Every other module imports the typed, frozen `env` object from here:
 *         import { env } from '../../config/env.js';
 *   3. Required variables fail FAST at boot with a loud error – the server
 *      refuses to start in a half-configured state.
 */

/** Fully-typed shape of everything the application can know about its env. */
export interface AppEnv {
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly port: number;
  /** Supabase Postgres connection string (postgres.js / Drizzle). */
  readonly databaseUrl: string;
  /** 'no-verify' relaxes TLS cert verification (Supabase pooled endpoints). */
  readonly databaseSsl: string | null;
  /** Max connections in the postgres.js pool. */
  readonly databasePoolMax: number;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  /** Long-lived refresh token TTL (silent session renewal). */
  readonly jwtRefreshExpiresIn: string;
  /** null → allow every origin (dev). Array → strict allow-list (prod). */
  readonly corsOrigins: string[] | null;
  /** Frontend base URL used inside emails (reset links, CTA buttons). */
  readonly frontendUrl: string;
  readonly uploadDir: string;
  readonly googleClientId: string;
  readonly vpnApiKey: string;
  /** Optional external face-recognition service URL. Empty → feature off. */
  readonly faceServiceUrl: string;
  /** Optional bearer token for the face service (must match its FACE_SERVICE_TOKEN). */
  readonly faceServiceToken: string;
  /**
   * WebAuthn (fingerprint / passkey) relying-party config.
   * rpId MUST equal the browser hostname the app runs on (e.g. 'localhost' in
   * dev, 'app.example.com' in prod). expectedOrigins MUST exactly match the
   * browser origin(s) including scheme+port – the WebAuthn ceremony only
   * happens on the CLIENT origin, the API server just verifies.
   */
  readonly webauthn: {
    readonly rpId: string;
    readonly rpName: string;
    readonly expectedOrigins: readonly string[];
  };
  /**
   * Public URL used to self-ping /health and keep free-tier hosts awake
   * (Render auto-injects RENDER_EXTERNAL_URL; KEEP_ALIVE_URL overrides it).
   * Empty → keep-alive job stays off.
   */
  readonly keepAliveUrl: string;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly smtp: {
    readonly host: string | null;
    readonly port: number;
    readonly secure: boolean;
    readonly email: string | null;
    readonly password: string | null;
  };
  /** Cloudflare R2 object storage for selfies/documents/images. */
  readonly r2: {
    readonly accountId: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly bucketName: string;
    readonly publicUrl: string;
  };
}

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

const parseLogLevel = (raw: string | undefined): AppEnv['logLevel'] => {
  const value = (raw ?? 'info').toLowerCase();
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : 'info';
};

/**
 * Env – SINGLETON class that owns environment parsing/validation.
 * Access everywhere via the exported `env` constant below.
 */
class EnvConfig {
  private static instance: EnvConfig | null = null;

  public readonly values: AppEnv;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {
    dotenv.config();

    // ── Business timezone guard ──────────────────────────────────────────────
    // Attendance day-boundaries ("today", shift-start lateness, monthly
    // accrual) must follow BUSINESS time, not the deploy-host clock – cloud
    // VMs are UTC by default and would shift every Indian date by ~5½ hours.
    // POSIX hosts honour TZ at runtime; Windows devs are already on IST.
    process.env.TZ = process.env.TZ || 'Asia/Kolkata';

    // ── Boot-time guard: never run half-configured ──
    const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      console.error(`❌ FATAL: Missing required env var(s): ${missing.join(', ')}`);
      process.exit(1);
    }

    const nodeEnvRaw = (process.env.NODE_ENV ?? 'development').toLowerCase();
    const nodeEnv: AppEnv['nodeEnv'] =
      nodeEnvRaw === 'production' ? 'production'
      : nodeEnvRaw === 'test' ? 'test'
      : 'development';

    const corsRaw = process.env.CORS_ORIGIN?.trim();

    this.values = Object.freeze({
      nodeEnv,
      port: parseInt(process.env.PORT ?? '8080', 10),
      databaseUrl: process.env.DATABASE_URL!,
      databaseSsl: process.env.DATABASE_SSL?.trim() || null,
      databasePoolMax: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
      jwtSecret: process.env.JWT_SECRET!,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
      corsOrigins: corsRaw ? corsRaw.split(',').map((o) => o.trim()).filter(Boolean) : null,
      frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
      vpnApiKey: process.env.VPNAPI_KEY ?? '',
      faceServiceUrl: process.env.FACE_SERVICE_URL?.trim() || '',
      faceServiceToken: process.env.FACE_SERVICE_TOKEN?.trim() || '',
      webauthn: Object.freeze({
        rpId: process.env.WEBAUTHN_RP_ID?.trim() || 'localhost',
        rpName: process.env.WEBAUTHN_RP_NAME?.trim() || 'EdgeAttendance',
        expectedOrigins: Object.freeze(
          (process.env.WEBAUTHN_ORIGINS?.trim() || 'http://localhost:5173')
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean),
        ),
      }),
      keepAliveUrl:
        process.env.KEEP_ALIVE_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim() || '',
      logLevel: parseLogLevel(process.env.LOG_LEVEL),
      smtp: Object.freeze({
        host: process.env.SMTP_HOST?.trim() || null,
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        email: process.env.SMTP_EMAIL?.trim() || null,
        password: process.env.SMTP_PASSWORD?.trim() || null,
      }),
      r2: Object.freeze({
        accountId: process.env.R2_ACCOUNT_ID ?? '',
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
        bucketName: process.env.R2_BUCKET_NAME ?? '',
        publicUrl: process.env.R2_PUBLIC_URL ?? '',
      }),
    });
  }

  /** Classic lazy singleton accessor. */
  public static getInstance(): EnvConfig {
    if (!EnvConfig.instance) {
      EnvConfig.instance = new EnvConfig();
    }
    return EnvConfig.instance;
  }

  public get all(): AppEnv {
    return this.values;
  }

  public get isProduction(): boolean {
    return this.values.nodeEnv === 'production';
  }

  public get isDevelopment(): boolean {
    return this.values.nodeEnv === 'development';
  }
}

/** Application-wide frozen env object – import this, nothing else. */
export const env: AppEnv = EnvConfig.getInstance().all;
