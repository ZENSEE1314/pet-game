import { z } from 'zod';

/**
 * Fail fast on a misconfigured deployment. An app that boots with a missing
 * QR_TOKEN_SECRET is an app that silently signs claim tokens with `undefined`,
 * so every one of these is required rather than defaulted.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  NEXTAUTH_URL: z.string().url().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  GAME_SESSION_SECRET: z.string().min(16, 'GAME_SESSION_SECRET must be at least 16 characters'),
  QR_TOKEN_SECRET: z.string().min(16, 'QR_TOKEN_SECRET must be at least 16 characters'),

  DEFAULT_TIMEZONE: z.string().default('Asia/Kuala_Lumpur'),
  EMAIL_FROM: z.string().default('PetQuest <no-reply@petquest.local>'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\n\nCopy env.example to .env and fill it in.`);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isGoogleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
