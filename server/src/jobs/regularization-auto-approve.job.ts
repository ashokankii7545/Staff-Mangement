import { logger } from '../shared/logger/logger.js';
import { regularizationService } from '../modules/regularization/regularization.service.js';

/** Boot-time scheduler: first sweep 30s after start, then once every 24h */
export const startRegularizationAutoApprover = (): void => {
  setTimeout(() => {
    void regularizationService.autoResolveStale();
  }, 30_000);
  setInterval(() => {
    void regularizationService.autoResolveStale();
  }, 24 * 60 * 60 * 1000);
};
