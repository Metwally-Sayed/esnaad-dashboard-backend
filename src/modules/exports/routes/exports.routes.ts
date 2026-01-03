import { Router } from 'express';
import { ExportsController } from '../controllers/exports.controller';
import { requireAuth } from '../../../common/middleware/auth.middleware';

const router = Router();
const exportsController = new ExportsController();

// All routes require authentication
router.use(requireAuth);

// Export unit to PDF
router.get('/units/:id/pdf', exportsController.exportUnitToPdf);

// Export unit to DOCX
router.get('/units/:id/docx', exportsController.exportUnitToDocx);

export default router;
