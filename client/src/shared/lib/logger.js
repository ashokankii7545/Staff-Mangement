const DEFAULT_CONFIG = {
  flushIntervalMs: 5000,
  maxBatchSize: 30,
  maxBufferSize: 500,
  maxBreadcrumbs: 30,
  endpoint: '/api/v1/telemetry/logs',
  environment: 'development',
  minLevel: 'INFO',
  samplingRate: 1,
  retryAttempts: 2,
  persistQueue: true,
  autoFlushOnUnload: true,
  includePerformanceMetrics: false,
};

export class DistributedEnterpriseLogger {
  constructor(config) {
    this.buffer = [];
    this.breadcrumbs = [];
    this.correlationId = 'NO_CORRELATION_ID';
    this.flushTimer = null;
    this.isFlushing = false;
    this.retryQueue = [];
    this.storageKey = '__enterprise_logger_queue__';
    this.SENSITIVE_KEYS = [
      'password', 'token', 'authorization', 'secret', 'creditcard', 'ssn', 'cookie', 'apikey', 'privatekey'
    ];
    
    this.config = this.validateConfig({ ...DEFAULT_CONFIG, ...config });
    this.initialize();
  }

  setCorrelationId(id) {
    this.correlationId = id || 'NO_CORRELATION_ID';
  }

  clearCorrelationId() {
    this.correlationId = 'NO_CORRELATION_ID';
  }

  addBreadcrumb(action) {
    this.breadcrumbs.push({
      timestamp: new Date().toISOString(),
      action: action.substring(0, 200),
    });
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  debug(message, context) {
    if (this.config.environment === 'development') {
      console.debug(`[DEBUG] [${this.correlationId}]`, message, context);
    }
  }

  info(message, context) {
    this.log('INFO', message, context);
  }

  warn(message, context) {
    this.log('WARN', message, context);
  }

  error(message, error) {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    this.log('ERROR', message, { error: errorDetails });
    this.flush(true);
  }

  fatal(message, error) {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    this.log('FATAL', message, { error: JSON.stringify(errorDetails, null, 2) });
    this.flush(true);
  }

  flush() { this.buffer = []; }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('pagehide', this.handlePageHide);
      window.removeEventListener('online', this.handleOnline);
    }
  }

  log(level, message, context) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    if (levels.indexOf(level) < levels.indexOf(this.config.minLevel)) {
      return;
    }

    if (Math.random() > this.config.samplingRate) {
      return;
    }

    const entry = this.createLogEntry(level, message, context);

    if (this.config.environment === 'development') {
      this.logToConsole(level, entry);
    } else {
      if (level === 'ERROR' || level === 'FATAL') {
        console.error(`[${level}]`, entry);
      }
    }

    this.pushToBuffer(entry);

    if (this.buffer.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  createLogEntry(level, message, context) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      context: this.sanitize(context),
      breadcrumbs: [...this.breadcrumbs],
      metadata: this.collectMetadata(),
    };
  }

  logToConsole(level, entry) {
    const prefix = `[${level}] [${entry.correlationId}]`;
    switch (level) {
      case 'INFO':
        console.info(prefix, entry);
        break;
      case 'WARN':
        console.warn(prefix, entry);
        break;
      case 'ERROR':
      case 'FATAL':
        console.error(prefix, entry);
        break;
      default:
        console.log(prefix, entry);
    }
  }

  pushToBuffer(entry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.config.maxBufferSize) {
      this.buffer.shift();
    }
  }

  sanitize(data, seen = new WeakSet()) {
    if (data === null || typeof data !== 'object') return data;

    if (seen.has(data)) {
      return '[Circular]';
    }
    seen.add(data);

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item, seen));
    }

    const clone = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (this.SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
        clone[key] = '[REDACTED_SECURE]';
      } else if (typeof value === 'object') {
        clone[key] = this.sanitize(value, seen);
      } else if (typeof value === 'function') {
        clone[key] = '[Function]';
      } else {
        clone[key] = value;
      }
    }
    return clone;
  }

  collectMetadata() {
    const metadata = {
      url: typeof window !== 'undefined' ? window.location?.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    if (this.config.includePerformanceMetrics && typeof performance !== 'undefined') {
      const nav = performance.getEntriesByType('navigation')[0];
      metadata.performance = {
        loadTime: nav?.loadEventEnd ?? 0,
        domReady: nav?.domContentLoadedEventEnd ?? 0,
      };
    }
    return metadata;
  }

  canUseBeacon(payload) {
    return payload.length < 60 * 1024;
  }

  sendViaFetch(payload, batch) {
    fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      })
      .catch(err => {
        this.handleSendFailure(batch, err);
      });
  }

  handleSendFailure(batch, error) {
    if (this.config.retryAttempts > 0) {
      let attempts = 0;
      const retry = () => {
        attempts++;
        const payload = JSON.stringify({ logs: batch });
        fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          })
          .catch(err => {
            if (attempts < this.config.retryAttempts) {
              setTimeout(retry, attempts * 1000);
            } else {
              this.persistToStorage(batch);
            }
          });
      };
      retry();
    } else {
      this.persistToStorage(batch);
    }
  }

  persistToStorage(batch) {
    if (!this.config.persistQueue || typeof localStorage === 'undefined') return;

    try {
      const existing = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      const merged = [...existing, ...batch];
      const maxStored = 1000;
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(merged.slice(-maxStored))
      );
    } catch (e) {
      console.error('Failed to persist logs to localStorage', e);
    }
  }

  requeueLogs(batch) {
    this.buffer = [...batch, ...this.buffer];
    if (this.buffer.length > this.config.maxBufferSize) {
      this.buffer = this.buffer.slice(0, this.config.maxBufferSize);
    }
  }

  loadPersistedQueue() {
    if (!this.config.persistQueue || typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const logs = JSON.parse(stored);
        this.buffer = [...this.buffer, ...logs];
        localStorage.removeItem(this.storageKey);
      }
    } catch (e) {
      console.error('Failed to load persisted logs', e);
    }
  }

  initialize() {
    this.loadPersistedQueue();

    if (typeof window === 'undefined') return;

    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);

    if (this.config.autoFlushOnUnload) {
      this.handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          this.flush(true);
        }
      };
      this.handlePageHide = () => {
        this.flush(true);
      };
      this.handleOnline = () => {
        this.loadPersistedQueue();
        this.flush();
      };
      window.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('pagehide', this.handlePageHide);
      window.addEventListener('online', this.handleOnline);
    }
  }

  validateConfig(config) {
    const errors = [];
    if (config.flushIntervalMs <= 0) errors.push('flushIntervalMs must be > 0');
    if (config.maxBatchSize <= 0) errors.push('maxBatchSize must be > 0');
    if (config.maxBufferSize <= 0) errors.push('maxBufferSize must be > 0');
    if (config.maxBreadcrumbs < 0) errors.push('maxBreadcrumbs cannot be negative');
    if (config.samplingRate < 0 || config.samplingRate > 1) errors.push('samplingRate must be between 0 and 1');
    if (!['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].includes(config.minLevel)) errors.push('invalid minLevel');

    if (errors.length) {
      throw new Error(`Logger configuration invalid: ${errors.join(', ')}`);
    }
    return config;
  }
}

export const logger = new DistributedEnterpriseLogger({
  environment: import.meta.env.MODE || 'development',
  endpoint: 'https://telemetry.yourcompany.com/logs',
  flushIntervalMs: 10000,
  maxBatchSize: 30,
  minLevel: 'INFO',
  samplingRate: 1,
  persistQueue: true,
  includePerformanceMetrics: true,
});

