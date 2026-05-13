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
