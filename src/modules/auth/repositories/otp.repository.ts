import { Otp, OtpPurpose } from '@prisma/client';
import { prisma } from '../../../config/database';

export class OtpRepository {
  async createOtp(data: {
    userId: string;
    hashedOtp: string;
    purpose: OtpPurpose;
    expiresAt: Date;
    maxAttempts?: number;
    maxResends?: number;
  }): Promise<Otp> {
    // Invalidate previous OTPs for same user and purpose
    await prisma.otp.updateMany({
      where: {
        userId: data.userId,
        purpose: data.purpose,
        verified: false,
      },
      data: { verified: true }, // Mark as used
    });

    return prisma.otp.create({
      data: {
        userId: data.userId,
        hashedOtp: data.hashedOtp,
        purpose: data.purpose,
        expiresAt: data.expiresAt,
        maxAttempts: data.maxAttempts || 5,
        maxResends: data.maxResends || 3,
      },
    });
  }

  async findValidOtp(
    userId: string,
    purpose: OtpPurpose
  ): Promise<Otp | null> {
    return prisma.otp.findFirst({
      where: {
        userId,
        purpose,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async incrementAttempts(otpId: string): Promise<Otp> {
    return prisma.otp.update({
      where: { id: otpId },
      data: { attempts: { increment: 1 } },
    });
  }

  async markAsVerified(otpId: string): Promise<Otp> {
    return prisma.otp.update({
      where: { id: otpId },
      data: { verified: true },
    });
  }

  async incrementResendCount(otpId: string): Promise<Otp> {
    return prisma.otp.update({
      where: { id: otpId },
      data: {
        resendCount: { increment: 1 },
        lastResent: new Date(),
      },
    });
  }

  async deleteExpiredOtps(): Promise<number> {
    const result = await prisma.otp.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}
