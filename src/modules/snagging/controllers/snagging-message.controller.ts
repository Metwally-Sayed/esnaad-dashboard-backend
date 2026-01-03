import { Request, Response, NextFunction } from 'express';
import { SnaggingMessageService } from '../services/snagging-message.service';
import { successResponse } from '../../../common/utils/response';

const messageService = new SnaggingMessageService();

// Add message to snagging thread
export const addMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { snaggingId } = req.params;
    const message = await messageService.addMessage(
      req.user!,
      snaggingId,
      req.body
    );
    res.status(201).json(successResponse(message, 'Message added successfully'));
  } catch (error) {
    next(error);
  }
};

// Get messages with cursor pagination
export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { snaggingId } = req.params;
    const result = await messageService.getMessages(
      req.user!,
      snaggingId,
      req.query as any
    );
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

// Update message
export const updateMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { snaggingId, messageId } = req.params;
    const message = await messageService.updateMessage(
      req.user!,
      snaggingId,
      messageId,
      req.body
    );
    res.json(successResponse(message, 'Message updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Delete message
export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { snaggingId, messageId } = req.params;
    const result = await messageService.deleteMessage(
      req.user!,
      snaggingId,
      messageId
    );
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};