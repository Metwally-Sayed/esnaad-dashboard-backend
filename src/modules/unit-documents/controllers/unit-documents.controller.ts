import { Request, Response, NextFunction } from 'express';
import { UnitDocumentsService } from '../services/unit-documents.service';
import { successResponse } from '../../../common/utils/response';
import {
  GetUnitDocumentsQueryDto,
  CreateDocumentDto,
  GetAllDocumentsQueryDto,
} from '../dto/unit-documents.dto';

export class UnitDocumentsController {
  private documentsService: UnitDocumentsService;

  constructor() {
    this.documentsService = new UnitDocumentsService();
  }

  getUnitDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { unitId } = req.params;
      const query: GetUnitDocumentsQueryDto = req.query;
      const result = await this.documentsService.getUnitDocuments(unitId, query, req.user!);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getAllDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: GetAllDocumentsQueryDto = req.query;
      const result = await this.documentsService.getAllDocuments(query, req.user!);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  createDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { unitId } = req.params;
      const data: CreateDocumentDto = req.body;
      const document = await this.documentsService.createDocument(unitId, data, req.user!);
      res.status(201).json(successResponse({ document }, 'Document uploaded successfully'));
    } catch (error) {
      next(error);
    }
  };

  getDocumentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { documentId } = req.params;
      const document = await this.documentsService.getDocumentById(documentId, req.user!);
      res.json(successResponse({ document }));
    } catch (error) {
      next(error);
    }
  };

  getDownloadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { documentId } = req.params;
      const result = await this.documentsService.getDownloadUrl(documentId, req.user!);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  deleteDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { documentId } = req.params;
      await this.documentsService.deleteDocument(documentId, req.user!);
      res.json(successResponse(null, 'Document deleted successfully'));
    } catch (error) {
      next(error);
    }
  };
}
