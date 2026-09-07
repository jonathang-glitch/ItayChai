import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_APP_URL: z.string().optional(),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  SUPABASE_URL: z.string().default('http://127.0.0.1:54321'),
  SUPABASE_JWT_SECRET: z.string().min(32).default('super-secret-jwt-token-with-at-least-32-characters-long'),
  WHATSAPP_PROVIDER: z.enum(['mock', 'twilio']).default('mock'),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).default('dev-verify-token'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
