import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();
const auditController = new AuditController();

// All routes require authentication and admin role
router.use(requireAuth);
router.use(requireRole(Role.ADMIN));

// Get all audit logs with pagination and filters
router.get('/', auditController.getAuditLogs);

// Get audit logs for specific entity
router.get('/entity/:entityType/:entityId', auditController.getAuditLogsByEntity);

// Get audit logs by actor
router.get('/actor/:actorId', auditController.getAuditLogsByActor);

export default router;
