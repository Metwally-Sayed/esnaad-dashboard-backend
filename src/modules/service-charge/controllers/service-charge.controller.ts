import { Request, Response, NextFunction } from 'express';
import { ServiceChargeService } from '../services/service-charge.service';
import { ServiceChargePdfService } from '../services/service-charge-pdf.service';

export class ServiceChargeController {
  private service: ServiceChargeService;
  private pdfService: ServiceChargePdfService;

  constructor() {
    this.service = new ServiceChargeService();
    this.pdfService = new ServiceChargePdfService();
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/service-charges
   * Get all project service charges (Admin only)
   */
  getAllProjectServiceCharges = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getAllProjectServiceCharges(
        req.query,
        req.user!
      );
      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/service-charges/:id
   * Get project service charge by ID (Admin only)
   */
  getProjectServiceChargeById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getProjectServiceChargeById(
        req.params.id,
        req.user!
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/admin/service-charges
   * Create project service charge (Admin only) - Legacy multi-unit
   */
  createProjectServiceCharge = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.createProjectServiceCharge(
        req.body,
        req.user!
      );
      res.status(201).json({
        success: true,
        data: result,
        message: 'Service charge created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/admin/service-charges/simple
   * Create simple service charge for single unit (Admin only)
   */
  createSimpleServiceCharge = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.createSimpleServiceCharge(
        req.body,
        req.user!
      );
      res.status(201).json({
        success: true,
        data: result,
        message: 'Service charge created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/admin/service-charges/:id
   * Update project service charge (Admin only)
   */
  updateProjectServiceCharge = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.updateProjectServiceCharge(
        req.params.id,
        req.body,
        req.user!
      );
      res.json({
        success: true,
        data: result,
        message: 'Service charge updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/admin/service-charges/:id
   * Delete project service charge (Admin only)
   */
  deleteProjectServiceCharge = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this.service.deleteProjectServiceCharge(
        req.params.id,
        req.user!
      );
      res.json({
        success: true,
        message: 'Service charge deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/service-charges/:id/units
   * Get unit service charges for a project service charge (Admin only)
   */
  getUnitServiceCharges = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getUnitServiceCharges(
        req.params.id,
        req.query,
        req.user!
      );
      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/admin/unit-service-charges/:id
   * Override unit service charge amount (Admin only)
   */
  overrideUnitServiceCharge = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.overrideUnitServiceCharge(
        req.params.id,
        req.body,
        req.user!
      );
      res.json({
        success: true,
        data: result,
        message: 'Unit service charge overridden successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/admin/unit-service-charges/:id/generate-pdf
   * Generate PDF statement for unit service charge (Admin only)
   */
  generatePdfStatement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.pdfService.generatePdfStatement(
        req.params.id,
        req.user!.id
      );
      res.json({
        success: true,
        data: result,
        message: 'PDF statement generated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/projects/:projectId/units
   * Get units for a project (for service charge creation)
   */
  getUnitsForProject = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getUnitsForProject(
        req.params.projectId,
        req.user!
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/units/all
   * Get all units from all projects (for service charge creation)
   */
  getAllUnitsForServiceCharge = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getAllUnitsForServiceCharge(req.user!);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // OWNER ENDPOINTS
  // ============================================

  /**
   * GET /api/service-charges
   * Get service charges for owned units (Owner only)
   */
  getOwnerServiceCharges = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getOwnerServiceCharges(
        req.query,
        req.user!
      );
      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/service-charges/:id/download
   * Download PDF statement (Owner can download their own)
   */
  downloadPdfStatement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.getDownloadUrl(
        req.params.id,
        req.user!
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
