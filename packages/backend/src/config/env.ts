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

  AWS_REGION: z.string().default('us-east-1'),

  AWS_ACCESS_KEY_ID: z.string().optional().default(''),

  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),

  S3_BUCKET: z.string().default('hive-photos'),

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
