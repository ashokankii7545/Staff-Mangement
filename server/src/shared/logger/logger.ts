import { env } from '../../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: '\x1b[90m', // grey
  info: '\x1b[36m',  // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';
const PREFIX = '[api]';

/**
 * Logger – SINGLETON structured console logger.
 * Level gate comes from env (`LOG_LEVEL`) so production can silence debug spam.
 * Swap the `write` internals for pino/winston later without touching callers.
 */
class Logger {
  private static instance: Logger | null = null;

  private readonly minWeight: number;

  private constructor() {
    this.minWeight = LEVEL_WEIGHT[env.logLevel];
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private write(level: LogLevel, message: string, details?: unknown): void {
    if (LEVEL_WEIGHT[level] < this.minWeight) return;

    const stamp = new Date().toISOString();
    const line = `${LEVEL_COLOR[level]}${PREFIX} ${stamp} ${level.toUpperCase().padEnd(5)}${RESET} ${message}`;

    if (details !== undefined) {
      // eslint-disable-next-line no-console
      console.log(line, details);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  }

  public debug(message: string, details?: unknown): void {
    this.write('debug', message, details);
  }

  public info(message: string, details?: unknown): void {
    this.write('info', message, details);
  }

  public warn(message: string, details?: unknown): void {
    this.write('warn', message, details);
  }

  /** Accepts Error/unknown and prints its stack/message cleanly. */
  public error(message: string, error?: unknown): void {
    const details =
      error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ''}` : error;
    this.write('error', message, details);
  }
}

export const logger = Logger.getInstance();
