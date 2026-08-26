import { useEffect, useRef } from 'react';
import { useNotification } from './';

const DEDUPE_WINDOW_MS = 1500;

/**
 * ApiErrorListener – Global API error toast announcer.
 *
 * Listens (exactly once) for `global-api-error` CustomEvents dispatched by the
 * Apollo error handler and surfaces deduplicated, user-friendly toasts.
 */
const ApiErrorListener = () => {
  // Stable ref keeps the effect subscribed exactly once for the app lifetime
  const notifyRef = useRef(null);

  useEffect(() => {
    const recent = new Map();

    const isDuplicate = (key) => {
      const now = Date.now();
      const lastSeen = recent.get(key) || 0;
      recent.set(key, now);
      if (recent.size > 50) {
        for (const [k, t] of recent) {
          if (now - t >= DEDUPE_WINDOW_MS) recent.delete(k);
        }
      }
      return now - lastSeen < DEDUPE_WINDOW_MS;
    };

    const handleGlobalError = (event) => {
      const { detail } = event;
      const text = detail?.statusCode
        ? `Server error (${detail.statusCode}). Please try again shortly.`
        : 'Network error. Please check your internet connection.';

      if (isDuplicate(text)) return;
      notifyRef.current?.error(text);
    };

    window.addEventListener('global-api-error', handleGlobalError);
    return () => window.removeEventListener('global-api-error', handleGlobalError);
  }, []);

  // Capture latest notify methods without re-subscribing listeners
  const notify = useNotification();
  notifyRef.current = notify;

  return null;
};

export default ApiErrorListener;
