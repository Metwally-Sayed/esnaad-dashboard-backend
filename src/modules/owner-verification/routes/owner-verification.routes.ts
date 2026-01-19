import { Router } from 'express';
import { OwnerVerificationController } from '../controllers/owner-verification.controller';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

export function createOwnerVerificationRoutes(): Router {
  const router = Router();
  const controller = new OwnerVerificationController();

  // All routes require authentication
  router.use(requireAuth);

  // ===== Owner Routes =====

  // Get current user's verification status
  router.get('/status', controller.getStatus);

  // Get user's uploaded documents
  router.get('/documents', controller.getDocuments);

  // Upload a document (passport or national ID)
  router.post('/documents', controller.uploadDocument);

  // Delete a document
  router.delete('/documents/:id', controller.deleteDocument);

  // Submit documents for admin review
  router.post('/submit', controller.submitForReview);

  // ===== Admin Routes =====

  // Get all pending verifications (admin only)
  router.get('/admin/verifications', requireRole(Role.ADMIN), controller.getPendingVerifications);

  // Get verification statistics (admin only)
  router.get('/admin/stats', requireRole(Role.ADMIN), controller.getStats);

  // Get specific user verification details (admin only)
  router.get('/admin/verifications/:userId', requireRole(Role.ADMIN), controller.getUserVerification);

  // Approve user verification (admin only)
  router.post('/admin/verifications/:userId/approve', requireRole(Role.ADMIN), controller.approveUser);

  // Reject user verification (admin only)
  router.post('/admin/verifications/:userId/reject', requireRole(Role.ADMIN), controller.rejectUser);

  return router;
}
