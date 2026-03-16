import { logger } from './logger';
import { RETRY_MAX, RETRY_BASE_DELAY_MS } from '../config/constants';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = RETRY_MAX,
    baseDelayMs = RETRY_BASE_DELAY_MS,
    label = 'operation',
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const status =
        (err as { status?: number })?.status ||
        (err as { response?: { status?: number } })?.response?.status;

      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }

      if (attempt === maxRetries) break;

      const delay = baseDelayMs * Math.pow(2, attempt);
      logger.warn(`${label} failed — retrying`, {
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        status,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
