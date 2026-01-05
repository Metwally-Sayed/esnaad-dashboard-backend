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

  // List handovers
  // Admin: can see all with filters
  // Owner: can see only their handovers
  router.get('/', controller.list);

  // Get handover by ID
  // Admin: can access any
  // Owner: can access only their handovers
  router.get('/:id', controller.getById);

  // Update handover (Admin only, allowed in certain states)
  router.patch('/:id', requireRole(Role.ADMIN), controller.update);

  // Workflow actions
  router.post('/:id/send', requireRole(Role.ADMIN), controller.sendToOwner);
  router.post('/:id/owner-confirm', controller.ownerConfirm); // Owner action
  router.post('/:id/request-changes', controller.requestChanges); // Owner action
  router.post('/:id/admin-confirm', requireRole(Role.ADMIN), controller.adminConfirm);
  router.post('/:id/complete', requireRole(Role.ADMIN), controller.complete);
  router.post('/:id/cancel', requireRole(Role.ADMIN), controller.cancel);

  // Messages
  router.get('/:id/messages', controller.getMessages);
  router.post('/:id/messages', controller.addMessage);

  // Items management
  router.post('/:id/items', requireRole(Role.ADMIN), controller.updateItems);

  return router;
}