import { Request, Response, NextFunction } from 'express';
import { UnitsService } from '../services/units.service';
import { successResponse } from '../../../common/utils/response';
import { GetUnitsQueryDto, CreateUnitDto, UpdateUnitDto, AssignOwnerDto } from '../dto/units.dto';

export class UnitsController {
  private unitsService: UnitsService;

  constructor() {
    this.unitsService = new UnitsService();
  }

  getUnits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: GetUnitsQueryDto = req.query;
      const result = await this.unitsService.getUnits(query, req.user!);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getUnitById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const unit = await this.unitsService.getUnitById(id, req.user!);
      res.json(successResponse({ unit }));
    } catch (error) {
      next(error);
    }
  };

  createUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data: CreateUnitDto = req.body;
      const unit = await this.unitsService.createUnit(data, req.user!);
      res.status(201).json(successResponse({ unit }, 'Unit created successfully'));
    } catch (error) {
      next(error);
    }
  };

  updateUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data: UpdateUnitDto = req.body;
      const unit = await this.unitsService.updateUnit(id, data, req.user!);
      res.json(successResponse({ unit }, 'Unit updated successfully'));
    } catch (error) {
      next(error);
    }
  };

  assignOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { ownerId }: AssignOwnerDto = req.body;
      const unit = await this.unitsService.assignOwner(id, ownerId, req.user!);
      res.json(successResponse({ unit }, 'Owner assigned successfully'));
    } catch (error) {
      next(error);
    }
  };

  unassignOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const unit = await this.unitsService.unassignOwner(id, req.user!);
      res.json(successResponse({ unit }, 'Owner unassigned successfully'));
    } catch (error) {
      next(error);
    }
  };

  deleteUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.unitsService.deleteUnit(id, req.user!);
      res.json(successResponse(null, 'Unit deleted successfully'));
    } catch (error) {
      next(error);
    }
  };
}
