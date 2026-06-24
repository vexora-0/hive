import * as Sentry from '@sentry/react-native';

import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// PII scrubbing
// ---------------------------------------------------------------------------
//
// The mirror of packages/backend/src/config/sentry.ts. Keep the two in step:
// a leak on either side is the same leak.
//
// The mobile client is the more dangerous of the two, because it holds the
// user's session. A crash report that captured a redux-ish state dump or a
// fetch breadcrumb would carry the access token and the signed photo URLs the
// feed is currently displaying.

const REDACTED = '[redacted]';

const SENSITIVE_KEYS = [
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'password',
  'apikey',
  'api_key',
  'anonkey',
  'secret',
  'authorization',
  'email',
  'session',
  'jwt',
];

const PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${REDACTED}`],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, REDACTED],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  [/https?:\/\/\S*\/storage\/v1\/object\/\S*/gi, REDACTED],
  [/https?:\/\/\S*\/uploads\/\S*/gi, REDACTED],
  [/\btoken=[^&\s"']+/gi, `token=${REDACTED}`],
];

export function scrubString(value: string): string {
  return PATTERNS.reduce((acc, [re, to]) => acc.replace(re, to), value);
}

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

export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
  }

  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;

    if (event.request.url) {
      event.request.url = scrubString(event.request.url);
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

/**
 * Initialise Sentry for the app, if a DSN is configured.
 *
 * `EXPO_PUBLIC_*` variables are inlined by Expo at build time, so this must be
 * set before `eas build`, not after.
 *
 * With no DSN this is a no-op — development and Expo Go stay quiet.
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    logger.info('Sentry disabled (no EXPO_PUBLIC_SENTRY_DSN)');
    return;
  }

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',

    sendDefaultPii: false,
    tracesSampleRate: 0,

    // Screenshots and view hierarchies of this app are, by definition,
    // photographs of children. Never.
    attachScreenshot: false,
    attachViewHierarchy: false,

    beforeSend: scrubEvent,

    beforeBreadcrumb: (crumb) => {
      // xhr/fetch breadcrumbs record request URLs, which here means signed
      // photo URLs and Supabase auth calls.
      if (crumb.category === 'xhr' || crumb.category === 'fetch') return null;
      return crumb;
    },
  });

  logger.info('Sentry initialised');
}

export { Sentry };
