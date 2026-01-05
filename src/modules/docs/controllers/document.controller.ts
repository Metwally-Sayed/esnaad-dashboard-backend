import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { DocumentService } from '../services/document.service';
import { DocumentFiltersSchema, DocumentModuleSchema } from '../dto/document.dto';
import { AuthenticatedRequest } from '@/common/types/auth.types';
import { z } from 'zod';

export class DocumentController {
  private documentService: DocumentService;

  constructor(private prisma: PrismaClient) {
    this.documentService = new DocumentService(prisma);
  }

  // Get document by ID
  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const document = await this.documentService.getById(req.params.id);

      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      next(error);
    }
  };

  // List documents
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters = DocumentFiltersSchema.parse(req.query);
      const result = await this.documentService.list(filters);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  };

  // Get documents by module and entity
  getByModuleAndEntity = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const module = DocumentModuleSchema.parse(req.params.module);
      const entityId = z.string().cuid().parse(req.params.entityId);

      const documents = await this.documentService.getByModuleAndEntity(module as any, entityId);

      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      next(error);
    }
  };

  // Get documents by unit ID
  getByUnitId = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const unitId = z.string().cuid().parse(req.params.unitId);
      const documents = await this.documentService.getByUnitId(unitId);

      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      next(error);
    }
  };
}