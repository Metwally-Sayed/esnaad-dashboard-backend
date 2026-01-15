import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { HandoverController } from '../controllers/handover.controller';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

export function createHandoverRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const controller = new HandoverController(prisma);

  // All routes require authentication
  router.use(requireAuth);

  // Create handover (Admin only)
  router.post('/', requireRole(Role.ADMIN), controller.create);

  // List handovers (Admin only - owners cannot browse all handovers)
  router.get('/', requireRole(Role.ADMIN), controller.list);

  // Get handover by ID (Owners can view their own handovers, Admins can view all)
  // Permission check is done in the service layer (checkAccess method)
  router.get('/:id', controller.getById);

  // Update handover (Admin only)
  router.patch('/:id', requireRole(Role.ADMIN), controller.update);

  // Workflow actions
  router.post('/:id/send', requireRole(Role.ADMIN), controller.sendToOwner);

  // NEW SIMPLIFIED FLOW: Owner Accept (generates PDF immediately)
  // This is the ONLY owner-accessible endpoint in handover module
  router.post('/:id/accept', controller.ownerAccept);

  // DEPRECATED endpoints (kept for backward compatibility)
  router.post('/:id/owner-confirm', controller.ownerConfirm);
  router.post('/:id/request-changes', controller.requestChanges);
  router.post('/:id/admin-confirm', requireRole(Role.ADMIN), controller.adminConfirm);
  router.post('/:id/complete', requireRole(Role.ADMIN), controller.complete);

  router.post('/:id/cancel', requireRole(Role.ADMIN), controller.cancel);

  // Messages (Admin only)
  router.get('/:id/messages', requireRole(Role.ADMIN), controller.getMessages);
  router.post('/:id/messages', requireRole(Role.ADMIN), controller.addMessage);

  // Items management (Admin only)
  router.post('/:id/items', requireRole(Role.ADMIN), controller.updateItems);

  return router;
}