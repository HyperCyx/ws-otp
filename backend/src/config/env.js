const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(10, 'TELEGRAM_BOT_TOKEN is required'),
  ADMIN_TELEGRAM_IDS: z.string().default(''),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Database (PostgreSQL — Neon or standard)
  // Accepts either NEON_DATABASE_URL (preferred) or DATABASE_URL
  NEON_DATABASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url().optional(),
  DB_CONNECTION_LIMIT: z.string().default('20'),

  // Redis (optional — falls back to in-memory mock)
  // Prefer REDIS_URL (Render/Railway/Heroku format: redis://... or rediss://...)
  // OR use individual REDIS_HOST / REDIS_PORT / REDIS_PASSWORD
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_PREFIX: z.string().default('otp:'),

  // External API
  EXTERNAL_API_BASE: z
    .string()
    .url('EXTERNAL_API_BASE must be a valid URL')
    .refine((value) => {
      try {
        const hostname = new URL(value).hostname.toLowerCase();
        return hostname !== 'example.com';
      } catch {
        return false;
      }
    }, 'EXTERNAL_API_BASE must point to the real external API, not example.com'),
  EXTERNAL_API_ACCOUNT: z.string().min(1),
  EXTERNAL_API_PASSWORD: z.string().min(1),
  EXTERNAL_API_IDENTITY: z.string().default('Member'),
  TOKEN_REFRESH_BUFFER_MS: z.string().default('600000'),
  TOKEN_TTL_MS: z.string().default('18000000'),

  // Polling
  POLL_INTERVAL_MS: z.string().default('8000'),
  MAX_POLL_ATTEMPTS: z.string().default('75'),
  POLL_CONCURRENCY: z.string().default('5'),

  // Wallet
  MIN_WITHDRAWAL_AMOUNT: z.string().default('1.00'),
  MAX_WITHDRAWAL_AMOUNT: z.string().default('500.00'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('100'),
  ACTIVATION_RATE_LIMIT: z.string().default('10'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().default('./logs'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    result.error.errors.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

module.exports = { validateEnv };
