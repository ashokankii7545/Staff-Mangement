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
  readonly mongoUri: string;
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  /** null → allow every origin (dev). Array → strict allow-list (prod). */
  readonly corsOrigins: string[] | null;
  /** Frontend base URL used inside emails (reset links, CTA buttons). */
  readonly frontendUrl: string;
  readonly uploadDir: string;
  readonly googleClientId: string;
  readonly vpnApiKey: string;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly smtp: {
    readonly host: string | null;
    readonly port: number;
    readonly secure: boolean;
    readonly email: string | null;
    readonly password: string | null;
  };
}

const REQUIRED_VARS = ['MONGO_URI', 'JWT_SECRET'] as const;

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
      mongoUri: process.env.MONGO_URI!,
      jwtSecret: process.env.JWT_SECRET!,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
      corsOrigins: corsRaw ? corsRaw.split(',').map((o) => o.trim()).filter(Boolean) : null,
      frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
      vpnApiKey: process.env.VPNAPI_KEY ?? '',
      logLevel: parseLogLevel(process.env.LOG_LEVEL),
      smtp: Object.freeze({
        host: process.env.SMTP_HOST?.trim() || null,
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        email: process.env.SMTP_EMAIL?.trim() || null,
        password: process.env.SMTP_PASSWORD?.trim() || null,
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
