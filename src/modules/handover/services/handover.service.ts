import { User, HandoverStatus, AuditAction, Role } from '@prisma/client';
import { HandoverRepository } from '../repositories/handover.repository';
import { CreateHandoverDto, UpdateHandoverDto, HandoverFiltersDto, MessageFiltersDto, UpdateSignatureDto } from '../dto/handover.dto';
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from '@/common/errors/AppError';
import { PrismaClient } from '@prisma/client';
import { DocumentService } from '@/modules/docs/services/document.service';
import { AuditService } from '@/modules/audit-logs/services/audit.service';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { NotificationRepository } from '@/modules/notifications/repositories/notification.repository';
import { runBackgroundPdf } from '@/common/utils/background-pdf';

// State transition rules (SIMPLIFIED FLOW)
const STATE_TRANSITIONS: Record<HandoverStatus, HandoverStatus[]> = {
  DRAFT: ['SENT_TO_OWNER', 'CANCELLED'],
  SENT_TO_OWNER: ['ACCEPTED', 'CANCELLED'], // SIMPLIFIED: Only ACCEPT or CANCEL
  ACCEPTED: [], // Final state - no transitions
  CANCELLED: [], // Final state - no transitions

  // OLD FLOW (deprecated but kept for backward compatibility)
  OWNER_CONFIRMED: ['ADMIN_CONFIRMED', 'CANCELLED'],
  CHANGES_REQUESTED: ['SENT_TO_OWNER', 'CANCELLED'],
  ADMIN_CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: []
};

// Editable states
const EDITABLE_STATES: HandoverStatus[] = ['DRAFT'];

