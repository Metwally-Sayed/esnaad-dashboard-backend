import { AuditAction, Role, Snagging } from '@prisma/client';
import { SnaggingRepository } from '../repositories/snagging.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../common/errors/AppError';
import { prisma } from '../../../config/database';
import { DocumentService } from '@/modules/docs/services/document.service';
import { CloudinaryUploadService } from '@/modules/uploads/services/cloudinary-upload.service';
import { AuditService } from '@/modules/audit-logs/services/audit.service';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { NotificationRepository } from '@/modules/notifications/repositories/notification.repository';
import { CreateSnaggingDto, UpdateSnaggingDto, ScheduleAppointmentDto, SnaggingFiltersDto, UpdateSignatureDto } from '../dto/snagging.dto';
import { createPaginatedResponse } from '../../../common/utils/pagination';
import { logger } from '@config/logger';

// Type for authenticated user from JWT
type AuthUser = { id: string; email: string; role: Role; name?: string | null };

export class SnaggingService {
  private snaggingRepo: SnaggingRepository;
  private documentService: DocumentService;
  private cloudinaryService: CloudinaryUploadService;
  private auditService: AuditService;
  private notificationService: NotificationService;

  constructor() {
    this.snaggingRepo = new SnaggingRepository();
    this.documentService = new DocumentService(prisma);
    this.cloudinaryService = new CloudinaryUploadService();
    this.auditService = new AuditService(prisma);
    const notificationRepo = new NotificationRepository();
    this.notificationService = new NotificationService(notificationRepo);
  }

  // ✅ STRICT ACCESS CONTROL - Core RBAC method
  private async checkAccess(
    snaggingId: string,
    user: AuthUser,
    action: 'view' | 'edit' | 'action'
  ): Promise<Snagging> {
    const snagging = await this.snaggingRepo.findById(snaggingId);
    if (!snagging) {
      throw new NotFoundError('Snagging not found');
    }

    if (user.role === 'ADMIN') {
      return snagging; // Admin has full access
    }

    if (user.role === 'OWNER') {
      // STRICT: Owner can ONLY access their own snaggings
      if (snagging.ownerId !== user.id) {
        throw new ForbiddenError('You can only access snaggings for your own units');
      }

      // Owner cannot edit at all
      if (action === 'edit') {
        throw new ForbiddenError('Only administrators can edit snaggings');
      }

      return snagging;
    }

    throw new ForbiddenError('No access to snagging');
  }

  // ========== ADMIN METHODS ==========

  // Create snagging with items (ADMIN ONLY)
  // Supports both formats:
  // 1. Root-level images: { images: [...] }
  // 2. Nested items: { items: [{ images: [...] }] }
  async create(data: CreateSnaggingDto, user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can create snaggings');
    }

    // Verify unit exists
    const unit = await prisma.unit.findUnique({
      where: { id: data.unitId },
      include: { owner: true }
    });

    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    // Verify owner exists
    const owner = await prisma.user.findUnique({
      where: { id: data.ownerId }
    });

    if (!owner) {
      throw new NotFoundError('Owner not found');
    }

    // Handle both formats: convert root-level images to items if needed
    let rawItems = data.items || [];

    // If root-level images provided and no items, create a single item with all images
    if (data.images && data.images.length > 0 && (!rawItems || rawItems.length === 0)) {
      // Generate publicId from imageUrl if not provided
      const processedImages = data.images.map(img => ({
        imageUrl: img.imageUrl,
        publicId: img.publicId || img.imageUrl.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, ''),
        caption: img.caption
      }));

