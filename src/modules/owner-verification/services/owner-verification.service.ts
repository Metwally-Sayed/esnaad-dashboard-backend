import { User, Role, OwnerVerificationStatus, DocumentApprovalStatus, AuditAction } from '@prisma/client';
import { OwnerVerificationRepository } from '../repositories/owner-verification.repository';
import {
  UploadOwnerDocumentDto,
  RejectOwnerDocumentDto,
  ApproveUserVerificationDto,
  RejectUserVerificationDto,
  VerificationFiltersDto
} from '../dto/owner-verification.dto';
import { ForbiddenError, NotFoundError, ValidationError } from '@/common/errors/AppError';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '@/modules/audit-logs/services/audit.service';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { NotificationRepository } from '@/modules/notifications/repositories/notification.repository';

// Minimal user type for verification operations
type VerificationUser = Pick<User, 'id' | 'role'> & { name?: string | null; email?: string | null };

export class OwnerVerificationService {
  private verificationRepo: OwnerVerificationRepository;
  private auditService: AuditService;
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.verificationRepo = new OwnerVerificationRepository(prisma);
    this.auditService = new AuditService(prisma);
    const notificationRepo = new NotificationRepository();
    this.notificationService = new NotificationService(notificationRepo);
  }

  // ===== Owner Methods =====

  /**
   * Get current user's verification status
   */
  async getStatus(user: VerificationUser) {
    const userWithDocuments = await this.verificationRepo.findUserWithDocuments(user.id);

    if (!userWithDocuments) {
      throw new NotFoundError('User not found');
    }

    return {
      verificationStatus: userWithDocuments.verificationStatus,
      verificationNote: userWithDocuments.verificationNote,
      documents: userWithDocuments.ownerDocuments,
      canSubmit: this.canSubmitForReview(userWithDocuments)
    };
  }

  /**
   * Get user's uploaded documents
   */
  async getDocuments(user: VerificationUser) {
    return this.verificationRepo.findDocumentsByUserId(user.id);
  }

  /**
   * Upload a new document (passport or national ID)
   */
  async uploadDocument(data: UploadOwnerDocumentDto, user: VerificationUser) {
    // Only OWNER role can upload documents
    if (user.role !== Role.OWNER) {
      throw new ForbiddenError('Only owners can upload verification documents');
    }

    // Check if user is in a state that allows uploads
    const userData = await this.verificationRepo.findUserWithDocuments(user.id);
    if (!userData) {
      throw new NotFoundError('User not found');
    }

    if (userData.verificationStatus === 'PENDING_APPROVAL') {
      throw new ValidationError('Cannot upload documents while verification is pending admin approval');
    }

    if (userData.verificationStatus === 'APPROVED') {
      throw new ValidationError('Verification is already approved');
    }

    // Check if user already has a document of this type
    const existingCount = await this.verificationRepo.countDocumentsByType(user.id, data.type);
    if (existingCount > 0) {
      throw new ValidationError(`You have already uploaded a ${data.type === 'PASSPORT' ? 'passport' : 'national ID'}. Please delete the existing one first.`);
    }

    // Create document
    const document = await this.verificationRepo.createDocument({
      user: { connect: { id: user.id } },
      type: data.type,
      fileKey: data.fileKey,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      status: 'PENDING'
    });

    // Audit log
    await this.auditService.create({
      action: AuditAction.OWNER_DOCUMENT_UPLOADED,
      entityType: 'owner_document',
      entityId: document.id,
      actorId: user.id,
      changes: { created: document }
    });

    return document;
  }

  /**
   * Delete a document (only if in PENDING status)
   */
  async deleteDocument(documentId: string, user: VerificationUser) {
    const document = await this.verificationRepo.findDocumentById(documentId);

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Only document owner can delete
    if (document.userId !== user.id) {
      throw new ForbiddenError('You can only delete your own documents');
    }

    // Can only delete if user is in PENDING_DOCUMENTS or REJECTED status
    const userData = await this.verificationRepo.findUserWithDocuments(user.id);
    if (userData?.verificationStatus === 'PENDING_APPROVAL') {
      throw new ValidationError('Cannot delete documents while verification is pending admin approval');
    }

    if (userData?.verificationStatus === 'APPROVED') {
      throw new ValidationError('Cannot delete documents after verification is approved');
    }

    await this.verificationRepo.deleteDocument(documentId);

    // Audit log
    await this.auditService.create({
      action: AuditAction.OWNER_DOCUMENT_DELETED,
      entityType: 'owner_document',
      entityId: documentId,
      actorId: user.id,
      changes: { deleted: document }
    });

    return { success: true };
  }

  /**
   * Submit documents for admin review
   */
  async submitForReview(user: VerificationUser) {
    const userData = await this.verificationRepo.findUserWithDocuments(user.id);

    if (!userData) {
      throw new NotFoundError('User not found');
    }

    // Check if can submit
    if (!this.canSubmitForReview(userData)) {
      throw new ValidationError('Cannot submit for review. Please upload both passport and national ID documents.');
    }

    if (userData.verificationStatus === 'PENDING_APPROVAL') {
      throw new ValidationError('Verification is already pending admin approval');
    }

    if (userData.verificationStatus === 'APPROVED') {
      throw new ValidationError('Verification is already approved');
    }

    // Update user status to PENDING_APPROVAL
    const updatedUser = await this.verificationRepo.updateUserVerificationStatus(
      user.id,
      'PENDING_APPROVAL'
    );

    return {
      verificationStatus: updatedUser.verificationStatus,
      message: 'Documents submitted for admin review'
    };
  }

  // ===== Admin Methods =====

  /**
   * Get all pending verifications (admin only)
   */
  async getPendingVerifications(filters: VerificationFiltersDto, user: VerificationUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can view pending verifications');
    }

    return this.verificationRepo.findPendingVerifications(filters, user);
  }

  /**
   * Get user verification details (admin only)
   */
  async getUserVerification(userId: string, user: VerificationUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can view user verifications');
    }

    const userData = await this.verificationRepo.findUserWithDocuments(userId);

    if (!userData) {
      throw new NotFoundError('User not found');
    }

    return userData;
  }

  /**
   * Approve user verification (admin only)
   */
  async approveUser(userId: string, adminId: string, data: ApproveUserVerificationDto, user: VerificationUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can approve user verifications');
    }

    const userData = await this.verificationRepo.findUserWithDocuments(userId);

    if (!userData) {
      throw new NotFoundError('User not found');
    }

    if (userData.verificationStatus !== 'PENDING_APPROVAL') {
      throw new ValidationError('User is not pending approval');
    }

    // Check if user has both documents
    if (!this.canSubmitForReview(userData)) {
      throw new ValidationError('User must have both passport and national ID documents to be approved');
    }

    // Approve all pending documents
    const documentsToApprove = userData.ownerDocuments.filter(d => d.status === 'PENDING');
    await Promise.all(
      documentsToApprove.map(doc =>
        this.verificationRepo.updateDocument(doc.id, {
          status: 'APPROVED',
          reviewedByAdmin: { connect: { id: adminId } },
          reviewedAt: new Date()
        })
      )
    );

    // Update user status to APPROVED
    const updatedUser = await this.verificationRepo.updateUserVerificationStatus(
      userId,
      'APPROVED',
      data.note
    );

    // Audit log
    await this.auditService.create({
      action: AuditAction.OWNER_VERIFICATION_APPROVED,
      entityType: 'user',
      entityId: userId,
      actorId: adminId,
      changes: {
        before: { verificationStatus: userData.verificationStatus },
        after: { verificationStatus: 'APPROVED', note: data.note }
      }
    });

    // Notify owner that verification was approved
    await this.notificationService.createNotification({
      userId: userId,
      type: 'OWNER_VERIFICATION_APPROVED',
      title: 'Verification Approved',
      message: 'Your ownership verification has been approved',
      entityType: 'user',
      entityId: userId,
      actionUrl: '/owner-verification',
    });

    return {
      verificationStatus: updatedUser.verificationStatus,
      message: 'User verification approved successfully'
    };
  }

  /**
   * Reject user verification (admin only)
   */
  async rejectUser(userId: string, adminId: string, data: RejectUserVerificationDto, user: VerificationUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can reject user verifications');
    }

    const userData = await this.verificationRepo.findUserWithDocuments(userId);

    if (!userData) {
      throw new NotFoundError('User not found');
    }

    if (userData.verificationStatus !== 'PENDING_APPROVAL') {
      throw new ValidationError('User is not pending approval');
    }

    // Reject all pending documents
    const documentsToReject = userData.ownerDocuments.filter(d => d.status === 'PENDING');
    await Promise.all(
      documentsToReject.map(doc =>
        this.verificationRepo.updateDocument(doc.id, {
          status: 'REJECTED',
          rejectionReason: data.reason,
          reviewedByAdmin: { connect: { id: adminId } },
          reviewedAt: new Date()
        })
      )
    );

    // Update user status to REJECTED
    const updatedUser = await this.verificationRepo.updateUserVerificationStatus(
      userId,
      'REJECTED',
      data.reason
    );

    // Audit log
    await this.auditService.create({
      action: AuditAction.OWNER_VERIFICATION_REJECTED,
      entityType: 'user',
      entityId: userId,
      actorId: adminId,
      changes: {
        before: { verificationStatus: userData.verificationStatus },
        after: { verificationStatus: 'REJECTED', reason: data.reason }
      }
    });

    // Notify owner that verification was rejected
    await this.notificationService.createNotification({
      userId: userId,
      type: 'OWNER_VERIFICATION_REJECTED',
      title: 'Verification Rejected',
      message: `Your verification was rejected: ${data.reason}`,
      entityType: 'user',
      entityId: userId,
      actionUrl: '/owner-verification',
      metadata: {
        reason: data.reason,
      },
    });

    return {
      verificationStatus: updatedUser.verificationStatus,
      message: 'User verification rejected'
    };
  }

  /**
   * Get verification statistics (admin only)
   */
  async getStats(user: VerificationUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can view verification statistics');
    }

    return this.verificationRepo.getVerificationStats();
  }

  // ===== Helper Methods =====

  /**
   * Check if user can submit for review
   * Requires both PASSPORT and NATIONAL_ID documents
   */
  private canSubmitForReview(userData: any): boolean {
    const hasPassport = userData.ownerDocuments.some((d: any) => d.type === 'PASSPORT');
    const hasNationalId = userData.ownerDocuments.some((d: any) => d.type === 'NATIONAL_ID');
    return hasPassport && hasNationalId;
  }
}
