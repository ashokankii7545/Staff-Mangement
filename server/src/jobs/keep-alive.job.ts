import { env } from '../config/env.js';
import { logger } from '../shared/logger/logger.js';

/**
 * KEEP-ALIVE – free-tier hosting (Render) spins a web service down after
 * ~15 minutes of inbound inactivity, and the next request then pays a
 * 30-60 s cold-start ("app khuli par loading hi rahi"). This job pings the
 * service's own /health endpoint (and the face-service, which is also
 * free-tier) well inside that window so the instance never sleeps.
 *
 * Config:
 *   - Target URL: KEEP_ALIVE_URL, else Render's auto-injected
 *     RENDER_EXTERNAL_URL. Empty → job stays off (local dev / paid hosts).
 *   - Interval: every 10 minutes (safely inside the 15-min idle window).
 *   - First ping runs 30 s after boot to confirm the public URL resolves.
 *
 * NOTE: for belt-and-braces uptime you can also point a free external
 * monitor (UptimeRobot / cron-job.org) at the same /health URL.
 */

const PING_INTERVAL_MS = 10 * 60 * 1000;
const FIRST_PING_DELAY_MS = 30 * 1000;

const ping = async (url: string, label: string): Promise<void> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      logger.warn(`Keep-alive ${label} responded ${res.status}`);
    }
  } catch (error) {
    // Never crash the app for a failed ping – just note it.
    logger.warn(`Keep-alive ping to ${label} failed`, error);
  }
};

/** One sweep: ping the API itself, plus the face-service when configured. */
export const runKeepAlive = async (): Promise<void> => {
  if (!env.keepAliveUrl) return;
  const targets: Array<[string, string]> = [
    [`${env.keepAliveUrl.replace(/\/$/, '')}/health`, 'api-self'],
  ];
  if (env.faceServiceUrl) {
    targets.push([`${env.faceServiceUrl.replace(/\/$/, '')}/health`, 'face-service']);
  }
  await Promise.all(targets.map(([url, label]) => ping(url, label)));
};

/** Boot scheduler: first ping 30 s after start, then every 10 minutes. */
export const startKeepAlive = (): void => {
  if (!env.keepAliveUrl) {
    logger.info('Keep-alive disabled (no KEEP_ALIVE_URL / RENDER_EXTERNAL_URL).');
    return;
  }
  logger.info(`Keep-alive armed → pinging ${env.keepAliveUrl}/health every 10 min`);
  setTimeout(() => void runKeepAlive(), FIRST_PING_DELAY_MS);
  setInterval(() => void runKeepAlive(), PING_INTERVAL_MS);
};