import { ApiError } from '@/lib/api';

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /**
   * Decide whether a given failure is worth another attempt. Defaults to
   * `isRetryable`, which is the right answer for anything going through the
   * API client.
   */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Is this failure transient?
 *
 * A 4xx is the server saying the request itself is wrong: an unsupported file
 * type, a validation failure, a photo belonging to another school. Repeating it
 * unchanged cannot change the answer. That mattered most on the upload path,
 * where each attempt re-sent the entire file — an 8MB image the server could
 * not decode cost the teacher 24MB of mobile data and three seconds of
 * deliberate waiting before the tile finally turned red.
 *
 * 408 and 429 are the exceptions: both are explicitly "try this again later".
 *
 * 5xx and anything with no status at all (a dropped connection, a DNS blip)
 * are what backoff exists for.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 408 || error.status === 429) return true;
    return error.status >= 500;
  }
  // Not an ApiError — a network-level failure, which is exactly the retryable
  // case.
  return true;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 8000,
    shouldRetry = isRetryable,
  } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new Error('retryWithBackoff exhausted without result');
}
