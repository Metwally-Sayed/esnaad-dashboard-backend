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

  async sendRequestApprovalNotification(
    email: string,
    name: string,
    requestType: string,
    message: string
  ): Promise<void> {
    const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8fafc; }
          .message-box { background: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Request Approved</h1>
          </div>
          <div class="content">
            <p>Dear ${name || 'User'},</p>
            <p>Your <strong>${requestType}</strong> request has been approved.</p>
            <div class="message-box">
              ${message}
            </div>
            <a href="${dashboardUrl}/requests" class="button">View Your Requests</a>
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
      to: email,
      subject: `Request Approved - ${requestType}`,
      html,
    });
  }

  async sendTenantRegistrationApproval(
    ownerEmail: string,
    ownerName: string | null | undefined,
    tenantName: string,
    unitNumber: string,
    requestUrl: string,
    pdfUrl: string | null
  ): Promise<void> {
    const pdfSection = pdfUrl ? `
      <div style="margin: 20px 0;">
        <a href="${pdfUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px;">
          📄 Download Certificate PDF
        </a>
      </div>
    ` : '';

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
          .info-box { background: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
          .badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 8px 16px; border-radius: 20px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Tenant Registration Approved</h1>
          </div>
          <div class="content">
            <p>Dear ${ownerName || 'Property Owner'},</p>
            <p>Great news! Your tenant registration request has been approved.</p>

            <div class="info-box">
              <p><strong>Tenant:</strong> ${tenantName}</p>
              <p><strong>Unit:</strong> ${unitNumber}</p>
              <p><strong>Status:</strong> <span class="badge">Approved</span></p>
            </div>

            <p>A certificate has been generated for this tenant registration. You can download it using the button below or from your dashboard.</p>

            ${pdfSection}

            <a href="${requestUrl}" class="button">View Request Details</a>

            <p>This certificate contains a QR code that can be scanned to verify the tenant registration.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Esnaad Dashboard.</p>
            <p>For any questions, please contact the administration.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: ownerEmail,
      subject: `Tenant Registration Approved - ${tenantName} for Unit ${unitNumber}`,
      html,
    });
  }

  async sendOwnershipTransferNotification(
    newOwnerEmail: string,
    newOwnerName: string,
    unitNumbers: string[],
    previousOwnerName?: string,
    tempPassword?: string
  ): Promise<void> {
    const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${dashboardUrl}/login`;

    const unitsText = unitNumbers.length === 1
      ? `Unit ${unitNumbers[0]}`
      : `${unitNumbers.length} units (${unitNumbers.join(', ')})`;

    const credentialsSection = tempPassword ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; font-weight: bold;">🔑 Your Login Credentials:</p>
        <p style="margin: 10px 0 0 0;">
          <strong>Email:</strong> ${newOwnerEmail}<br>
          <strong>Temporary Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${tempPassword}</code>
        </p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #92400e;">
          ⚠️ Please change your password after your first login for security.
        </p>
      </div>
    ` : `
      <p>Please log in to your account to access your new properties.</p>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8fafc; }
          .unit-list { background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Ownership Transfer Completed</h1>
          </div>
          <div class="content">
            <p>Dear ${newOwnerName},</p>
            <p>We're pleased to inform you that ownership of the following ${unitNumbers.length === 1 ? 'unit has' : 'units have'} been transferred to you:</p>
            <div class="unit-list">
              <strong>Transferred Units:</strong><br>
              ${unitNumbers.map(u => `• ${u}`).join('<br>')}
            </div>
            ${previousOwnerName ? `<p><strong>Previous Owner:</strong> ${previousOwnerName}</p>` : ''}
            ${credentialsSection}
            <a href="${loginUrl}" class="button">Access Your Dashboard</a>
            <p>You can now view and manage your properties through the Esnaad Dashboard. If you have any questions, please contact the administration.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Esnaad Dashboard.</p>
            <p>For support, please contact your property administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: newOwnerEmail,
      subject: `Ownership Transfer Completed - ${unitsText}`,
      html,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