export class HandoverService {
  private handoverRepo: HandoverRepository;
  private documentService: DocumentService;
  private auditService: AuditService;
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.handoverRepo = new HandoverRepository(prisma);
    this.documentService = new DocumentService(prisma);
    this.auditService = new AuditService(prisma);
    const notificationRepo = new NotificationRepository();
    this.notificationService = new NotificationService(notificationRepo);
  }

  // Validate state transition
  private validateStateTransition(currentStatus: HandoverStatus, newStatus: HandoverStatus): void {
    const allowedTransitions = STATE_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Invalid state transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  // Check if user can access handover (ADMIN ONLY for module access)
  private async checkAccess(handoverId: string, user: User, action: 'view' | 'edit' | 'action'): Promise<any> {
    const handover = await this.handoverRepo.findById(handoverId);
    if (!handover) {
      throw new NotFoundError('Handover not found');
    }

    // Access control based on role and action
    if (user.role === 'ADMIN') {
      // Admins have full access to all handovers
      return handover;
    }

    if (user.role === 'OWNER') {
      // Owners can only VIEW and ACCEPT their own unit's handovers
      // They cannot EDIT or perform other actions (those are admin-only)

      // Check if this handover belongs to a unit owned by this user
      if (handover.ownerId !== user.id) {
        throw new ForbiddenError('You can only access handovers for your own units');
      }

      // Owners can view and accept (action), but not edit
      if (action === 'edit') {
        throw new ForbiddenError('Only administrators can edit handovers');
      }

      return handover;
    }

    // Any other role should not have access
    throw new ForbiddenError('You do not have permission to access this handover');
  }

  // Create handover
  async create(data: CreateHandoverDto, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can create handovers');
    }

    // Verify unit exists
    const unit = await this.prisma.unit.findUnique({
      where: { id: data.unitId }
    });
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    // Verify owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: data.ownerId }
    });
    if (!owner) {
      throw new NotFoundError('Owner not found');
    }

    // NEW REQUIREMENT: Check for ANY existing handover for this unit (except CANCELLED)
    // Per requirements: One handover per unit, but allow new if previous was cancelled
    const existingHandover = await this.prisma.handover.findFirst({
      where: {
        unitId: data.unitId,
        status: {
          not: 'CANCELLED' // Allow creation if only cancelled handovers exist
        }
      }
    });

    if (existingHandover) {
      const error: any = new ValidationError('A handover already exists for this unit');
      error.statusCode = 409; // Conflict
      error.existingHandoverId = existingHandover.id;
      throw error;
    }

    const handover = await this.handoverRepo.create({
      unit: { connect: { id: data.unitId } },
      owner: { connect: { id: data.ownerId } },
      createdByAdmin: { connect: { id: user.id } },
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      handoverAt: data.handoverAt ? new Date(data.handoverAt) : undefined,
      notes: data.notes,
      items: data.items ? {
        create: data.items.map((item, index) => ({
          ...item,
          sortOrder: item.sortOrder ?? index
        }))
      } : undefined,
      attachments: data.attachments ? {
        create: data.attachments
      } : undefined
    });

    // Create audit log
    await this.auditService.create({
      action: 'HANDOVER_CREATED' as AuditAction,
      entityType: 'handover',
      entityId: handover.id,
      actorId: user.id,
      unitId: data.unitId,
      changes: { created: handover }
    });

    return handover;
  }

  // Get stats for handovers (ADMIN ONLY)
  async getStats(user: User) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can view stats');
    }

    // Get all counts in parallel for efficiency
    const [total, draft, sentToOwner, accepted, cancelled, withPdf] = await Promise.all([
      this.prisma.handover.count(),
      this.prisma.handover.count({ where: { status: 'DRAFT' } }),
      this.prisma.handover.count({ where: { status: 'SENT_TO_OWNER' } }),
      this.prisma.handover.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.handover.count({ where: { status: 'CANCELLED' } }),
      this.prisma.handover.count({ where: { pdfUrl: { not: null } } })
    ]);

    return {
      total,
      draft,
      sentToOwner,
      accepted,
      cancelled,
      withPdf,
      pendingAction: sentToOwner // Alias for frontend compatibility
    };
  }

  // List handovers
  async list(filters: HandoverFiltersDto, user: User): Promise<any> {
    return this.handoverRepo.findMany(filters, user);
  }

  // Get handover details
  async getById(id: string, user: User): Promise<any> {
    return this.checkAccess(id, user, 'view');
  }

  // Update handover
  async update(id: string, data: UpdateHandoverDto, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can update handovers');
    }

    const handover = await this.checkAccess(id, user, 'edit');

    if (!EDITABLE_STATES.includes(handover.status)) {
      throw new ValidationError(`Cannot edit handover in ${handover.status} status`);
    }

    const updateData: any = {
      scheduledAt: data.scheduledAt !== undefined ? (data.scheduledAt ? new Date(data.scheduledAt) : null) : undefined,
      handoverAt: data.handoverAt !== undefined ? (data.handoverAt ? new Date(data.handoverAt) : null) : undefined,
      notes: data.notes,
      internalNotes: data.internalNotes
    };

    // Handle items update
    if (data.items !== undefined) {
      const existingItemIds = data.items.filter(item => (item as any).id).map(item => (item as any).id);
      await this.handoverRepo.deleteRemovedItems(id, existingItemIds);
      await this.handoverRepo.upsertItems(id, data.items);
    }

    // Handle attachments
    if (data.attachments !== undefined) {
      await this.handoverRepo.createAttachments(id, data.attachments);
    }

    const updated = await this.handoverRepo.update(id, updateData);

    await this.auditService.create({
      action: 'HANDOVER_UPDATED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      changes: { before: handover, after: updated }
    });

    return updated;
  }

  // Send to owner - generates PDF when sending
  async sendToOwner(id: string, message: string | undefined, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can send handovers to owners');
    }

    const handover = await this.checkAccess(id, user, 'action');
    this.validateStateTransition(handover.status, 'SENT_TO_OWNER');

    // Require admin signature before sending to owner
    if (!handover.adminSignatureUrl) {
      throw new ValidationError('Admin signature is required before sending to owner. Please sign the handover first.');
    }

    // Update status immediately
    const updated = await this.prisma.handover.update({
      where: { id },
      data: {
        status: 'SENT_TO_OWNER',
      },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: { orderBy: { sortOrder: 'asc' } },
        attachments: true
      }
    });

    // Add message if provided
    if (message) {
      await this.handoverRepo.createMessage({
        handover: { connect: { id } },
        author: { connect: { id: user.id } },
        authorRole: user.role,
        body: message
      });
    }

    await this.auditService.create({
      action: 'HANDOVER_SENT_TO_OWNER' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      metadata: { message }
    });

    // Notify owner that handover was sent
    await this.notificationService.createNotification({
      userId: handover.ownerId,
      type: 'HANDOVER_SENT_TO_OWNER',
      title: 'New Handover Available',
      message: `A handover for Unit ${handover.unit.unitNumber} is ready for your review`,
      entityType: 'handover',
      entityId: handover.id,
      actionUrl: `/handovers/${handover.id}`,
      metadata: {
        unitNumber: handover.unit.unitNumber,
      },
    });

    // Generate PDF in the background
    runBackgroundPdf(async () => {
      const snapshot = await this.handoverRepo.createSnapshot(id);
      const document = await this.documentService.generateHandoverAgreement(id, snapshot, user);
      await this.prisma.handover.update({
        where: { id },
        data: { pdfUrl: document.url, pdfPublicId: document.key }
      });
    }, { entity: 'handover', entityId: id });

    return updated;
  }

  // NEW SIMPLIFIED FLOW: Owner Accept (requires both signatures)
  async ownerAccept(id: string, user: User): Promise<any> {
    // Get handover without admin-only check
    const handover = await this.handoverRepo.findById(id);
    if (!handover) {
      throw new NotFoundError('Handover not found');
    }

    // Verify owner
    if (handover.ownerId !== user.id) {
      throw new ForbiddenError('Only the assigned owner can accept this handover');
    }

    // Validate state
    this.validateStateTransition(handover.status, 'ACCEPTED');

    // Validate both signatures are present
    if (!handover.adminSignatureUrl) {
      throw new ValidationError('Admin signature is required before acceptance');
    }
    if (!handover.ownerSignatureUrl) {
      throw new ValidationError('Please sign the handover before accepting');
    }

    // Get admin and owner details for legacy signature fields
    const admin = await this.prisma.user.findUnique({
      where: { id: handover.createdByAdminId },
      select: { name: true }
    });

    const owner = await this.prisma.user.findUnique({
      where: { id: handover.ownerId },
      select: { name: true }
    });

    // Update handover to ACCEPTED with signatures
    const updated = await this.prisma.handover.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        ownerAcceptedAt: new Date(),
        adminSignature: admin?.name || 'Admin',
        ownerSignature: owner?.name || 'Owner',
      },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: { orderBy: { sortOrder: 'asc' } },
        attachments: true
      }
    });

    // Create audit log
    await this.auditService.create({
      action: 'HANDOVER_ACCEPTED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      metadata: {
        adminSigned: !!handover.adminSignatureUrl,
        ownerSigned: !!handover.ownerSignatureUrl
      }
    });

    // Notify admin (handover creator) that owner accepted
    await this.notificationService.createNotification({
      userId: handover.createdByAdminId,
      type: 'HANDOVER_ACCEPTED',
      title: 'Handover Accepted',
      message: `Owner has accepted the handover for Unit ${handover.unit.unitNumber}`,
      entityType: 'handover',
      entityId: handover.id,
      actionUrl: `/handovers/${handover.id}`,
      metadata: {
        unitNumber: handover.unit.unitNumber,
        unitId: handover.unitId,
      },
    });

    // Generate final PDF in the background
    runBackgroundPdf(async () => {
      const snapshot = await this.handoverRepo.createSnapshot(id);
      const document = await this.documentService.generateHandoverAgreement(id, snapshot, user);
      await this.prisma.handover.update({
        where: { id },
        data: { pdfUrl: document.url, pdfPublicId: document.key }
      });
    }, { entity: 'handover', entityId: id });

    return updated;
  }

  // DEPRECATED: Old owner confirm (kept for backward compatibility)
  async ownerConfirm(
    id: string,
    data: { acknowledgement?: string; itemUpdates?: Array<{id: string; status: any; actualValue?: string; notes?: string}> },
    user: User
  ): Promise<any> {
    const handover = await this.checkAccess(id, user, 'action');

    if (handover.ownerId !== user.id) {
      throw new ForbiddenError('Only the assigned owner can confirm this handover');
    }

    this.validateStateTransition(handover.status, 'OWNER_CONFIRMED');

    // Update items if provided
    if (data.itemUpdates && data.itemUpdates.length > 0) {
      for (const itemUpdate of data.itemUpdates) {
        await this.prisma.handoverItem.update({
          where: { id: itemUpdate.id },
          data: {
            status: itemUpdate.status,
            actualValue: itemUpdate.actualValue,
            notes: itemUpdate.notes
          }
        });
      }
    }

    const updated = await this.handoverRepo.updateStatus(id, 'OWNER_CONFIRMED');

    if (data.acknowledgement) {
      await this.handoverRepo.createMessage({
        handover: { connect: { id } },
        author: { connect: { id: user.id } },
        authorRole: user.role,
        body: data.acknowledgement
      });
    }

    await this.auditService.create({
      action: 'HANDOVER_OWNER_CONFIRMED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      metadata: { acknowledgement: data.acknowledgement, itemsUpdated: data.itemUpdates?.length || 0 }
    });

    return updated;
  }

  // DEPRECATED: Owner request changes (kept for backward compatibility)
  async requestChanges(id: string, message: string, user: User): Promise<any> {
    const handover = await this.checkAccess(id, user, 'action');

    if (handover.ownerId !== user.id) {
      throw new ForbiddenError('Only the assigned owner can request changes');
    }

    this.validateStateTransition(handover.status, 'CHANGES_REQUESTED');

    const updated = await this.handoverRepo.updateStatus(id, 'CHANGES_REQUESTED');

    await this.handoverRepo.createMessage({
      handover: { connect: { id } },
      author: { connect: { id: user.id } },
      authorRole: user.role,
      body: message
    });

    await this.auditService.create({
      action: 'HANDOVER_CHANGES_REQUESTED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      metadata: { message }
    });

    return updated;
  }

  // Admin confirm
  async adminConfirm(id: string, finalNotes: string | undefined, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can perform final confirmation');
    }

    const handover = await this.checkAccess(id, user, 'action');
    this.validateStateTransition(handover.status, 'ADMIN_CONFIRMED');

    const updateData: any = {};
    if (finalNotes) {
      updateData.internalNotes = handover.internalNotes
        ? `${handover.internalNotes}\n\nFinal Notes: ${finalNotes}`
        : `Final Notes: ${finalNotes}`;
    }

    const updated = await this.handoverRepo.updateStatus(id, 'ADMIN_CONFIRMED', updateData);

    await this.auditService.create({
      action: 'HANDOVER_ADMIN_CONFIRMED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      metadata: { finalNotes }
    });

    return updated;
  }

  // Complete handover with PDF generation
  async complete(id: string, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can complete handovers');
    }

    const handover = await this.checkAccess(id, user, 'action');
    this.validateStateTransition(handover.status, 'COMPLETED');

    // Update status to completed
    const updated = await this.handoverRepo.updateStatus(id, 'COMPLETED');

    await this.auditService.create({
      action: 'HANDOVER_COMPLETED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
    });

    // Generate PDF in the background
    runBackgroundPdf(async () => {
      const snapshot = await this.handoverRepo.createSnapshot(id);
      const document = await this.documentService.generateHandoverAgreement(id, snapshot, user);
      await this.prisma.handover.update({
        where: { id },
        data: { pdfUrl: document.url, pdfPublicId: document.key }
      });
    }, { entity: 'handover', entityId: id });

    return updated;
  }

  // Cancel handover
  async cancel(id: string, reason: string, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can cancel handovers');
    }

    const handover = await this.checkAccess(id, user, 'action');

    if (handover.status === 'COMPLETED' || handover.status === 'CANCELLED') {
      throw new ValidationError(`Cannot cancel handover in ${handover.status} status`);
    }

    const updated = await this.handoverRepo.updateStatus(id, 'CANCELLED');

    await this.handoverRepo.createMessage({
      handover: { connect: { id } },
      author: { connect: { id: user.id } },
      authorRole: user.role,
      body: `Handover cancelled: ${reason}`
    });

    await this.auditService.create({
      action: 'HANDOVER_CANCELLED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      metadata: { reason }
    });

    return updated;
  }

  // Get messages
  async getMessages(id: string, filters: MessageFiltersDto, user: User): Promise<any> {
    await this.checkAccess(id, user, 'view');
    return this.handoverRepo.getMessages(id, filters);
  }

  // Add message
  async addMessage(id: string, body: string, user: User): Promise<any> {
    const handover = await this.checkAccess(id, user, 'view');

    // Allow messages even after completion for post-handover notes
    const message = await this.handoverRepo.createMessage({
      handover: { connect: { id } },
      author: { connect: { id: user.id } },
      authorRole: user.role,
      body
    });

    await this.auditService.create({
      action: 'HANDOVER_MESSAGE_CREATED' as AuditAction,
      entityType: 'handover_message',
      entityId: message.id,
      actorId: user.id,
      unitId: handover.unitId,
      metadata: { handoverId: id }
    });

    // Notify the OTHER party (if admin posts, notify owner; if owner posts, notify admin)
    const recipientUserId = user.role === 'ADMIN'
      ? handover.ownerId
      : handover.createdByAdminId;

    await this.notificationService.createNotification({
      userId: recipientUserId,
      type: 'HANDOVER_MESSAGE_CREATED',
      title: 'New Handover Message',
      message: `${user.name || user.email} posted a message on handover for Unit ${handover.unit.unitNumber}`,
      entityType: 'handover',
      entityId: handover.id,
      actionUrl: `/handovers/${handover.id}`,
      metadata: {
        messageId: message.id,
        authorName: user.name || user.email,
      },
    });

    return message;
  }

  // Update handover items
  async updateItems(id: string, items: any[], user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can update handover items');
    }

    const handover = await this.checkAccess(id, user, 'edit');

    if (!EDITABLE_STATES.includes(handover.status)) {
      throw new ValidationError(`Cannot edit handover items in ${handover.status} status`);
    }

    // Get existing item IDs from the request
    const existingItemIds = items.filter(item => item.id).map(item => item.id);

    // Delete items not in the list
    await this.handoverRepo.deleteRemovedItems(id, existingItemIds);

    // Upsert items
    await this.handoverRepo.upsertItems(id, items);

    await this.auditService.create({
      action: 'HANDOVER_UPDATED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      changes: { itemsUpdated: items.length }
    });

    // Return updated handover with items
    return this.handoverRepo.findById(id);
  }

  // ========== E-SIGNATURE METHODS ==========

  // Admin sign handover (can sign in DRAFT or SENT_TO_OWNER status)
  // Auto-generates PDF when admin signs
  async updateAdminSignature(id: string, data: UpdateSignatureDto, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can sign handovers');
    }

    const handover = await this.checkAccess(id, user, 'action');

    // Admin can sign in DRAFT or SENT_TO_OWNER status
    if (!['DRAFT', 'SENT_TO_OWNER'].includes(handover.status)) {
      throw new ValidationError(`Cannot sign handover in ${handover.status} status`);
    }

    // Update admin signature and return immediately
    const updated = await this.prisma.handover.update({
      where: { id },
      data: {
        adminSignatureUrl: data.signatureUrl,
        adminSignedAt: new Date()
      },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: { orderBy: { sortOrder: 'asc' } },
        attachments: true
      }
    });

    await this.auditService.create({
      action: 'HANDOVER_UPDATED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      changes: { adminSignatureAdded: true }
    });

    // Generate PDF in the background
    runBackgroundPdf(async () => {
      const snapshot = await this.handoverRepo.createSnapshot(id);
      const document = await this.documentService.generateHandoverAgreement(id, snapshot, user);
      await this.prisma.handover.update({
        where: { id },
        data: { pdfUrl: document.url, pdfPublicId: document.key }
      });
    }, { entity: 'handover', entityId: id });

    return updated;
  }

  // Owner sign handover (can only sign in SENT_TO_OWNER status)
  // Auto-regenerates PDF when owner signs
  async updateOwnerSignature(id: string, data: UpdateSignatureDto, user: User): Promise<any> {
    const handover = await this.handoverRepo.findById(id);
    if (!handover) {
      throw new NotFoundError('Handover not found');
    }

    // Verify owner
    if (handover.ownerId !== user.id) {
      throw new ForbiddenError('Only the assigned owner can sign this handover');
    }

    // Owner can only sign when status is SENT_TO_OWNER
    if (handover.status !== 'SENT_TO_OWNER') {
      throw new ValidationError('Can only sign handover when it has been sent to you');
    }

    // Update owner signature and return immediately
    const updated = await this.prisma.handover.update({
      where: { id },
      data: {
        ownerSignatureUrl: data.signatureUrl,
        ownerSignedAt: new Date()
      },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: { orderBy: { sortOrder: 'asc' } },
        attachments: true
      }
    });

    await this.auditService.create({
      action: 'HANDOVER_UPDATED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      changes: { ownerSignatureAdded: true }
    });

    // Generate PDF in the background
    runBackgroundPdf(async () => {
      const snapshot = await this.handoverRepo.createSnapshot(id);
      const document = await this.documentService.generateHandoverAgreement(id, snapshot, user);
      await this.prisma.handover.update({
        where: { id },
        data: { pdfUrl: document.url, pdfPublicId: document.key }
      });
    }, { entity: 'handover', entityId: id });

    return updated;
  }

  // Regenerate PDF (Admin only, for already sent/accepted handovers)
  async regeneratePdf(id: string, user: User): Promise<any> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can regenerate PDFs');
    }

    const handover = await this.checkAccess(id, user, 'action');

    // Can only regenerate for SENT_TO_OWNER or ACCEPTED status
    if (!['SENT_TO_OWNER', 'ACCEPTED'].includes(handover.status)) {
      throw new ValidationError(`Cannot regenerate PDF in ${handover.status} status`);
    }

    await this.auditService.create({
      action: 'HANDOVER_PDF_GENERATED' as AuditAction,
      entityType: 'handover',
      entityId: id,
      actorId: user.id,
      unitId: handover.unitId,
      metadata: { regenerated: true }
    });

    // Generate PDF in the background
    runBackgroundPdf(async () => {
      const snapshot = await this.handoverRepo.createSnapshot(id);
      const document = await this.documentService.generateHandoverAgreement(id, snapshot, user);
      await this.prisma.handover.update({
        where: { id },
        data: { pdfUrl: document.url, pdfPublicId: document.key }
      });
    }, { entity: 'handover', entityId: id });

    return handover;
  }
}