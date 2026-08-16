import { z } from 'zod';

const envSchema = z.object({
  PORT: z
    .string()
    .default('4000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),

  SUPABASE_SERVICE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_KEY is required'),

  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').default('redis://localhost:6379'),

  BACKEND_URL: z.string().default('http://localhost:4000'),

  // Optional. Unset means error reporting is off, which is what local
  // development and the test suite want.
  //
  // The preprocess step matters: .env.example ships `SENTRY_DSN=` with no
  // value, so a copied file yields an empty string rather than undefined, and
  // an empty string is not a valid URL. Without this, following the setup
  // instructions would fail startup validation.
  SENTRY_DSN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url('SENTRY_DSN must be a valid URL').optional(),
  ),

  CORS_ORIGINS: z
    .string()
    .default('*')
    .transform((val) =>
      val === '*' ? '*' : val.split(',').map((origin) => origin.trim()),
    ),

  // Optional, and off unless deliberately set. When present, app.ts registers a
  // single route at this path that throws, so `scripts/verify-security.sh` §7
  // can assert that a 500 returns a generic body with no stack trace. That
  // check is the difference between believing the error handler redacts and
  // having seen it.
  //
  // The route only exists when the variable is set, and the operator chooses
  // the path — there is no fixed endpoint to find, and an ordinary deployment
  // that never sets this has no such route at all. It must begin with a slash
  // so it cannot be mistaken for a value that could be appended to a URL.
  FORCE_500_PATH: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .startsWith('/', 'FORCE_500_PATH must begin with /')
      .optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const messages = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, value]) => {
        const errors = (value as { _errors: string[] })._errors;
        return `  ${key}: ${errors.join(', ')}`;
      })
      .join('\n');

    throw new Error(
      `Environment variable validation failed:\n${messages}`,
    );
  }

  return result.data;
}

export const env = parseEnv();
