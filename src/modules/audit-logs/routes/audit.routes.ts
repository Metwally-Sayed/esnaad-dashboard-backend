import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuditController } from '../controllers/audit.controller';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

export function createAuditRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const auditController = new AuditController(prisma);

  // All routes require authentication and admin role
  router.use(requireAuth);
  router.use(requireRole(Role.ADMIN));

  // Get all audit logs with pagination and filters
  router.get('/', auditController.getAuditLogs);

  // Get audit logs for specific entity
  router.get('/entity/:entityType/:entityId', auditController.getAuditLogsByEntity);

  // Get audit logs by actor
  router.get('/actor/:actorId', auditController.getAuditLogsByActor);

  return router;
}

export default createAuditRoutes;
