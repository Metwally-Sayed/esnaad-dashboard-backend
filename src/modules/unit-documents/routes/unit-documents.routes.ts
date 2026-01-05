import { Router } from 'express';
import { UnitDocumentsController } from '../controllers/unit-documents.controller';
import { UnitDocumentsUploadController } from '../controllers/unit-documents-upload.controller';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import {
  getUnitDocumentsQuerySchema,
  getAllDocumentsQuerySchema,
  createDocumentSchema,
  getDocumentByIdSchema,
  deleteDocumentSchema,
  getDownloadUrlSchema,
} from '../dto/unit-documents.dto';
import { Role } from '@prisma/client';

const router = Router();
const controller = new UnitDocumentsController();
const uploadController = new UnitDocumentsUploadController();

// All routes require authentication
router.use(requireAuth);

// Get presigned URL for PDF upload (alternative method)
router.post('/presign', uploadController.getPresignedUploadUrl);

// Get all documents (admin sees all, owner sees only their units)
router.get(
  '/',
  validate(getAllDocumentsQuerySchema),
  controller.getAllDocuments
);

// Get document by ID (admin sees all, owner sees only their units)
router.get(
  '/:documentId',
  validate(getDocumentByIdSchema),
  controller.getDocumentById
);

// Get presigned download URL for document
router.get(
  '/:documentId/download',
  validate(getDownloadUrlSchema),
  controller.getDownloadUrl
);

// Delete document (admin only)
router.delete(
  '/:documentId',
  requireRole(Role.ADMIN),
  validate(deleteDocumentSchema),
  controller.deleteDocument
);

export default router;
