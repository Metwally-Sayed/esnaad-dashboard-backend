import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpPort = process.env.SMTP_PORT?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPassword = process.env.SMTP_PASSWORD?.trim();
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL?.trim();
    const smtpFromName = process.env.SMTP_FROM_NAME?.trim() || 'Esnaad Dashboard';

    this.isConfigured = !!(smtpHost && smtpPort && smtpUser && smtpPassword && smtpFromEmail);

    if (!this.isConfigured) {
      console.warn('⚠️ Email service disabled: SMTP credentials not configured');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || '587', 10),
      secure: parseInt(smtpPort || '587', 10) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    console.log('📧 Email service configured');
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('⚠️ Email service not configured. Email not sent:', options.subject);
      return;
    }

    try {
      const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || 'noreply@esnaad.com';
      const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Esnaad Dashboard';

      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      });

      console.log(`✅ Email sent to ${options.to}: ${options.subject}`);
    } catch (error: any) {
      console.error('❌ Email send failed:', error.message);
      // Don't throw - email failure shouldn't break the main flow
    }
  }

  async sendOTP(email: string, otp: string, name?: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8fafc; }
          .otp-code { font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background: #e5e7eb; border-radius: 8px; letter-spacing: 8px; }
          .footer { padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Dear ${name || 'User'},</p>
            <p>Your verification code is:</p>
            <div class="otp-code">${otp}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Esnaad Dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Esnaad Dashboard',
      html,
    });

    // Also log OTP to console for development
    console.log(`📧 OTP for ${email}: ${otp}`);
  }

  async sendPasswordResetOTP(email: string, otp: string, name?: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8fafc; }
          .otp-code { font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background: #e5e7eb; border-radius: 8px; letter-spacing: 8px; }
          .footer { padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>Dear ${name || 'User'},</p>
            <p>Your password reset code is:</p>
            <div class="otp-code">${otp}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Esnaad Dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset - Esnaad Dashboard',
      html,
    });

    // Also log OTP to console for development
    console.log(`📧 Password Reset OTP for ${email}: ${otp}`);
  }

  async sendSnaggingNotification(
    ownerEmail: string,
    ownerName: string,
    snaggingTitle: string,
    unitNumber: string,
    snaggingId: string
  ): Promise<void> {
    const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const snaggingUrl = `${dashboardUrl}/snaggings/${snaggingId}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8fafc; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Snagging Report</h1>
          </div>
          <div class="content">
            <p>Dear ${ownerName},</p>
            <p>A new snagging inspection report has been created for your unit:</p>
            <p><strong>Unit:</strong> ${unitNumber}</p>
            <p><strong>Title:</strong> ${snaggingTitle}</p>
            <p>Please review the report and add your signature to complete the agreement.</p>
            <a href="${snaggingUrl}" class="button">View Snagging Report</a>
            <p>If you have any questions, please contact the administration.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Esnaad Dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: ownerEmail,
      subject: `New Snagging Report for Unit ${unitNumber}`,
      html,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
