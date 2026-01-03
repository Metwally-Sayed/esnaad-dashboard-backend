import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    // Only initialize if SMTP credentials are provided
    if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
      logger.warn('⚠️  Email service disabled: SMTP credentials not configured');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });

      logger.info('✅ Email service initialized successfully');
    } catch (error) {
      logger.error({ error }, '❌ Failed to initialize email service:');
    }
  }

  /**
   * Send OTP verification email
   */
  async sendOTP(to: string, otp: string, name?: string): Promise<boolean> {
    if (!this.transporter) {
      logger.warn(`📧 Email service not configured. OTP for ${to}: ${otp}`);
      // In development, log the OTP to console
      if (env.NODE_ENV === 'development') {
        console.log('\n=================================');
        console.log('📧 OTP Email (Development Mode)');
        console.log('=================================');
        console.log(`To: ${to}`);
        console.log(`OTP Code: ${otp}`);
        console.log('=================================\n');
      }
      return false;
    }

    try {
      const subject = 'Verify Your Email - Esnaad Dashboard';
      const html = this.getOTPEmailTemplate(otp, name);
      const text = `Your verification code is: ${otp}\n\nThis code will expire in ${env.OTP_EXPIRES_IN_MINUTES} minutes.`;

      await this.transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL || env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });

      logger.info(`✅ OTP email sent successfully to ${to}`);
      return true;
    } catch (error) {
      logger.error({ error }, `❌ Failed to send OTP email to ${to}`);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetOTP(to: string, otp: string, name?: string): Promise<boolean> {
    if (!this.transporter) {
      logger.warn(`📧 Email service not configured. Password reset OTP for ${to}: ${otp}`);
      if (env.NODE_ENV === 'development') {
        console.log('\n=================================');
        console.log('📧 Password Reset OTP (Development Mode)');
        console.log('=================================');
        console.log(`To: ${to}`);
        console.log(`OTP Code: ${otp}`);
        console.log('=================================\n');
      }
      return false;
    }

    try {
      const subject = 'Password Reset - Esnaad Dashboard';
      const html = this.getPasswordResetEmailTemplate(otp, name);
      const text = `Your password reset code is: ${otp}\n\nThis code will expire in ${env.OTP_EXPIRES_IN_MINUTES} minutes.`;

      await this.transporter.sendMail({
        from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL || env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });

      logger.info(`✅ Password reset email sent successfully to ${to}`);
      return true;
    } catch (error) {
      logger.error({ error }, `❌ Failed to send password reset email to ${to}`);
      return false;
    }
  }

  /**
   * OTP Email HTML Template
   */
  private getOTPEmailTemplate(otp: string, name?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
            margin: 20px 0;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .otp-box {
            background: #fff;
            border: 2px solid #4CAF50;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
            letter-spacing: 8px;
            margin: 10px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 14px;
            color: #666;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Email Verification</h1>
          </div>

          <p>Hello ${name || 'there'},</p>

          <p>Thank you for registering with <strong>Esnaad Dashboard</strong>. To complete your registration, please verify your email address using the code below:</p>

          <div class="otp-box">
            <p>Your verification code is:</p>
            <div class="otp-code">${otp}</div>
          </div>

          <div class="warning">
            ⚠️ This code will expire in <strong>${env.OTP_EXPIRES_IN_MINUTES} minutes</strong>. If you didn't request this code, please ignore this email.
          </div>

          <p>If you're having trouble, please contact our support team.</p>

          <div class="footer">
            <p>Best regards,<br><strong>Esnaad Dashboard Team</strong></p>
            <p style="font-size: 12px; color: #999;">This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Password Reset Email HTML Template
   */
  private getPasswordResetEmailTemplate(otp: string, name?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
            margin: 20px 0;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .otp-box {
            background: #fff;
            border: 2px solid #ff5722;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #ff5722;
            letter-spacing: 8px;
            margin: 10px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 14px;
            color: #666;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Password Reset</h1>
          </div>

          <p>Hello ${name || 'there'},</p>

          <p>We received a request to reset your password for your <strong>Esnaad Dashboard</strong> account. Use the code below to reset your password:</p>

          <div class="otp-box">
            <p>Your password reset code is:</p>
            <div class="otp-code">${otp}</div>
          </div>

          <div class="warning">
            ⚠️ This code will expire in <strong>${env.OTP_EXPIRES_IN_MINUTES} minutes</strong>. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
          </div>

          <p>For security reasons, never share this code with anyone.</p>

          <div class="footer">
            <p>Best regards,<br><strong>Esnaad Dashboard Team</strong></p>
            <p style="font-size: 12px; color: #999;">This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Verify transporter configuration
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('✅ Email service connection verified');
      return true;
    } catch (error) {
      logger.error({ error }, '❌ Email service connection failed');
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
