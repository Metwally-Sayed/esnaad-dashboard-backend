import { Request, Response, NextFunction } from 'express';
import { RequestService } from '../services/request.service';
import { PrismaClient } from '@prisma/client';
import {
  CreateRequestSchema,
  ApproveRequestSchema,
  RejectRequestSchema,
  RequestFiltersSchema,
  CreateMessageSchema,
  MessageFiltersSchema
} from '../dto/request.dto';
import { ValidationError } from '@/common/errors/AppError';

const prisma = new PrismaClient();

export class RequestController {
  private requestService: RequestService;

  constructor() {
    this.requestService = new RequestService(prisma);
  }

  // Create request
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = CreateRequestSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const request = await this.requestService.create(validation.data, req.user!);

      res.status(201).json({
        success: true,
        data: request
      });
    } catch (error) {
      next(error);
    }
  };

  // List requests
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = RequestFiltersSchema.safeParse(req.query);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const result = await this.requestService.list(validation.data, req.user!);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  };

  // Get request by ID
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = await this.requestService.getById(req.params.id, req.user!);

      res.json({
        success: true,
        data: request
      });
    } catch (error) {
      next(error);
    }
  };

  // Approve request (admin only)
  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = ApproveRequestSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const request = await this.requestService.approve(req.params.id, validation.data, req.user!);

      res.json({
        success: true,
        data: request
      });
    } catch (error) {
      next(error);
    }
  };

  // Reject request (admin only)
  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = RejectRequestSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const request = await this.requestService.reject(req.params.id, validation.data, req.user!);

      res.json({
        success: true,
        data: request
      });
    } catch (error) {
      next(error);
    }
  };

  // Cancel request (owner can cancel their own)
  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = await this.requestService.cancel(req.params.id, req.user!);

      res.json({
        success: true,
        data: request
      });
    } catch (error) {
      next(error);
    }
  };

  // Revoke request (admin only)
  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body;
      if (!reason || typeof reason !== 'string') {
        throw new ValidationError('Reason is required');
      }

      const request = await this.requestService.revoke(req.params.id, reason, req.user!);

      res.json({
        success: true,
        data: request
      });
    } catch (error) {
      next(error);
    }
  };

  // ==================== MESSAGE ENDPOINTS ====================

  // Create a message
  createMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = CreateMessageSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const message = await this.requestService.createMessage(
        req.params.id,
        validation.data,
        req.user!
      );

      res.status(201).json({
        success: true,
        data: message
      });
    } catch (error) {
      next(error);
    }
  };

  // Get messages for a request
  getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = MessageFiltersSchema.safeParse(req.query);
      if (!validation.success) {
        throw new ValidationError(validation.error.issues[0].message);
      }

      const result = await this.requestService.getMessages(
        req.params.id,
        validation.data,
        req.user!
      );

      res.json({
        success: true,
        data: result.data,
        nextCursor: result.nextCursor
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete a message
  deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const message = await this.requestService.deleteMessage(req.params.messageId, req.user!);

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      next(error);
    }
  };
}
