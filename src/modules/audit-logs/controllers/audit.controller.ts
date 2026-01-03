import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';
import { successResponse } from '../../../common/utils/response';

export class AuditController {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.auditService.getAuditLogs(req.query);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getAuditLogsByEntity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { entityType, entityId } = req.params;
      const result = await this.auditService.getAuditLogsByEntity(entityType, entityId, req.query);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getAuditLogsByActor = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { actorId } = req.params;
      const result = await this.auditService.getAuditLogsByActor(actorId, req.query);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };
}
