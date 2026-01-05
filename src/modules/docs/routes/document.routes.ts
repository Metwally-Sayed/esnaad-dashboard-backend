import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { DocumentController } from '../controllers/document.controller';
import { requireAuth } from '../../../common/middleware/auth.middleware';

export function createDocumentRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const controller = new DocumentController(prisma);

  // All routes require authentication
  router.use(requireAuth);

  // Get documents by unit ID (must be before /:id to avoid conflicts)
  router.get('/unit/:unitId', controller.getByUnitId);

  // Get documents for specific module and entity
  router.get('/module/:module/entity/:entityId', controller.getByModuleAndEntity);

  // List documents with filters
  router.get('/', controller.list);

  // Get document metadata by ID
  router.get('/:id', controller.getById);

  return router;
}