import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../../../common/middleware/validation.middleware';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { authRateLimiter, otpRateLimiter } from '../../../common/middleware/rateLimiter.middleware';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
} from '../dto/auth.dto';

const router = Router();
const authController = new AuthController();

// Public routes
router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  authController.register
);

router.post(
  '/verify-otp',
  authRateLimiter,
  validate(verifyOtpSchema),
  authController.verifyOtp
);

router.post(
  '/resend-otp',
  otpRateLimiter,
  validate(resendOtpSchema),
  authController.resendOtp
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  authController.login
);

// Protected routes
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
