import { Router } from 'express';
import { RequestController } from '../controllers/request.controller';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

export function createRequestRoutes(): Router {
  const router = Router();
  const controller = new RequestController();

  // All routes require authentication
  router.use(requireAuth);

  // Create request (owner creates for their units)
  router.post('/', controller.create);

  // List requests
  // Admin: can see all with filters
  // Owner: can see only their requests
  router.get('/', controller.list);

  // Get request by ID
  // Admin: can access any
  // Owner: can access only their requests
  router.get('/:id', controller.getById);

  // Admin actions
  router.post('/:id/approve', requireRole(Role.ADMIN), controller.approve);
  router.post('/:id/reject', requireRole(Role.ADMIN), controller.reject);
  router.post('/:id/revoke', requireRole(Role.ADMIN), controller.revoke);

  // Owner can cancel their own submitted requests
  router.post('/:id/cancel', controller.cancel);

  return router;
}
