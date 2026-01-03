import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { successResponse } from '../../../common/utils/response';
import { RegisterDto, LoginDto, VerifyOtpDto, ResendOtpDto } from '../dto/auth.dto';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data: RegisterDto = req.body;
      const result = await this.authService.register(data);
      res.status(201).json(successResponse(result, 'Registration successful'));
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, otp }: VerifyOtpDto = req.body;
      const result = await this.authService.verifyOtp(email, otp);
      res.json(successResponse(result, 'Email verified successfully'));
    } catch (error) {
      next(error);
    }
  };

  resendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email }: ResendOtpDto = req.body;
      const result = await this.authService.resendOtp(email);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data: LoginDto = req.body;
      const result = await this.authService.login(data);
      res.json(successResponse(result, 'Login successful'));
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // In a stateless JWT system, logout is handled client-side
      // If using refresh token rotation, invalidate the refresh token here
      res.json(successResponse(null, 'Logout successful'));
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // User is already attached by auth middleware
      res.json(successResponse({ user: req.user }));
    } catch (error) {
      next(error);
    }
  };
}
