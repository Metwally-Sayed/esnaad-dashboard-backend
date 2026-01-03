import { z } from 'zod';
import dotenv from 'dotenv';

// Load appropriate .env file
if (process.env.NODE_ENV === 'production') {
  // Try to load from Koyeb environment first
  if (!process.env.DATABASE_URL) {
    // Fallback to .env.production if Koyeb vars not set
    dotenv.config({ path: '.env.production' });
    console.log('📦 Loaded .env.production file');
  } else {
    console.log('🚀 Using environment variables from Koyeb');
  }
} else {
  dotenv.config();
  console.log('💻 Loaded .env file for development');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  PORT: z.string().optional().default('3000').transform((val) => Number(val)),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().optional().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().optional().default('30d'),

  // OTP
  OTP_EXPIRES_IN_MINUTES: z.string().optional().default('10').transform((val) => Number(val)),
  OTP_MAX_ATTEMPTS: z.string().optional().default('5').transform((val) => Number(val)),
  OTP_MAX_RESENDS: z.string().optional().default('3').transform((val) => Number(val)),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().optional().default('900000').transform((val) => Number(val)),
  RATE_LIMIT_MAX_REQUESTS: z.string().optional().default('100').transform((val) => Number(val)),

  // CORS
  CORS_ORIGIN: z.string().optional().default('*'),

  // Email (SMTP)
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.string().optional().default('587').transform((val) => Number(val)),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional().default('Esnaad Dashboard'),

  // External Client Validation
  EXTERNAL_CLIENT_API_URL: z.string().url().optional(),
  EXTERNAL_CLIENT_API_KEY: z.string().optional(),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parseEnv = (): Env => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });

      if (process.env.NODE_ENV === 'production' || !process.env.DATABASE_URL) {
        console.error('\n📌 DEPLOYMENT FIX:');
        console.error('You need to set environment variables in your hosting platform:');
        console.error('- Koyeb: Dashboard → Service → Settings → Environment Variables');
        console.error('- Render: Dashboard → Environment → Environment Variables');
        console.error('- Railway: Dashboard → Variables');
        console.error('\nDO NOT rely on .env file in production!');
      }

      process.exit(1);
    }
    throw error;
  }
};

export const env = parseEnv();
