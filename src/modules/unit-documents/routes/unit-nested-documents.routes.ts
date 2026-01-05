import { Router } from 'express';
import { UnitDocumentsController } from '../controllers/unit-documents.controller';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import {
  getUnitDocumentsQuerySchema,
  createDocumentSchema,
} from '../dto/unit-documents.dto';

const router = Router({ mergeParams: true }); // Important: merge params from parent router
const controller = new UnitDocumentsController();

// All routes require authentication
router.use(requireAuth);

// GET /api/units/:unitId/documents
router.get(
  '/',
  validate(getUnitDocumentsQuerySchema),
  controller.getUnitDocuments
);

// POST /api/units/:unitId/documents
router.post(
  '/',
  validate(createDocumentSchema),
  controller.createDocument
);

export default router;
