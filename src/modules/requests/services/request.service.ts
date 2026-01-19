import { User, RequestStatus, AuditAction, ExpiresMode } from '@prisma/client';
import { RequestRepository } from '../repositories/request.repository';
import { CreateRequestDto, ApproveRequestDto, RejectRequestDto, RequestFiltersDto, CreateMessageDto, MessageFiltersDto } from '../dto/request.dto';
import { ForbiddenError, NotFoundError, ValidationError } from '@/common/errors/AppError';
import { PrismaClient } from '@prisma/client';
import { DocumentService } from '@/modules/docs/services/document.service';
import { AuditService } from '@/modules/audit-logs/services/audit.service';
import { EmailService } from '@/common/services/email.service';

// Minimal user type for request operations - needs id, role, email for PDF generation
type RequestUser = Pick<User, 'id' | 'role' | 'email'> & { name?: string | null };

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
  private async checkAccess(requestId: string, user: RequestUser, action: 'view' | 'edit' | 'action'): Promise<any> {
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
  async create(data: CreateRequestDto, user: RequestUser): Promise<any> {
    // Handle ownership transfer type differently
    if (data.type === 'OWNERSHIP_TRANSFER') {
      // Verify all units exist and belong to owner
      if (!data.transferUnitIds || data.transferUnitIds.length === 0) {
        throw new ValidationError('Ownership transfer requires at least one unit');
      }

      const units = await this.prisma.unit.findMany({
        where: { id: { in: data.transferUnitIds } }
      });

      if (units.length !== data.transferUnitIds.length) {
        throw new NotFoundError('One or more units not found');
      }

      // Owners can only transfer their own units
      if (user.role === 'OWNER') {
        const nonOwnedUnits = units.filter(u => u.ownerId !== user.id);
        if (nonOwnedUnits.length > 0) {
          throw new ForbiddenError('You can only transfer units you own');
        }
      }

      // Use first unit as unitId for the request record
      const firstUnitId = data.transferUnitIds[0];

      // Build create data object conditionally
      const createData: any = {
        unit: { connect: { id: firstUnitId } },
        owner: { connect: { id: user.id } },
        type: data.type,
        purpose: data.purpose,
        transferUnitIds: data.transferUnitIds,
        newOwnerName: data.newOwnerName,
        newOwnerEmail: data.newOwnerEmail,
        newOwnerPhone: data.newOwnerPhone,
        message: data.message
      };

      // Only add newOwner relation if newOwnerId exists
      if (data.newOwnerId) {
        createData.newOwner = { connect: { id: data.newOwnerId } };
      }

      // Create request
      console.log('Creating ownership transfer request with data:', JSON.stringify(createData, null, 2));
      const request = await this.requestRepo.create(createData);
      console.log('Request created successfully:', request.id);

      // Create audit log
      await this.auditService.create({
        action: 'REQUEST_CREATED' as AuditAction,
        entityType: 'request',
        entityId: request.id,
        actorId: user.id,
        unitId: firstUnitId,
        changes: { created: request }
      });

      return request;
    }

    // Handle TENANT_REGISTRATION type
    if (data.type === 'TENANT_REGISTRATION') {
      // Verify unit exists and belongs to owner
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

      // Create tenant registration request
      const request = await this.requestRepo.create({
        unit: { connect: { id: data.unitId } },
        owner: { connect: { id: user.id } },
        type: data.type,
        purpose: data.purpose,
        tenantName: data.tenantName,
        tenantEmail: data.tenantEmail,
        tenantPhone: data.tenantPhone,
        emiratesIdUrl: data.emiratesIdUrl,
        passportUrl: data.passportUrl,
        rentContractUrl: data.rentContractUrl,
        ijaryUrl: data.ijaryUrl
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

    // Handle UNIT_MODIFICATIONS type
    if (data.type === 'UNIT_MODIFICATIONS') {
      // Verify unit exists and belongs to owner
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

      // Create unit modifications request
      const request = await this.requestRepo.create({
        unit: { connect: { id: data.unitId } },
        owner: { connect: { id: user.id } },
        type: data.type,
        purpose: data.purpose,
        modificationType: data.modificationType,
        modificationTypeOther: data.modificationTypeOther,
        modificationMessage: data.modificationMessage,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone
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

    // Handle regular request types (GUEST_VISIT, WORK_PERMISSION)
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
  async list(filters: RequestFiltersDto, user: RequestUser): Promise<any> {
    return this.requestRepo.findMany(filters, user);
  }

  // Get request details
  async getById(id: string, user: RequestUser): Promise<any> {
    const request = await this.checkAccess(id, user, 'view');
    return this.updateIfExpired(request);
  }

  // Approve request (admin only)
  async approve(id: string, data: ApproveRequestDto, user: RequestUser): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can approve requests');
    }

    const request = await this.checkAccess(id, user, 'action');

    if (request.status !== 'SUBMITTED') {
      throw new ValidationError(`Cannot approve request in ${request.status} status`);
    }

    // Handle OWNERSHIP_TRANSFER separately
    if (request.type === 'OWNERSHIP_TRANSFER') {
      return this.processOwnershipTransfer(request, user);
    }

    // Handle TENANT_REGISTRATION separately - simple approval
    if (request.type === 'TENANT_REGISTRATION') {
      return this.processTenantRegistration(request, user);
    }

    // Handle UNIT_MODIFICATIONS separately - simple approval
    if (request.type === 'UNIT_MODIFICATIONS') {
      return this.processUnitModifications(request, user);
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

  // Process ownership transfer - Only approves the request, does NOT transfer units or create users
  // The actual transfer happens through a separate process
  private async processOwnershipTransfer(request: any, adminUser: RequestUser): Promise<any> {
    // Update request status to APPROVED (no unit transfer, no user creation)
    const updated = await this.requestRepo.update(request.id, {
      status: 'APPROVED' as RequestStatus,
      approvedByAdmin: { connect: { id: adminUser.id } },
      approvedAt: new Date()
    });

    // Create audit log for request approval
    await this.auditService.create({
      action: 'REQUEST_APPROVED' as AuditAction,
      entityType: 'request',
      entityId: request.id,
      actorId: adminUser.id,
      unitId: request.unitId,
      changes: {
        before: request,
        after: updated,
        note: 'Ownership transfer request approved - pending manual transfer'
      }
    });

    // Send email notification to the requesting owner
    try {
      const owner = await this.prisma.user.findUnique({
        where: { id: request.ownerId },
        select: { email: true, name: true }
      });

      if (owner?.email) {
        // Fetch unit details
        const units = await this.prisma.unit.findMany({
          where: { id: { in: request.transferUnitIds } },
          select: { unitNumber: true }
        });
        const unitNumbers = units.map(u => u.unitNumber);

        await this.emailService.sendRequestApprovalNotification(
          owner.email,
          owner.name,
          'Ownership Transfer',
          `Your ownership transfer request for unit(s) ${unitNumbers.join(', ')} to ${request.newOwnerName || 'the new owner'} has been approved.`
        );
        console.log(`📧 Ownership transfer approval email sent to ${owner.email}`);
      }
    } catch (emailError: any) {
      console.error('❌ Failed to send approval notification email:', emailError.message);
      // Don't throw - email failure shouldn't break the approval
    }

    return updated;
  }

  // Process tenant registration - Approval with PDF certificate generation
  private async processTenantRegistration(request: any, adminUser: RequestUser): Promise<any> {
    // Update request status to APPROVED
    let updated = await this.requestRepo.update(request.id, {
      status: 'APPROVED' as RequestStatus,
      approvedByAdmin: { connect: { id: adminUser.id } },
      approvedAt: new Date()
    });

    // Refetch with relations for PDF generation
    updated = await this.requestRepo.findById(request.id);

    // Generate PDF certificate with QR code
    let pdfUrl: string | null = null;
    let pdfPublicId: string | null = null;
    try {
      const pdfResult = await this.documentService.generateTenantRegistrationCertificate(updated, adminUser);
      pdfUrl = pdfResult.pdfUrl;
      pdfPublicId = pdfResult.pdfPublicId;

      // Update request with PDF URL
      updated = await this.requestRepo.update(request.id, {
        pdfUrl,
        pdfPublicId
      });

      console.log(`📄 Tenant registration certificate generated: ${pdfUrl}`);
    } catch (pdfError: any) {
      console.error('❌ Failed to generate tenant registration certificate:', pdfError.message);
      // Don't throw - PDF generation failure shouldn't break the approval
    }

    // Create audit log for request approval
    await this.auditService.create({
      action: 'REQUEST_APPROVED' as AuditAction,
      entityType: 'request',
      entityId: request.id,
      actorId: adminUser.id,
      unitId: request.unitId,
      changes: {
        before: request,
        after: updated,
        note: 'Tenant registration request approved',
        pdfUrl
      }
    });

    // Send email notification to the requesting owner
    try {
      const owner = await this.prisma.user.findUnique({
        where: { id: request.ownerId },
        select: { email: true, name: true }
      });

      if (owner?.email) {
        // Fetch unit details
        const unit = await this.prisma.unit.findUnique({
          where: { id: request.unitId },
          select: { unitNumber: true }
        });

        const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const requestUrl = `${dashboardUrl}/requests/${request.id}`;

        await this.emailService.sendTenantRegistrationApproval(
          owner.email,
          owner.name,
          request.tenantName,
          unit?.unitNumber || 'N/A',
          requestUrl,
          pdfUrl
        );
        console.log(`📧 Tenant registration approval email sent to ${owner.email}`);
      }
    } catch (emailError: any) {
      console.error('❌ Failed to send approval notification email:', emailError.message);
      // Don't throw - email failure shouldn't break the approval
    }

    return updated;
  }

  // Process unit modifications - Simple approval
  private async processUnitModifications(request: any, adminUser: RequestUser): Promise<any> {
    // Update request status to APPROVED
    const updated = await this.requestRepo.update(request.id, {
      status: 'APPROVED' as RequestStatus,
      approvedByAdmin: { connect: { id: adminUser.id } },
      approvedAt: new Date()
    });

    // Create audit log for request approval
    await this.auditService.create({
      action: 'REQUEST_APPROVED' as AuditAction,
      entityType: 'request',
      entityId: request.id,
      actorId: adminUser.id,
      unitId: request.unitId,
      changes: {
        before: request,
        after: updated,
        note: 'Unit modifications request approved'
      }
    });

    // Send email notification to the requesting owner
    try {
      const owner = await this.prisma.user.findUnique({
        where: { id: request.ownerId },
        select: { email: true, name: true }
      });

      if (owner?.email) {
        // Fetch unit details
        const unit = await this.prisma.unit.findUnique({
          where: { id: request.unitId },
          select: { unitNumber: true }
        });

        const modificationTypeDisplay = request.modificationType === 'OTHER'
          ? request.modificationTypeOther
          : request.modificationType?.replace(/_/g, ' ');

        await this.emailService.sendRequestApprovalNotification(
          owner.email,
          owner.name,
          'Unit Modifications',
          `Your unit modifications request (${modificationTypeDisplay}) for unit ${unit?.unitNumber || 'N/A'} has been approved. You may proceed with the planned modifications.`
        );
        console.log(`📧 Unit modifications approval email sent to ${owner.email}`);
      }
    } catch (emailError: any) {
      console.error('❌ Failed to send approval notification email:', emailError.message);
      // Don't throw - email failure shouldn't break the approval
    }

    return updated;
  }

  // Reject request (admin only)
  async reject(id: string, data: RejectRequestDto, user: RequestUser): Promise<any> {
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
  async cancel(id: string, user: RequestUser): Promise<any> {
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
  async revoke(id: string, reason: string, user: RequestUser): Promise<any> {
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
  private async generateRequestPDF(request: any, user: RequestUser): Promise<{ pdfUrl: string; pdfPublicId: string }> {
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

  // ==================== MESSAGE METHODS ====================

  // Create a message
  async createMessage(requestId: string, data: CreateMessageDto, user: RequestUser): Promise<any> {
    // Check access to the request
    const request = await this.checkAccess(requestId, user, 'view');

    // Create the message
    const message = await this.requestRepo.createMessage({
      requestId,
      authorUserId: user.id,
      authorRole: user.role,
      body: data.body
    });

    // Create audit log
    await this.auditService.create({
      action: 'REQUEST_MESSAGE_CREATED' as AuditAction,
      entityType: 'request_message',
      entityId: message.id,
      actorId: user.id,
      unitId: request.unitId,
      changes: { created: message }
    });

    return message;
  }

  // Get messages for a request
  async getMessages(requestId: string, filters: MessageFiltersDto, user: RequestUser): Promise<any> {
    // Check access to the request
    await this.checkAccess(requestId, user, 'view');

    return this.requestRepo.getMessages(requestId, filters);
  }

  // Delete a message (soft delete)
  async deleteMessage(messageId: string, user: RequestUser): Promise<any> {
    const message = await this.requestRepo.findMessageById(messageId);

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    // Only admin or the message author can delete
    if (user.role !== 'ADMIN' && message.authorUserId !== user.id) {
      throw new ForbiddenError('You can only delete your own messages');
    }

    // Check if already deleted
    if (message.deletedAt) {
      throw new ValidationError('Message already deleted');
    }

    const deleted = await this.requestRepo.deleteMessage(messageId);

    // Create audit log
    await this.auditService.create({
      action: 'REQUEST_MESSAGE_DELETED' as AuditAction,
      entityType: 'request_message',
      entityId: messageId,
      actorId: user.id,
      unitId: message.request.id,
      changes: { deleted: message }
    });

    return deleted;
  }
}
