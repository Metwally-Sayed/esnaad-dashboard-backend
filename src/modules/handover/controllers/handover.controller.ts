import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { HandoverService } from '../services/handover.service';
import {
  CreateHandoverSchema,
  UpdateHandoverSchema,
  HandoverFiltersSchema,
  MessageFiltersSchema,
  CreateHandoverMessageSchema,
  SendToOwnerSchema,
  OwnerConfirmSchema,
  RequestChangesSchema,
  AdminConfirmSchema,
  CancelHandoverSchema,
  UpdateItemsSchema
} from '../dto/handover.dto';
import { AuthenticatedRequest } from '@/common/types/auth.types';

export class HandoverController {
  private handoverService: HandoverService;

  constructor(private prisma: PrismaClient) {
    this.handoverService = new HandoverService(prisma);
  }

  // Create handover
  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = CreateHandoverSchema.parse(req.body);
      const handover = await this.handoverService.create(data, req.user!);

      res.status(201).json({
        success: true,
        data: handover
      });
    } catch (error) {
      next(error);
    }
  };

  // List handovers
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters = HandoverFiltersSchema.parse(req.query);
      const result = await this.handoverService.list(filters, req.user!);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  };

  // Get handover by ID
  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const handover = await this.handoverService.getById(req.params.id, req.user!);

      res.json({
        success: true,
        data: handover
      });
    } catch (error) {
      next(error);
    }
  };

  // Update handover
  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = UpdateHandoverSchema.parse(req.body);
      const handover = await this.handoverService.update(req.params.id, data, req.user!);

      res.json({
        success: true,
        data: handover
      });
    } catch (error) {
      next(error);
    }
  };

  // Send to owner
  sendToOwner = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { message } = SendToOwnerSchema.parse(req.body);
      const handover = await this.handoverService.sendToOwner(req.params.id, message, req.user!);

      res.json({
        success: true,
        data: handover,
        message: 'Handover sent to owner successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Owner confirm
  ownerConfirm = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = OwnerConfirmSchema.parse(req.body);
      const handover = await this.handoverService.ownerConfirm(req.params.id, data, req.user!);

      res.json({
        success: true,
        data: handover,
        message: 'Handover confirmed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Request changes
  requestChanges = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { message } = RequestChangesSchema.parse(req.body);
      const handover = await this.handoverService.requestChanges(req.params.id, message, req.user!);

      res.json({
        success: true,
        data: handover,
        message: 'Changes requested successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Admin confirm
  adminConfirm = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { finalNotes } = AdminConfirmSchema.parse(req.body);
      const handover = await this.handoverService.adminConfirm(req.params.id, finalNotes, req.user!);

      res.json({
        success: true,
        data: handover,
        message: 'Admin confirmation completed'
      });
    } catch (error) {
      next(error);
    }
  };

  // Complete handover
  complete = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.handoverService.complete(req.params.id, req.user!);

      res.json({
        success: true,
        data: result,
        message: 'Handover completed and PDF agreement generated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Cancel handover
  cancel = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { reason } = CancelHandoverSchema.parse(req.body);
      const handover = await this.handoverService.cancel(req.params.id, reason, req.user!);

      res.json({
        success: true,
        data: handover,
        message: 'Handover cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Get messages
  getMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters = MessageFiltersSchema.parse(req.query);
      const result = await this.handoverService.getMessages(req.params.id, filters, req.user!);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  };

  // Add message
  addMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { body } = CreateHandoverMessageSchema.parse(req.body);
      const message = await this.handoverService.addMessage(req.params.id, body, req.user!);

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      next(error);
    }
  };

  // Update items
  updateItems = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { items } = UpdateItemsSchema.parse(req.body);
      const handover = await this.handoverService.updateItems(req.params.id, items, req.user!);

      res.json({
        success: true,
        data: handover,
        message: 'Handover items updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // NEW: Owner accept (simplified flow)
  ownerAccept = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.handoverService.ownerAccept(req.params.id, req.user!);

      res.json({
        success: true,
        data: result,
        message: 'Handover accepted successfully. PDF agreement generated.'
      });
    } catch (error) {
      next(error);
    }
  };
}