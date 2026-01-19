import { Router } from 'express';
import { ServiceChargeController } from '../controllers/service-charge.controller';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import { Role } from '@prisma/client';
import {
  getAllProjectServiceChargesSchema,
  getProjectServiceChargeByIdSchema,
  createProjectServiceChargeSchema,
  updateProjectServiceChargeSchema,
  deleteProjectServiceChargeSchema,
  getUnitServiceChargesSchema,
  overrideUnitServiceChargeSchema,
  generatePdfStatementSchema,
  getOwnerServiceChargesSchema,
  downloadPdfStatementSchema,
} from '../dto/service-charge.dto';

const router = Router();
const controller = new ServiceChargeController();

// ============================================
// ADMIN ROUTES
// ============================================

// Project Service Charges
router.get(
  '/admin/service-charges',
  requireAuth,
  requireRole(Role.ADMIN),
  validate(getAllProjectServiceChargesSchema),
  controller.getAllProjectServiceCharges
);

router.get(
  '/admin/service-charges/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  validate(getProjectServiceChargeByIdSchema),
  controller.getProjectServiceChargeById
);

router.post(
  '/admin/service-charges',
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createProjectServiceChargeSchema),
  controller.createProjectServiceCharge
);

router.patch(
  '/admin/service-charges/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  validate(updateProjectServiceChargeSchema),
  controller.updateProjectServiceCharge
);

router.delete(
  '/admin/service-charges/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  validate(deleteProjectServiceChargeSchema),
  controller.deleteProjectServiceCharge
);

// Unit Service Charges
router.get(
  '/admin/service-charges/:id/units',
  requireAuth,
  requireRole(Role.ADMIN),
  validate(getUnitServiceChargesSchema),
  controller.getUnitServiceCharges
);

router.patch(
  '/admin/unit-service-charges/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  validate(overrideUnitServiceChargeSchema),
  controller.overrideUnitServiceCharge
);

router.post(
  '/admin/unit-service-charges/:id/generate-pdf',
  requireAuth,
  requireRole(Role.ADMIN),
  validate(generatePdfStatementSchema),
  controller.generatePdfStatement
);

// ============================================
// OWNER ROUTES
// ============================================

router.get(
  '/service-charges',
  requireAuth,
  requireRole(Role.OWNER),
  validate(getOwnerServiceChargesSchema),
  controller.getOwnerServiceCharges
);

router.get(
  '/service-charges/:id/download',
  requireAuth,
  validate(downloadPdfStatementSchema),
  controller.downloadPdfStatement
);

export default router;
