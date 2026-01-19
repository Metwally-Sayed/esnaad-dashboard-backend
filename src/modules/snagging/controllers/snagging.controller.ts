import { Request, Response, NextFunction } from 'express';
import { SnaggingService } from '../services/snagging.service';
import { successResponse } from '../../../common/utils/response';
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

const snaggingService = new SnaggingService();

// ========== ADMIN ENDPOINTS ==========

/**
 * POST /api/snaggings
 * Create a new snagging with items (ADMIN ONLY)
 */
export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = createSnaggingSchema.parse({ body: req.body });
    const snagging = await snaggingService.create(validated.body, req.user!);
    res.status(201).json(successResponse(snagging, 'Snagging created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/snaggings/stats
 * Get snagging statistics (ADMIN ONLY)
 */
export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stats = await snaggingService.getStats(req.user!);
    res.json(successResponse(stats));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/snaggings
 * List all snaggings with pagination and filters (ADMIN ONLY)
 */
export const list = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = listSnaggingsSchema.parse({ query: req.query });
    const result = await snaggingService.list(validated.query, req.user!);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/snaggings/:id
 * Get snagging by ID (ADMIN ONLY per plan)
 */
export const getById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = getSnaggingByIdSchema.parse({ params: req.params });
    const snagging = await snaggingService.getById(validated.params.id, req.user!);
    res.json(successResponse(snagging));
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/snaggings/:id
 * Update snagging (ADMIN ONLY, DRAFT status only)
 */
export const update = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = updateSnaggingSchema.parse({
      params: req.params,
      body: req.body
    });
    const snagging = await snaggingService.update(
      validated.params.id,
      validated.body,
      req.user!
    );
    res.json(successResponse(snagging, 'Snagging updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/snaggings/:id/send
 * Send snagging to owner (ADMIN ONLY)
 * Changes status from DRAFT to SENT_TO_OWNER
 */
export const sendToOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = sendToOwnerSchema.parse({ params: req.params });
    const snagging = await snaggingService.sendToOwner(validated.params.id, req.user!);
    res.json(successResponse(snagging, 'Snagging sent to owner successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/snaggings/:id/cancel
 * Cancel snagging (ADMIN ONLY)
 * Changes status to CANCELLED
 * Can only cancel DRAFT or SENT_TO_OWNER (NOT ACCEPTED)
 */
export const cancel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = cancelSnaggingSchema.parse({ params: req.params });
    const snagging = await snaggingService.cancelSnagging(validated.params.id, req.user!);
    res.json(successResponse(snagging, 'Snagging cancelled successfully'));
  } catch (error) {
    next(error);
  }
};

// ========== OWNER ENDPOINTS ==========

/**
 * POST /api/snaggings/:id/schedule
 * Schedule appointment for snagging (OWNER ONLY)
 * Can only schedule while status = SENT_TO_OWNER
 * Appointment is optional (owner can accept without scheduling)
 */
export const scheduleAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = scheduleAppointmentSchema.parse({
      params: req.params,
      body: req.body
    });
    const snagging = await snaggingService.scheduleAppointment(
      validated.params.id,
      validated.body,
      req.user!
    );
    res.json(successResponse(snagging, 'Appointment scheduled successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/snaggings/:id/accept
 * Accept snagging and generate PDF (OWNER ONLY)
 * No payload required - just the action
 * Changes status from SENT_TO_OWNER to ACCEPTED
 * Generates PDF with all items and images
 * Uploads PDF to Cloudinary
 * Everything becomes read-only after acceptance
 */
export const accept = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = acceptSnaggingSchema.parse({ params: req.params });
    const snagging = await snaggingService.acceptSnagging(validated.params.id, req.user!);
    res.json(successResponse(snagging, 'Snagging accepted successfully. PDF has been generated.'));
  } catch (error) {
    next(error);
  }
};

// ========== SHARED ENDPOINTS ==========

/**
 * GET /api/snaggings/unit/:unitId
 * Get snaggings for a specific unit (BOTH ADMIN & OWNER)
 * Used by the Unit Snagging Widget
 * Owners can only access their own units
 * Admins can access any unit
 */
export const getByUnitId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = getSnaggingsByUnitIdSchema.parse({ params: req.params });
    const snaggings = await snaggingService.getSnaggingsByUnitId(
      validated.params.unitId,
      req.user!
    );
    res.json(successResponse(snaggings));
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/snaggings/:id/regenerate-pdf
 * Regenerate PDF for accepted snagging (ADMIN ONLY)
 */
export const regeneratePdf = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = getSnaggingByIdSchema.parse({ params: req.params });
    const snagging = await snaggingService.regeneratePdf(
      validated.params.id,
      req.user!
    );
    res.json(successResponse(snagging, 'PDF regenerated successfully'));
  } catch (error) {
    next(error);
  }
};
