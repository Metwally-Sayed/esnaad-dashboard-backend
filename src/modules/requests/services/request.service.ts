import { User, RequestStatus, AuditAction, ExpiresMode } from '@prisma/client';
import { RequestRepository } from '../repositories/request.repository';
import { CreateRequestDto, ApproveRequestDto, RejectRequestDto, RequestFiltersDto } from '../dto/request.dto';
import { ForbiddenError, NotFoundError, ValidationError } from '@/common/errors/AppError';
import { PrismaClient } from '@prisma/client';
import { DocumentService } from '@/modules/docs/services/document.service';
import { AuditService } from '@/modules/audit-logs/services/audit.service';
import { EmailService } from '@/common/services/email.service';

export class RequestService {
  private requestRepo: RequestRepository;
  private documentService: DocumentService;
  private auditService: AuditService;
  private emailService: EmailService;

  constructor(private prisma: PrismaClient) {
    this.requestRepo = new RequestRepository(prisma);
    this.documentService = new DocumentService(prisma);
    this.auditService = new AuditService(prisma);
    this.emailService = new EmailService();
  }

  // Helper: Check if request is expired
  private checkExpiry(request: any): boolean {
    if (request.status !== 'APPROVED') {
      return false;
    }

    const now = new Date();

    switch (request.expiresMode) {
      case 'DATE':
        return request.expiresAt && now > new Date(request.expiresAt);
      case 'USES':
        return request.usesCount >= (request.maxUses || 0);
      case 'UNLIMITED':
        return false;
      default:
        return false;
    }
  }

  // Helper: Update expired requests
  private async updateIfExpired(request: any): Promise<any> {
    if (this.checkExpiry(request) && request.status === 'APPROVED') {
      return this.requestRepo.update(request.id, {
        status: 'EXPIRED' as RequestStatus
      });
    }
    return request;
  }

  // Check access to request
  private async checkAccess(requestId: string, user: User, action: 'view' | 'edit' | 'action'): Promise<any> {
    const request = await this.requestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }

    if (user.role === 'ADMIN') {
      return request;
    }

    // Owner can only access their requests
    if (request.ownerId !== user.id) {
      throw new ForbiddenError('You do not have permission to access this request');
    }

    // Owners cannot perform admin actions
    if (action === 'action') {
      throw new ForbiddenError('Only administrators can perform this action');
    }

