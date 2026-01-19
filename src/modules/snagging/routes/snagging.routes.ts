import { Router } from 'express';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import { Role } from '@prisma/client';

// Controllers
import {
  create,
  list,
  getStats,
  getById,
  update,
  sendToOwner,
  cancel,
  scheduleAppointment,
  accept,
  getByUnitId,
  regeneratePdf
} from '../controllers/snagging.controller';

// DTOs
import {
  createSnaggingSchema,
  updateSnaggingSchema,
  sendToOwnerSchema,
  scheduleAppointmentSchema,
  acceptSnaggingSchema,
  cancelSnaggingSchema,
  listSnaggingsSchema,
  getSnaggingByIdSchema,
  getSnaggingsByUnitIdSchema
} from '../dto/snagging.dto';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ⚠️ CRITICAL: SPECIFIC ROUTES MUST BE REGISTERED BEFORE PARAMETER ROUTES
// Register /unit/:unitId BEFORE /:id to prevent route shadowing
// This endpoint is accessible to both admin and owner (with permission checks in service)

/**
 * GET /api/snaggings/stats
 * Get snagging statistics (ADMIN ONLY)
 * Must be BEFORE /:id route
 */
router.get(
  '/stats',
  requireRole(Role.ADMIN),
  getStats
);

/**
 * GET /api/snaggings/unit/:unitId
 * Get snaggings for a specific unit (for widget)
 * Must be BEFORE /:id route
 */
router.get(
  '/unit/:unitId',
  validate(getSnaggingsByUnitIdSchema),
  getByUnitId
);

// ========== ADMIN ROUTES ==========

/**
 * POST /api/snaggings
 * Create snagging (ADMIN ONLY)
 */
router.post(
  '/',
  requireRole(Role.ADMIN),
  validate(createSnaggingSchema),
  create
);

/**
 * GET /api/snaggings
 * List snaggings (ADMIN ONLY)
 */
router.get(
  '/',
  requireRole(Role.ADMIN),
  validate(listSnaggingsSchema),
  list
);

/**
 * GET /api/snaggings/:id
 * Get snagging by ID (both admin and owner, with permission check in service)
 * Admin: can view any snagging
 * Owner: can view only their own snaggings (checked in service layer)
 */
router.get(
  '/:id',
  validate(getSnaggingByIdSchema),
  getById
);

/**
 * PATCH /api/snaggings/:id
 * Update snagging (ADMIN ONLY, DRAFT status only)
 */
router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  validate(updateSnaggingSchema),
  update
);

/**
 * POST /api/snaggings/:id/send
 * Send to owner (ADMIN ONLY)
 * Changes status: DRAFT → SENT_TO_OWNER
 */
router.post(
  '/:id/send',
  requireRole(Role.ADMIN),
  validate(sendToOwnerSchema),
  sendToOwner
);

/**
 * POST /api/snaggings/:id/cancel
 * Cancel snagging (ADMIN ONLY)
 * Can only cancel DRAFT or SENT_TO_OWNER status
 */
router.post(
  '/:id/cancel',
  requireRole(Role.ADMIN),
  validate(cancelSnaggingSchema),
  cancel
);

/**
 * POST /api/snaggings/:id/regenerate-pdf
 * Regenerate PDF for accepted snagging (ADMIN ONLY)
 */
router.post(
  '/:id/regenerate-pdf',
  requireRole(Role.ADMIN),
  validate(getSnaggingByIdSchema),
  regeneratePdf
);

// ========== OWNER ROUTES ==========

/**
 * POST /api/snaggings/:id/schedule
 * Schedule appointment (OWNER ONLY)
 * Can only schedule while status = SENT_TO_OWNER
 */
router.post(
  '/:id/schedule',
  validate(scheduleAppointmentSchema),
  scheduleAppointment
);

/**
 * POST /api/snaggings/:id/accept
 * Accept snagging (OWNER ONLY)
 * Changes status: SENT_TO_OWNER → ACCEPTED
 * Generates PDF with all items and images
 */
router.post(
  '/:id/accept',
  validate(acceptSnaggingSchema),
  accept
);

export default router;
