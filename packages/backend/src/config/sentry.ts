import * as Sentry from '@sentry/node';
import { env } from './env';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// PII scrubbing
// ---------------------------------------------------------------------------
//
// Hive handles photographs of children and the names and dates of birth that
// go with them. An error tracker is an outbound copy of whatever context an
// exception happened to carry, sitting on a third party's servers, so it is
// worth being strict about what leaves the process.
//
// Four things must never reach Sentry:
//
//   1. Bearer tokens and the service-role key — a leaked service-role key is a
//      full database compromise; it bypasses RLS by design.
//   2. Email addresses — the only direct identifier in `profiles`, and the
//      login credential.
//   3. Photo URLs — these are signed and confer access to the file. A photo
//      URL in a stack frame is the photo itself.
//   4. Client IP addresses.

const REDACTED = '[redacted]';

/** Header names dropped wholesale, case-insensitively. */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-idempotency-key',
  'apikey',
  'x-supabase-auth',
]);

/** Keys whose values are replaced wherever they appear in an object tree. */
const SENSITIVE_KEYS = [
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'password',
  'apikey',
  'api_key',
  'secret',
  'servicekey',
  'service_key',
  'authorization',
  'email',
  'jwt',
];

const PATTERNS: Array<[RegExp, string]> = [
  // Bearer tokens and bare JWTs
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${REDACTED}`],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, REDACTED],
  // Email addresses
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  // Supabase Storage signed URLs, and the local /uploads path they replace
  [/https?:\/\/\S*\/storage\/v1\/object\/\S*/gi, REDACTED],
  [/https?:\/\/\S*\/uploads\/\S*/gi, REDACTED],
  [/\btoken=[^&\s"']+/gi, `token=${REDACTED}`],
];

/** Apply every pattern to a string. */
export function scrubString(value: string): string {
  return PATTERNS.reduce((acc, [re, to]) => acc.replace(re, to), value);
}

/**
 * Walk an arbitrary value, redacting sensitive keys and scrubbing every string.
 *
 * `depth` bounds the recursion — Sentry events can contain deeply nested or
 * cyclic request objects, and a scrubber that hangs is worse than no scrubber.
 */
function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;

  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }

  const out: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const normalised = key.toLowerCase().replace(/[-_]/g, '');

    if (SENSITIVE_KEYS.some((k) => normalised === k.replace(/[-_]/g, ''))) {
      out[key] = REDACTED;
      continue;
    }

    out[key] = scrubValue(val, depth + 1);
  }

  return out;
}

/**
 * `beforeSend` — the last thing that runs before an event leaves the process.
 *
 * Returning `null` drops the event entirely; anything returned is what gets
 * transmitted.
 */
export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  // Sentry attaches the user's IP when sendDefaultPii is on. It is off below,
  // but clear it explicitly so a future config change cannot switch it back on
  // silently.
  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
  }
  delete (event as { server_name?: string }).server_name;

  if (event.request) {
    if (event.request.headers) {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(event.request.headers)) {
        headers[name] = SENSITIVE_HEADERS.has(name.toLowerCase())
          ? REDACTED
          : scrubString(String(value));
      }
      event.request.headers = headers;
    }

    delete event.request.cookies;
    delete (event.request as { env?: unknown }).env;

    if (event.request.url) {
      event.request.url = scrubString(event.request.url);
    }
    if (event.request.query_string) {
      event.request.query_string = scrubValue(
        event.request.query_string,
      ) as typeof event.request.query_string;
    }
    if (event.request.data !== undefined) {
      event.request.data = scrubValue(event.request.data);
    }
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  }

  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);

      for (const frame of ex.stacktrace?.frames ?? []) {
        if (frame.vars) {
          frame.vars = scrubValue(frame.vars) as typeof frame.vars;
        }
      }
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? scrubString(crumb.message) : crumb.message,
      data: crumb.data
        ? (scrubValue(crumb.data) as typeof crumb.data)
        : crumb.data,
    }));
  }

  return event;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

let enabled = false;

/**
 * Initialise Sentry, if a DSN is configured.
 *
 * Call before anything else in `index.ts` so instrumentation is installed
 * before the modules it patches are loaded.
 *
 * With no `SENTRY_DSN` this is a no-op, which keeps local development and the
 * test suite silent without needing a separate flag.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    logger.info('Sentry disabled (no SENTRY_DSN)');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,

    // Never opt into PII. The scrubber below is defence in depth, not the
    // primary control.
    sendDefaultPii: false,

    // Errors only. Performance tracing on a project this size is cost without
    // insight, and every span is another place a signed URL could hide.
    tracesSampleRate: 0,

    beforeSend: scrubEvent,

    beforeBreadcrumb: (crumb) => {
      // HTTP breadcrumbs record full URLs, which for this service means signed
      // photo URLs and Supabase requests carrying the service-role key.
      if (crumb.category === 'http' || crumb.category === 'fetch') return null;
      return crumb;
    },
  });

  enabled = true;
  logger.info('Sentry initialised', { environment: env.NODE_ENV });
}

/** Whether `initSentry` found a DSN and initialised the SDK. */
export function isSentryEnabled(): boolean {
  return enabled;
}

export { Sentry };
