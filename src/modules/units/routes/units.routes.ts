import { Router } from 'express';
import { UnitsController } from '../controllers/units.controller';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import {
  getUnitsQuerySchema,
  getUnitByIdSchema,
  createUnitSchema,
  updateUnitSchema,
  assignOwnerSchema,
  deleteUnitSchema,
} from '../dto/units.dto';
import { Role } from '@prisma/client';

const router = Router();
const unitsController = new UnitsController();

// All routes require authentication
router.use(requireAuth);

// Get current user's units (for ownership transfer)
router.get('/my-units', unitsController.getMyUnits);

// Get all units (admin sees all, owner sees only their units)
router.get('/', validate(getUnitsQuerySchema), unitsController.getUnits);

// Get unit by ID (admin sees all, owner sees only their units)
router.get('/:id', validate(getUnitByIdSchema), unitsController.getUnitById);

// NEW: Get handover status and PDF for unit (owner can access their own unit's handover)
router.get('/:id/handover', validate(getUnitByIdSchema), unitsController.getUnitHandover);

// Admin-only routes
router.post(
  '/',
  requireRole(Role.ADMIN),
  validate(createUnitSchema),
  unitsController.createUnit
);

router.put(
  '/:id',
  requireRole(Role.ADMIN),
  validate(updateUnitSchema),
  unitsController.updateUnit
);

router.post(
  '/:id/assign',
  requireRole(Role.ADMIN),
  validate(assignOwnerSchema),
  unitsController.assignOwner
);

router.post(
  '/:id/unassign',
  requireRole(Role.ADMIN),
  unitsController.unassignOwner
);

router.delete(
  '/:id',
  requireRole(Role.ADMIN),
  validate(deleteUnitSchema),
  unitsController.deleteUnit
);

export default router;