    return request;
  }

  // Create request (owner only)
  async create(data: CreateRequestDto, user: User): Promise<any> {
    // Verify unit exists and belongs to owner (if not admin)
    const unit = await this.prisma.unit.findUnique({
      where: { id: data.unitId },
      include: { owner: true }
    });

    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    // Owners can only create requests for their units
    if (user.role === 'OWNER' && unit.ownerId !== user.id) {
      throw new ForbiddenError('You can only create requests for your own units');
    }

    // Create request
    const request = await this.requestRepo.create({
      unit: { connect: { id: data.unitId } },
      owner: { connect: { id: user.id } },
      type: data.type,
      purpose: data.purpose,
      visitorName: data.visitorName,
      visitorPhone: data.visitorPhone,
      companyName: data.companyName,
      representativeName: data.representativeName,
      startAt: data.startAt ? new Date(data.startAt) : undefined,
      endAt: data.endAt ? new Date(data.endAt) : undefined
    });

    // Create audit log
    await this.auditService.create({
      action: 'REQUEST_CREATED' as AuditAction,
      entityType: 'request',
      entityId: request.id,
      actorId: user.id,
      unitId: data.unitId,
      changes: { created: request }
    });

    return request;
  }

  // List requests
  async list(filters: RequestFiltersDto, user: User): Promise<any> {
    return this.requestRepo.findMany(filters, user);
  }

  // Get request details
  async getById(id: string, user: User): Promise<any> {
    const request = await this.checkAccess(id, user, 'view');
    return this.updateIfExpired(request);
  }

  // Approve request (admin only)
  async approve(id: string, data: ApproveRequestDto, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can approve requests');
    }

    const request = await this.checkAccess(id, user, 'action');

    if (request.status !== 'SUBMITTED') {
      throw new ValidationError(`Cannot approve request in ${request.status} status`);
    }

    // Validate expiry rules based on request type
    if (request.type === 'WORK_PERMISSION' && data.expiresMode !== 'DATE') {
      throw new ValidationError('Work permissions can only use DATE expiry mode');
    }

    // Prepare update data
    const updateData: any = {
      status: 'APPROVED' as RequestStatus,
      approvedByAdmin: { connect: { id: user.id } },
      approvedAt: new Date(),
      expiresMode: data.expiresMode as ExpiresMode
    };

    if (data.expiresMode === 'DATE') {
      updateData.expiresAt = new Date(data.expiresAt!);
    } else if (data.expiresMode === 'USES') {
      updateData.maxUses = data.maxUses!;
      updateData.usesCount = 0;
    }

    // Update request
    const updated = await this.requestRepo.update(id, updateData);

    // Generate PDF
    const { pdfUrl, pdfPublicId } = await this.generateRequestPDF(updated, user);

    // Save PDF info
    const finalRequest = await this.requestRepo.update(id, {
      pdfUrl,
      pdfPublicId
    });

    // Send approval email
    await this.sendApprovalEmail(finalRequest);

    // Create audit log
    await this.auditService.create({
      action: 'REQUEST_APPROVED' as AuditAction,
      entityType: 'request',
      entityId: id,
      actorId: user.id,
      unitId: request.unitId,
      changes: { before: request, after: finalRequest }
    });

    return finalRequest;
  }

  // Reject request (admin only)
  async reject(id: string, data: RejectRequestDto, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can reject requests');
    }

    const request = await this.checkAccess(id, user, 'action');

    if (request.status !== 'SUBMITTED') {
      throw new ValidationError(`Cannot reject request in ${request.status} status`);
    }

    // Update request
    const updated = await this.requestRepo.update(id, {
      status: 'REJECTED' as RequestStatus,
      rejectedByAdmin: { connect: { id: user.id } },
      rejectedAt: new Date(),
      rejectionReason: data.reason
    });

    // Send rejection email
    await this.sendRejectionEmail(updated);

    // Create audit log
    await this.auditService.create({
      action: 'REQUEST_REJECTED' as AuditAction,
      entityType: 'request',
      entityId: id,
      actorId: user.id,
      unitId: request.unitId,
      changes: { before: request, after: updated }
    });

    return updated;
  }

  // Cancel request (owner can cancel their own submitted requests)
  async cancel(id: string, user: User): Promise<any> {
    const request = await this.checkAccess(id, user, 'view');

    if (request.status !== 'SUBMITTED') {
      throw new ValidationError('Only submitted requests can be cancelled');
    }

    if (request.ownerId !== user.id) {
      throw new ForbiddenError('You can only cancel your own requests');
    }

    // Update request
    const updated = await this.requestRepo.update(id, {
      status: 'CANCELLED' as RequestStatus
    });

    // Create audit log
    await this.auditService.create({
      action: 'REQUEST_CANCELLED' as AuditAction,
      entityType: 'request',
      entityId: id,
      actorId: user.id,
      unitId: request.unitId,
      changes: { before: request, after: updated }
    });

    return updated;
  }

  // Revoke request (admin only, revoke approved requests)
  async revoke(id: string, reason: string, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can revoke requests');
    }

    const request = await this.checkAccess(id, user, 'action');

    if (request.status !== 'APPROVED') {
      throw new ValidationError('Only approved requests can be revoked');
    }

    // Update request
    const updated = await this.requestRepo.update(id, {
      status: 'CANCELLED' as RequestStatus,
      rejectionReason: `Revoked: ${reason}`
    });

    // Create audit log
    await this.auditService.create({
      action: 'REQUEST_REVOKED' as AuditAction,
      entityType: 'request',
      entityId: id,
      actorId: user.id,
      unitId: request.unitId,
      metadata: { reason }
    });

    return updated;
  }

  // Generate PDF
  private async generateRequestPDF(request: any, user: User): Promise<{ pdfUrl: string; pdfPublicId: string }> {
    return this.documentService.generateRequestInvitation(request, user);
  }

  // Send approval email
  private async sendApprovalEmail(request: any): Promise<void> {
    const ownerEmail = request.owner.email;
    const ownerName = request.owner.name || request.owner.email;
    const unitNumber = request.unit.unitNumber;
    const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const requestUrl = `${dashboardUrl}/requests/${request.id}`;

    // Determine expiry description
    let validityText = '';
    if (request.expiresMode === 'DATE') {
      const expiryDate = new Date(request.expiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      validityText = `Valid until: ${expiryDate}`;
    } else if (request.expiresMode === 'USES') {
      validityText = `Valid for ${request.maxUses} uses`;
    } else {
      validityText = 'Unlimited validity';
    }

    const requestTypeLabel = request.type === 'GUEST_VISIT' ? 'Guest Visit Invitation' : 'Work Permission';
    const visitorInfo = request.type === 'GUEST_VISIT'
      ? request.visitorName
      : request.companyName;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #16a34a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8fafc; }
          .button { display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #16a34a; }
          .footer { padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Request Approved</h1>
          </div>
          <div class="content">
            <p>Dear ${ownerName},</p>
            <p>Your <strong>${requestTypeLabel}</strong> has been approved!</p>

            <div class="info-box">
              <p><strong>Unit:</strong> ${unitNumber}</p>
              <p><strong>${request.type === 'GUEST_VISIT' ? 'Visitor' : 'Company'}:</strong> ${visitorInfo}</p>
              <p><strong>Validity:</strong> ${validityText}</p>
            </div>

            <p>Your invitation/permit document is ready for download.</p>

            <a href="${requestUrl}" class="button">View Request & Download PDF</a>

            <p>Please keep this document for your records.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Esnaad Dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailService.sendEmail({
      to: ownerEmail,
      subject: `Request Approved - ${requestTypeLabel} for Unit ${unitNumber}`,
      html
    });
  }

  // Send rejection email
  private async sendRejectionEmail(request: any): Promise<void> {
    const ownerEmail = request.owner.email;
    const ownerName = request.owner.name || request.owner.email;
    const unitNumber = request.unit.unitNumber;
    const requestTypeLabel = request.type === 'GUEST_VISIT' ? 'Guest Visit Invitation' : 'Work Permission';

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
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc2626; }
          .footer { padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Request Not Approved</h1>
          </div>
          <div class="content">
            <p>Dear ${ownerName},</p>
            <p>Unfortunately, your <strong>${requestTypeLabel}</strong> for Unit ${unitNumber} was not approved.</p>

            <div class="info-box">
              <p><strong>Reason:</strong></p>
              <p>${request.rejectionReason || 'No reason provided'}</p>
            </div>

            <p>If you have questions, please contact the administration.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Esnaad Dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailService.sendEmail({
      to: ownerEmail,
      subject: `Request Not Approved - ${requestTypeLabel} for Unit ${unitNumber}`,
      html
    });
  }
}
