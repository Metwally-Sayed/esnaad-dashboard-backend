import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Global rate limiter - very permissive
 * Only kicks in for extreme abuse (1000 requests per minute)
 * Disabled in development
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: isDev ? 0 : 1000, // 0 = disabled in dev, 1000/min in prod
  message: {
    success: false,
    error: 'Too many requests. Please slow down and try again in a moment.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev, // Skip rate limiting entirely in development
});

/**
 * Auth rate limiter - stricter for login/password endpoints
 * Prevents brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 20, // Very permissive in dev, 20 attempts in 15 min for prod
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.'
  },
  skipSuccessfulRequests: true, // Only count failed attempts
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev, // Skip in development
});

/**
 * OTP rate limiter - prevents OTP abuse
 */
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100 : 10, // 10 OTP requests per hour in prod
  message: {
    success: false,
    error: 'Too many OTP requests. Please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev, // Skip in development
});
