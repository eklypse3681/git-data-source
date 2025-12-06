/**
 * Retry Utility with Exponential Backoff
 *
 * This module provides retry logic with exponential backoff for handling
 * API rate limits and transient failures, especially for GitHub API calls.
 */

/**
 * Rate limit information from response headers
 */
export interface RateLimitInfo {
  /** Number of requests remaining */
  remaining: number;
  /** Total request limit */
  limit: number;
  /** Timestamp when the limit resets (Unix epoch) */
  reset: number;
  /** Seconds to wait before retrying (from Retry-After header) */
  retryAfter?: number;
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay in milliseconds */
  baseDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Exponential backoff factor */
  factor?: number;
  /** Function to determine if error is retryable */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Callback invoked before each retry */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 60000,
  factor: 2
};

/**
 * Extract rate limit information from response headers
 */
export function extractRateLimitInfo(headers: Record<string, string>): RateLimitInfo | null {
  const remaining = headers['x-ratelimit-remaining'];
  const limit = headers['x-ratelimit-limit'];
  const reset = headers['x-ratelimit-reset'];
  const retryAfter = headers['retry-after'];

  if (!remaining || !limit || !reset) {
    return null;
  }

  return {
    remaining: parseInt(remaining, 10),
    limit: parseInt(limit, 10),
    reset: parseInt(reset, 10),
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // HTTP status codes that should be retried
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  // GitHub specific errors
  if (error.response?.status && retryableStatuses.includes(error.response.status)) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for next retry attempt using exponential backoff
 */
export function calculateDelay(
  attempt: number,
  options: RetryOptions = {},
  rateLimitInfo?: RateLimitInfo
): number {
  const { baseDelay, maxDelay, factor } = { ...DEFAULT_OPTIONS, ...options };

  // If we have rate limit info with retry-after, use that
  if (rateLimitInfo?.retryAfter) {
    return Math.min(rateLimitInfo.retryAfter * 1000, maxDelay);
  }

  // If we hit rate limit, wait until reset time
  if (rateLimitInfo && rateLimitInfo.remaining === 0) {
    const now = Math.floor(Date.now() / 1000);
    const waitTime = Math.max(rateLimitInfo.reset - now, 0) * 1000;
    return Math.min(waitTime, maxDelay);
  }

  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(factor, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
  const delay = exponentialDelay + jitter;

  return Math.min(delay, maxDelay);
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => await api.getData(),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries,
    shouldRetry = isRetryableError,
    onRetry
  } = { ...DEFAULT_OPTIONS, ...options };

  let lastError: any;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      attempt++;

      // Don't retry if we've exhausted attempts
      if (attempt > maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!shouldRetry(error, attempt)) {
        throw error;
      }

      // Extract rate limit info from error
      const rateLimitInfo = error.response?.headers
        ? extractRateLimitInfo(error.response.headers)
        : null;

      // Calculate delay
      const delay = calculateDelay(attempt, options, rateLimitInfo ?? undefined);

      // Notify about retry
      if (onRetry) {
        onRetry(error, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retry wrapper for a function
 *
 * @param fn - Function to wrap
 * @param options - Retry configuration options
 * @returns Wrapped function that automatically retries on failure
 *
 * @example
 * ```typescript
 * const fetchWithRetry = withRetry(
 *   async (url: string) => fetch(url),
 *   { maxRetries: 3 }
 * );
 *
 * const response = await fetchWithRetry('https://api.github.com');
 * ```
 */
export function withRetry<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    return retryWithBackoff(() => fn(...args), options);
  };
}

/**
 * Batch iterator with retry support
 *
 * Useful for paginated API calls where each page request should have retry logic.
 *
 * @param fetchPage - Function to fetch a page of results
 * @param options - Retry configuration options
 * @yields Items from each page
 *
 * @example
 * ```typescript
 * for await (const item of retryablePageIterator(
 *   async (page) => api.getPage(page),
 *   { maxRetries: 3 }
 * )) {
 *   console.log(item);
 * }
 * ```
 */
export async function* retryablePageIterator<T>(
  fetchPage: (page: number) => Promise<T[] | null>,
  options: RetryOptions = {}
): AsyncGenerator<T, void, undefined> {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const items = await retryWithBackoff(
      () => fetchPage(page),
      options
    );

    if (!items || items.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of items) {
      yield item;
    }

    page++;
  }
}
