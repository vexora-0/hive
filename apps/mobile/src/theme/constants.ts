/**
 * Hive App Constants
 *
 * Centralised magic numbers so they can be tuned in one place.
 */

// ── Interaction ──────────────────────────────────────────────────────

/** Minimum tap target size (px) per accessibility guidelines. */
export const MIN_TAP_SIZE = 44;

// ── OTP / Auth ───────────────────────────────────────────────────────

/** Number of digits in a one-time password. */
export const OTP_LENGTH = 6;

/** Seconds a user must wait before requesting a new OTP. */
export const RESEND_COOLDOWN_SEC = 60;

/** Maximum failed OTP attempts before lockout. */
export const MAX_OTP_ATTEMPTS = 3;

/** Lockout duration (seconds) after exceeding MAX_OTP_ATTEMPTS. */
export const LOCKOUT_DURATION_SEC = 300;

// ── Feed / Pagination ────────────────────────────────────────────────

/** Number of posts fetched per page in the feed. */
export const FEED_PAGE_SIZE = 20;

// ── Uploads ──────────────────────────────────────────────────────────

/** Maximum number of images that can be attached to a single post. */
export const MAX_UPLOAD_IMAGES = 20;

/** Maximum allowed file size in megabytes. */
export const MAX_FILE_SIZE_MB = 25;

// ── React Query / Caching ────────────────────────────────────────────

/** Time (ms) before cached data is considered stale (5 minutes). */
export const STALE_TIME_MS = 300_000;

/** Time (ms) before unused cache entries are garbage-collected (30 minutes). */
export const GC_TIME_MS = 1_800_000;

// ── Animation ────────────────────────────────────────────────────────

/** Default animation duration in milliseconds. */
export const ANIMATION_DURATION = 300;
