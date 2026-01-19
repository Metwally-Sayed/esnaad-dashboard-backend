import { User, OtpPurpose } from '@prisma/client';
import { AuthRepository } from '../repositories/auth.repository';
import { OtpRepository } from '../repositories/otp.repository';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
  TooManyRequestsError,
} from '../../../common/errors';
import {
  hashPassword,
  comparePassword,
  generateOtp,
  hashOtp,
} from '../../../common/utils/crypto';
import {
  generateToken,
  generateRefreshToken,
} from '../../../common/middleware/auth.middleware';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { emailService } from '../../../common/services/email.service';

export class AuthService {
  private authRepo: AuthRepository;
  private otpRepo: OtpRepository;

  constructor() {
    this.authRepo = new AuthRepository();
    this.otpRepo = new OtpRepository();
  }

  async register(data: RegisterDto): Promise<{ user: Partial<User>; message: string }> {
    // Check if user already exists
    const existingUser = await this.authRepo.findUserByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Check external client database
    const isExternalClient = await this.authRepo.findExternalClient(data.email);
    if (!isExternalClient) {
      throw new BadRequestError(
        'Email not found in authorized clients. Please contact support.'
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await this.authRepo.createUser({
      email: data.email,
      password: hashedPassword,
      name: data.name,
    });

    // Generate and send OTP
    const otp = await this.generateAndStoreOtp(user.id, OtpPurpose.REGISTRATION);

    logger.info({ userId: user.id }, 'User registered successfully');

    // In development, include OTP in response for testing
    const response: any = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      message: 'Registration successful. Please verify your email with the OTP sent.',
    };

    if (env.NODE_ENV === 'development') {
      response.otp = otp; // Only in development!
    }

    return response;
  }

  async verifyOtp(email: string, otp: string): Promise<{ user: Partial<User>; tokens: any }> {
    const user = await this.authRepo.findUserByEmail(email);
    if (!user) {
      throw new BadRequestError('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestError('Email already verified');
    }

    const validOtp = await this.otpRepo.findValidOtp(user.id, OtpPurpose.REGISTRATION);
    if (!validOtp) {
      throw new BadRequestError('No valid OTP found. Please request a new one.');
    }

    // Check max attempts
    if (validOtp.attempts >= validOtp.maxAttempts) {
      throw new TooManyRequestsError('Maximum OTP attempts exceeded. Please request a new OTP.');
    }

    // Verify OTP
    const hashedInputOtp = hashOtp(otp);
    if (hashedInputOtp !== validOtp.hashedOtp) {
      await this.otpRepo.incrementAttempts(validOtp.id);
      throw new UnauthorizedError('Invalid OTP');
    }

    // Mark OTP as verified
    await this.otpRepo.markAsVerified(validOtp.id);

    // Verify user email
    const verifiedUser = await this.authRepo.verifyUserEmail(user.id);

    // Generate tokens
    const tokens = this.generateTokens(verifiedUser);

    logger.info({ userId: user.id }, 'Email verified successfully');

    return {
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        name: verifiedUser.name,
        role: verifiedUser.role,
      },
      tokens,
    };
  }

  async resendOtp(email: string): Promise<{ message: string }> {
    const user = await this.authRepo.findUserByEmail(email);
    if (!user) {
      throw new BadRequestError('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestError('Email already verified');
    }

    const existingOtp = await this.otpRepo.findValidOtp(user.id, OtpPurpose.REGISTRATION);
    if (existingOtp && existingOtp.resendCount >= existingOtp.maxResends) {
      throw new TooManyRequestsError('Maximum OTP resend limit reached');
    }

    const otp = await this.generateAndStoreOtp(user.id, OtpPurpose.REGISTRATION);

    logger.info({ userId: user.id }, 'OTP resent');

    const response: any = { message: 'OTP has been resent to your email' };

    if (env.NODE_ENV === 'development') {
      response.otp = otp; // Only in development!
    }

    return response;
  }

  async login(data: LoginDto): Promise<{ user: Partial<User>; tokens: any }> {
    const user = await this.authRepo.findUserByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedError('Please verify your email before logging in');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive. Please contact support.');
    }

    const isPasswordValid = await comparePassword(data.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokens = this.generateTokens(user);

    logger.info({ userId: user.id }, 'User logged in');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        verificationStatus: user.verificationStatus,
      },
      tokens,
    };
  }

  private async generateAndStoreOtp(userId: string, purpose: OtpPurpose): Promise<string> {
    const otp = generateOtp(6);
    const hashedOtp = hashOtp(otp);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    // Get user details for email
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      throw new BadRequestError('User not found');
    }

    await this.otpRepo.createOtp({
      userId,
      hashedOtp,
      purpose,
      expiresAt,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      maxResends: env.OTP_MAX_RESENDS,
    });

    // Send OTP via email
    if (purpose === OtpPurpose.REGISTRATION || purpose === OtpPurpose.EMAIL_VERIFICATION) {
      await emailService.sendOTP(user.email, otp, user.name || undefined);
    } else if (purpose === OtpPurpose.PASSWORD_RESET) {
      await emailService.sendPasswordResetOTP(user.email, otp, user.name || undefined);
    }

    logger.info({ userId, purpose }, 'OTP generated and sent');

    return otp;
  }

  private generateTokens(user: User) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      verificationStatus: user.verificationStatus,
    };

    return {
      accessToken: generateToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }
}
