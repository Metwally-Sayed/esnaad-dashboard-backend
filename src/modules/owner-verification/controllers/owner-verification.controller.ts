import { Request, Response, NextFunction } from 'express';
import { OwnerVerificationService } from '../services/owner-verification.service';
import { prisma } from '@/config/database';
import {
  UploadOwnerDocumentSchema,
  RejectUserVerificationSchema,
  ApproveUserVerificationSchema,
  VerificationFiltersSchema
} from '../dto/owner-verification.dto';
import { ValidationError } from '@/common/errors/AppError';

export class OwnerVerificationController {
  private verificationService: OwnerVerificationService;

  constructor() {
    this.verificationService = new OwnerVerificationService(prisma);
  }

  // ===== Owner Endpoints =====

  // Get current user's verification status
  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.verificationService.getStatus(req.user!);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user's uploaded documents
  getDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const documents = await this.verificationService.getDocuments(req.user!);

      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      next(error);
    }
  };

  // Upload a document
  uploadDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = UploadOwnerDocumentSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const document = await this.verificationService.uploadDocument(validation.data, req.user!);

      res.status(201).json({
        success: true,
        data: document,
        message: 'Document uploaded successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete a document
  deleteDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.verificationService.deleteDocument(req.params.id, req.user!);

      res.json({
        success: true,
        data: result,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Submit documents for review
  submitForReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.verificationService.submitForReview(req.user!);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  // ===== Admin Endpoints =====

  // Get all pending verifications
  getPendingVerifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = VerificationFiltersSchema.safeParse(req.query);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const result = await this.verificationService.getPendingVerifications(validation.data, req.user!);

      res.json({
        success: true,
        data: result  // Return the whole result object (contains data and meta)
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user verification details
  getUserVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData = await this.verificationService.getUserVerification(req.params.userId, req.user!);

      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      next(error);
    }
  };

  // Approve user verification
  approveUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = ApproveUserVerificationSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const result = await this.verificationService.approveUser(
        req.params.userId,
        req.user!.id,
        validation.data,
        req.user!
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  // Reject user verification
  rejectUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = RejectUserVerificationSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const result = await this.verificationService.rejectUser(
        req.params.userId,
        req.user!.id,
        validation.data,
        req.user!
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  // Get verification statistics
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.verificationService.getStats(req.user!);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };
}