      rawItems = [
        {
          category: 'General',
          label: data.title,
          location: 'Unit',
          severity: 'HIGH' as const,
          notes: data.description,
          images: processedImages
        }
      ];
    }

    // Normalize items to ensure all required fields have values
    const items = rawItems.map(item => ({
      category: item.category || 'General',
      label: item.label || 'Issue',
      location: item.location || 'Unit',
      severity: item.severity || 'MEDIUM',
      notes: item.notes,
      images: (item.images || []).map(img => ({
        imageUrl: img.imageUrl,
        publicId: img.publicId,
        caption: img.caption
      }))
    }));

    // Validate items
    if (items.length === 0) {
      throw new ValidationError('At least one item with images is required');
    }

    if (items.length > 50) {
      throw new ValidationError('Maximum 50 items allowed per snagging');
    }

    // Create snagging with items
    const snagging = await this.snaggingRepo.create({
      unitId: data.unitId,
      ownerId: data.ownerId,
      createdByAdminId: user.id,
      title: data.title,
      description: data.description,
      notes: data.notes,
      status: 'DRAFT',
      items: items
    });

    // Create audit log
    await this.auditService.create({
      action: AuditAction.SNAGGING_CREATED,
      entityType: 'snagging',
      entityId: snagging.id,
      actorId: user.id,
      unitId: data.unitId,
      changes: {
        created: {
          title: snagging.title,
          unitId: data.unitId,
          ownerId: data.ownerId,
          itemsCount: items.length
        }
      }
    });

    return snagging;
  }

  // Update snagging (ADMIN ONLY, DRAFT status only)
  async update(id: string, data: UpdateSnaggingDto, user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can update snaggings');
    }

    const snagging = await this.snaggingRepo.findById(id);
    if (!snagging) {
      throw new NotFoundError('Snagging not found');
    }

    // Can only update in DRAFT status
    if (snagging.status !== 'DRAFT') {
      throw new ValidationError('Can only update snaggings in DRAFT status');
    }

    // If items are being updated, delete old items and create new ones
    if (data.items) {
      // Delete all existing items
      await prisma.snaggingItem.deleteMany({
        where: { snaggingId: id }
      });

      // Update with new items
      const updated = await prisma.snagging.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          notes: data.notes,
          items: {
            create: data.items.map((item, index) => ({
              category: item.category,
              label: item.label,
              location: item.location,
              severity: item.severity as any,
              notes: item.notes,
              sortOrder: index,
              images: {
                create: item.images.map((img, imgIndex) => ({
                  imageUrl: img.imageUrl,
                  publicId: img.publicId,
                  caption: img.caption,
                  sortOrder: imgIndex
                }))
              }
            }))
          }
        },
        include: {
          unit: true,
          owner: true,
          createdByAdmin: true,
          items: {
            include: { images: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });

      await this.auditService.create({
        action: AuditAction.SNAGGING_UPDATED,
        entityType: 'snagging',
        entityId: id,
        actorId: user.id,
        unitId: snagging.unitId,
        changes: { updated: data }
      });

      return updated;
    } else {
      // Just update basic fields
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const updated = await this.snaggingRepo.update(id, updateData);

      await this.auditService.create({
        action: AuditAction.SNAGGING_UPDATED,
        entityType: 'snagging',
        entityId: id,
        actorId: user.id,
        unitId: snagging.unitId,
        changes: { updated: data }
      });

      return updated;
    }
  }

  // Send to owner (ADMIN ONLY) - generates PDF when sending
  async sendToOwner(id: string, user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can send snaggings');
    }

    const snagging = await this.checkAccess(id, user, 'edit');

    if (snagging.status !== 'DRAFT') {
      throw new ValidationError('Can only send draft snaggings');
    }

    // Require admin signature before sending to owner
    if (!snagging.adminSignatureUrl) {
      throw new ValidationError('Admin signature is required before sending to owner. Please sign the snagging report first.');
    }

    // Load full relations for PDF generation
    const snaggingWithDetails = await this.snaggingRepo.findByIdWithDetails(id);
    if (!snaggingWithDetails) {
      throw new NotFoundError('Snagging not found');
    }

    // Generate PDF when sending to owner (includes admin signature if present)
    const pdfData = {
      ...snaggingWithDetails,
      adminName: snaggingWithDetails.createdByAdmin.name || snaggingWithDetails.createdByAdmin.email,
      ownerName: snaggingWithDetails.owner.name || snaggingWithDetails.owner.email
    };

    const pdfBuffer = await this.documentService.generatePDF('snagging-report-v1', pdfData);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: pdfBuffer,
      fileName: `snagging_${snagging.id}_sent.pdf`,
      mimeType: 'application/pdf',
      userId: user.id
    });

    // Update status and PDF URL
    const updated = await prisma.snagging.update({
      where: { id },
      data: {
        status: 'SENT_TO_OWNER',
        pdfUrl: uploadResult.publicUrl,
        pdfPublicId: uploadResult.key
      },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: {
          include: { images: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    await this.auditService.create({
      action: AuditAction.SNAGGING_SENT_TO_OWNER,
      entityType: 'snagging',
      entityId: id,
      actorId: user.id,
      unitId: snagging.unitId,
      changes: { status: { from: 'DRAFT', to: 'SENT_TO_OWNER' }, pdfGenerated: true }
    });

    // Notify owner that snagging was sent
    await this.notificationService.createNotification({
      userId: updated.ownerId,
      type: 'SNAGGING_SENT_TO_OWNER',
      title: 'New Snagging Report',
      message: `A snagging report for Unit ${updated.unit.unitNumber} is ready for your review`,
      entityType: 'snagging',
      entityId: updated.id,
      actionUrl: `/snaggings/${updated.id}`,
      metadata: {
        unitNumber: updated.unit.unitNumber,
      },
    });

    return updated;
  }

  // Cancel snagging (ADMIN ONLY)
  async cancelSnagging(id: string, user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can cancel snaggings');
    }

    const snagging = await this.snaggingRepo.findById(id);
    if (!snagging) {
      throw new NotFoundError('Snagging not found');
    }

    // ✅ CANCELLATION RULES:
    // 1. Can cancel DRAFT status anytime
    // 2. Can cancel SENT_TO_OWNER status anytime
    // 3. CANNOT cancel ACCEPTED status (immutable)
    // 4. CANNOT cancel already CANCELLED status
    if (snagging.status === 'ACCEPTED') {
      throw new ValidationError('Cannot cancel an accepted snagging');
    }

    if (snagging.status === 'CANCELLED') {
      throw new ValidationError('Snagging is already cancelled');
    }

    const updated = await this.snaggingRepo.update(id, {
      status: 'CANCELLED'
    });

    await this.auditService.create({
      action: AuditAction.SNAGGING_CANCELLED,
      entityType: 'snagging',
      entityId: id,
      actorId: user.id,
      unitId: snagging.unitId,
      changes: { status: { from: snagging.status, to: 'CANCELLED' } }
    });

    // NEW: Notify owner if snagging was sent to them
    if (snagging.status === 'SENT_TO_OWNER') {
      const unit = await prisma.unit.findUnique({
        where: { id: snagging.unitId },
        select: { unitNumber: true }
      });

      await this.notificationService.createNotification({
        userId: snagging.ownerId,
        type: 'SNAGGING_CANCELLED',
        title: 'Snagging Report Cancelled',
        message: `The snagging report for unit ${unit?.unitNumber || 'N/A'} has been cancelled`,
        entityType: 'snagging',
        entityId: snagging.id,
        actionUrl: `/snaggings/${snagging.id}`,
        metadata: {
          unitNumber: unit?.unitNumber,
          previousStatus: snagging.status,
        },
      });
    }

    return updated;
  }

  // List snaggings (ADMIN ONLY)
  async list(filters: SnaggingFiltersDto, user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can list all snaggings');
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.unitId) where.unitId = filters.unitId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.status) where.status = filters.status;

    const { data, total } = await this.snaggingRepo.findAll({
      skip,
      take: limit,
      where,
      orderBy: { createdAt: 'desc' }
    });

    return createPaginatedResponse(data, page, limit, total);
  }

  // Get by ID (ADMIN ONLY per plan - owners use getByUnitId)
  async getById(id: string, user: AuthUser) {
    return this.checkAccess(id, user, 'view');
  }

  // ========== OWNER METHODS ==========

  // Schedule appointment (OWNER ONLY, status must be SENT_TO_OWNER)
  async scheduleAppointment(id: string, data: ScheduleAppointmentDto, user: AuthUser) {
    const snagging = await this.checkAccess(id, user, 'action');

    // ✅ APPOINTMENT RULES:
    // 1. Can ONLY set/update appointment while status = SENT_TO_OWNER
    // 2. Appointment becomes read-only after ACCEPTED or CANCELLED
    // 3. Date must be in the future (validated in DTO)
    // 4. Appointment is OPTIONAL - owner can accept without setting appointment

    if (snagging.status !== 'SENT_TO_OWNER') {
      throw new ValidationError('Can only set appointment while snagging is pending review');
    }

    // ✅ CLARIFICATION: scheduledAt stores both date AND time
    const appointmentDateTime = new Date(data.scheduledAt);

    // Additional validation: ensure future date
    if (appointmentDateTime <= new Date()) {
      throw new ValidationError('Appointment must be scheduled for a future date and time');
    }

    const updated = await this.snaggingRepo.update(id, {
      scheduledAt: appointmentDateTime,
      scheduledNote: data.scheduledNote
    });

    await this.auditService.create({
      action: AuditAction.SNAGGING_APPOINTMENT_SET,
      entityType: 'snagging',
      entityId: id,
      actorId: user.id,
      unitId: snagging.unitId,
      changes: {
        scheduledAt: appointmentDateTime.toISOString(),
        scheduledNote: data.scheduledNote
      }
    });

    return updated;
  }

  // Accept snagging - REQUIRES BOTH SIGNATURES
  async acceptSnagging(id: string, user: AuthUser) {
    const snagging = await this.checkAccess(id, user, 'action');

    if (snagging.status !== 'SENT_TO_OWNER') {
      throw new ValidationError('Can only accept when sent to owner');
    }

    // Validate both signatures are present
    if (!snagging.adminSignatureUrl) {
      throw new ValidationError('Admin signature is required before acceptance');
    }
    if (!snagging.ownerSignatureUrl) {
      throw new ValidationError('Please sign the snagging report before accepting');
    }

    // Load full relations for PDF generation
    const snaggingWithDetails = await this.snaggingRepo.findByIdWithDetails(id);

    if (!snaggingWithDetails) {
      throw new NotFoundError('Snagging not found');
    }

    // Generate final PDF with both e-signatures
    const pdfData = {
      ...snaggingWithDetails,
      adminName: snaggingWithDetails.createdByAdmin.name || snaggingWithDetails.createdByAdmin.email,
      ownerName: snaggingWithDetails.owner.name || snaggingWithDetails.owner.email,
      acceptedAt: new Date(),
      // Include signature URLs for PDF template
      adminSignatureUrl: snagging.adminSignatureUrl,
      ownerSignatureUrl: snagging.ownerSignatureUrl,
      adminSignedAt: snagging.adminSignedAt,
      ownerSignedAt: snagging.ownerSignedAt
    };

    const pdfBuffer = await this.documentService.generatePDF('snagging-report-v1', pdfData);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: pdfBuffer,
      fileName: `snagging_${snagging.id}_accepted.pdf`,
      mimeType: 'application/pdf',
      userId: user.id
    });

    // Update with final status and PDF
    const updated = await this.snaggingRepo.update(id, {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      pdfUrl: uploadResult.publicUrl,
      pdfPublicId: uploadResult.key
    });

    await this.auditService.create({
      action: AuditAction.SNAGGING_ACCEPTED,
      entityType: 'snagging',
      entityId: id,
      actorId: user.id,
      unitId: snagging.unitId,
      changes: {
        status: { from: 'SENT_TO_OWNER', to: 'ACCEPTED' },
        adminSigned: !!snagging.adminSignatureUrl,
        ownerSigned: !!snagging.ownerSignatureUrl
      }
    });

    await this.auditService.create({
      action: AuditAction.SNAGGING_PDF_GENERATED,
      entityType: 'snagging',
      entityId: id,
      actorId: user.id,
      unitId: snagging.unitId,
      changes: { pdfUrl: uploadResult.publicUrl, finalPdf: true }
    });

    // Notify admin that owner accepted snagging
    await this.notificationService.createNotification({
      userId: updated.createdByAdmin.id,
      type: 'SNAGGING_ACCEPTED',
      title: 'Snagging Accepted',
      message: `Owner has accepted the snagging report for Unit ${updated.unit.unitNumber}`,
      entityType: 'snagging',
      entityId: updated.id,
      actionUrl: `/snaggings/${updated.id}`,
      metadata: {
        unitNumber: updated.unit.unitNumber,
      },
    });

    return updated;
  }

  // Regenerate PDF for accepted snagging (ADMIN ONLY)
  async regeneratePdf(id: string, user: AuthUser) {
    const snagging = await this.checkAccess(id, user, 'edit');

    if (snagging.status !== 'ACCEPTED') {
      throw new ValidationError('Can only regenerate PDF for accepted snaggings');
    }

    // Load full relations for PDF generation
    const snaggingWithDetails = await this.snaggingRepo.findByIdWithDetails(id);

    if (!snaggingWithDetails) {
      throw new NotFoundError('Snagging not found');
    }

    // Generate PDF with names (no signatures)
    const pdfData = {
      ...snaggingWithDetails,
      adminName: snaggingWithDetails.createdByAdmin.name || snaggingWithDetails.createdByAdmin.email,
      ownerName: snaggingWithDetails.owner.name || snaggingWithDetails.owner.email,
      acceptedAt: snaggingWithDetails.acceptedAt || new Date()
    };

    const pdfBuffer = await this.documentService.generatePDF('snagging-report-v1', pdfData);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: pdfBuffer,
      fileName: `snagging_${snagging.id}_regenerated.pdf`,
      mimeType: 'application/pdf',
      userId: user.id
    });

    // Update with new PDF URL
    const updated = await this.snaggingRepo.update(id, {
      pdfUrl: uploadResult.publicUrl,
      pdfPublicId: uploadResult.key
    });

    await this.auditService.create({
      action: AuditAction.SNAGGING_PDF_GENERATED,
      entityType: 'snagging',
      entityId: id,
      actorId: user.id,
      unitId: snagging.unitId,
      changes: { pdfUrl: uploadResult.publicUrl, action: 'regenerated' }
    });

    return updated;
  }

  // Get stats for snaggings (ADMIN ONLY)
  async getStats(user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can view stats');
    }

    // Get all counts in parallel for efficiency
    const [total, draft, sentToOwner, accepted, cancelled, withPdf, withImages] = await Promise.all([
      prisma.snagging.count(),
      prisma.snagging.count({ where: { status: 'DRAFT' } }),
      prisma.snagging.count({ where: { status: 'SENT_TO_OWNER' } }),
      prisma.snagging.count({ where: { status: 'ACCEPTED' } }),
      prisma.snagging.count({ where: { status: 'CANCELLED' } }),
      prisma.snagging.count({ where: { pdfUrl: { not: null } } }),
      prisma.snagging.count({
        where: {
          items: {
            some: {
              images: {
                some: {}
              }
            }
          }
        }
      })
    ]);

    return {
      total,
      draft,
      sentToOwner,
      accepted,
      cancelled,
      withPdf,
      withImages
    };
  }

  // Get snaggings by unit (for owner widget)
  async getSnaggingsByUnitId(unitId: string, user: AuthUser) {
    // Verify user has access to this unit
    const unit = await prisma.unit.findUnique({
      where: { id: unitId }
    });

    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    if (user.role === 'OWNER' && unit.ownerId !== user.id) {
      throw new ForbiddenError('You can only view snaggings for your own units');
    }

    // Get all snaggings for this unit
    let snaggings = await this.snaggingRepo.findByUnitId(unitId);

    // ✅ OWNER VISIBILITY RULE: Owners can only see snaggings that have been sent to them
    // Filter out DRAFT snaggings for owners (admins see all)
    if (user.role === 'OWNER') {
      snaggings = snaggings.filter(s => s.status !== 'DRAFT');
    }

    // Return in paginated response format for consistency
    return createPaginatedResponse(snaggings, 1, snaggings.length, snaggings.length);
  }

  // ========== BACKGROUND PDF GENERATION ==========

  // Generates PDF and uploads to Cloudinary in the background
  private async generateAndUploadPdf(snaggingId: string, userId: string) {
    const snaggingWithDetails = await this.snaggingRepo.findByIdWithDetails(snaggingId);
    if (!snaggingWithDetails) return;

    const pdfData = {
      ...snaggingWithDetails,
      adminName: snaggingWithDetails.createdByAdmin.name || snaggingWithDetails.createdByAdmin.email,
      ownerName: snaggingWithDetails.owner.name || snaggingWithDetails.owner.email
    };

    const pdfBuffer = await this.documentService.generatePDF('snagging-report-v1', pdfData);

    const uploadResult = await this.cloudinaryService.uploadFileDirectly({
      fileBuffer: pdfBuffer,
      fileName: `snagging_${snaggingId}_signed.pdf`,
      mimeType: 'application/pdf',
      userId
    });

    await prisma.snagging.update({
      where: { id: snaggingId },
      data: {
        pdfUrl: uploadResult.publicUrl,
        pdfPublicId: uploadResult.key
      }
    });

    logger.info({ snaggingId }, 'Background PDF generation completed');
  }

  // ========== E-SIGNATURE METHODS ==========

  // Admin sign snagging (can sign in DRAFT or SENT_TO_OWNER status)
  // Auto-generates PDF when admin signs
  async updateAdminSignature(id: string, data: UpdateSignatureDto, user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can sign snaggings');
    }

    const snagging = await this.snaggingRepo.findById(id);
    if (!snagging) {
      throw new NotFoundError('Snagging not found');
    }

    // Admin can sign in DRAFT or SENT_TO_OWNER status
    if (!['DRAFT', 'SENT_TO_OWNER'].includes(snagging.status)) {
      throw new ValidationError(`Cannot sign snagging in ${snagging.status} status`);
    }

    // Update admin signature and return immediately
    const updated = await prisma.snagging.update({
      where: { id },
      data: {
        adminSignatureUrl: data.signatureUrl,
        adminSignedAt: new Date()
      },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: {
          include: { images: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    await this.auditService.create({
      action: AuditAction.SNAGGING_UPDATED,
      entityType: 'snagging',
      entityId: id,
      actorId: user.id,
      unitId: snagging.unitId,
      changes: { adminSignatureAdded: true }
    });

    // Generate PDF in the background (don't await — return response immediately)
    this.generateAndUploadPdf(id, user.id).catch((pdfError) => {
      logger.error({ err: pdfError, snaggingId: id }, 'Background PDF generation failed after admin signature');
    });

    return updated;
  }

  // Owner sign snagging (can only sign in SENT_TO_OWNER status)
  // Auto-regenerates PDF when owner signs
  async updateOwnerSignature(id: string, data: UpdateSignatureDto, user: AuthUser) {
    const snagging = await this.checkAccess(id, user, 'action');

    // Owner can only sign when status is SENT_TO_OWNER
    if (snagging.status !== 'SENT_TO_OWNER') {
      throw new ValidationError('Can only sign snagging when it has been sent to you');
    }

    // Update owner signature and return immediately
    const updated = await prisma.snagging.update({
      where: { id },
      data: {
        ownerSignatureUrl: data.signatureUrl,
        ownerSignedAt: new Date()
      },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: {
          include: { images: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    await this.auditService.create({
      action: AuditAction.SNAGGING_UPDATED,
      entityType: 'snagging',
      entityId: id,
      actorId: user.id,
      unitId: snagging.unitId,
      changes: { ownerSignatureAdded: true }
    });

    // Generate PDF in the background (don't await — return response immediately)
    this.generateAndUploadPdf(id, user.id).catch((pdfError) => {
      logger.error({ err: pdfError, snaggingId: id }, 'Background PDF generation failed after owner signature');
    });

    return updated;
  }
}
