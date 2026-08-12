import { describe, it, expect, vi, afterEach } from 'vitest';

import { ApiError } from '@/lib/api';
import { isRetryable, retryWithBackoff } from '@/utils/retry';

/**
 * The retry policy.
 *
 * Before the fix everything was retried three times. On the upload path each
 * attempt re-sends the whole file, so an 8MB image the server refused for its
 * format cost the teacher 24MB of mobile data and ~3s of deliberate backoff
 * before the tile turned red — for an answer that could not change. A 4xx is
 * the server saying the request itself is wrong; only 408 and 429 mean "try
 * again later".
 */
describe('isRetryable', () => {
  describe('client errors are not retried', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 415, 422]) {
      it(`${status}`, () => {
        expect(isRetryable(new ApiError(status, 'nope'))).toBe(false);
      });
    }
  });

  describe('the two 4xx that explicitly mean "later"', () => {
    it('408 Request Timeout is retried', () => {
      expect(isRetryable(new ApiError(408, 'timeout'))).toBe(true);
    });

    it('429 Too Many Requests is retried', () => {
      expect(isRetryable(new ApiError(429, 'slow down'))).toBe(true);
    });
  });

  describe('server errors are retried', () => {
    for (const status of [500, 502, 503, 504]) {
      it(`${status}`, () => {
        expect(isRetryable(new ApiError(status, 'boom'))).toBe(true);
      });
    }
  });

  it('retries a failure with no status at all', () => {
    // A dropped connection or a DNS blip never becomes an ApiError — fetch
    // rejects before there is a response to read a status from. This is
    // precisely what backoff exists for.
    expect(isRetryable(new TypeError('Network request failed'))).toBe(true);
    expect(isRetryable(new Error('Aborted'))).toBe(true);
    expect(isRetryable(undefined)).toBe(true);
  });
});

describe('retryWithBackoff', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call the function again after a non-retryable failure', async () => {
    // The point of the whole change. Against the pre-fix policy this is three
    // calls and two backoff sleeps — three full file transfers on the upload
    // path.
    const fn = vi.fn(async () => {
      throw new ApiError(415, 'Unsupported file type');
    });

    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow(
      'Unsupported file type',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops on the first non-retryable failure even mid-sequence', async () => {
    // A 503 followed by a 400: the second answer is final, so there must be no
    // third attempt.
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockRejectedValueOnce(new ApiError(400, 'bad request'));

    await expect(retryWithBackoff(fn, { maxAttempts: 5, baseDelayMs: 0 })).rejects.toThrow(
      'bad request',
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses every attempt for a retryable failure and rethrows the last error', async () => {
    const fn = vi.fn(async () => {
      throw new ApiError(503, 'unavailable');
    });

    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow(
      'unavailable',
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns the value once an attempt succeeds, and stops there', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError(500, 'transient'))
      .mockResolvedValue('ok');

    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls the function once when it succeeds first time', async () => {
    const fn = vi.fn(async () => 'ok');

    await expect(retryWithBackoff(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('honours a caller-supplied shouldRetry over the default', async () => {
    // `useUpload` does not override it, but the option is the seam that lets a
    // caller narrow the policy further.
    const shouldRetry = vi.fn(() => false);
    const fn = vi.fn(async () => {
      throw new ApiError(503, 'unavailable');
    });

    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 0, shouldRetry }),
    ).rejects.toThrow('unavailable');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially and stops doubling at maxDelayMs', async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => {
      throw new ApiError(500, 'boom');
    });

    const pending = retryWithBackoff(fn, {
      maxAttempts: 4,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
    });
    // Nothing must be awaited un-caught: the promise rejects at the end.
    const settled = pending.catch(() => 'rejected');

    // First attempt runs synchronously on the first tick.
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // 1000ms, not sooner.
    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    // Then 2000ms.
    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);

    // 4000 would be next but maxDelayMs caps it there, so still 4000.
    await vi.advanceTimersByTimeAsync(3999);
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(4);

    await expect(settled).resolves.toBe('rejected');
  });

  it('does not sleep at all when the failure is not retryable', async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => {
      throw new ApiError(422, 'invalid');
    });

    const settled = retryWithBackoff(fn, { maxAttempts: 3 }).catch(
      (err: unknown) => (err as Error).message,
    );

    // No timers advanced. If the policy were still "retry everything" this
    // would hang here with one attempt made and the suite would time out.
    await expect(settled).resolves.toBe('invalid');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
