import { Request, Response, NextFunction } from 'express';
import { SnaggingService } from '../services/snagging.service';
import { successResponse } from '../../../common/utils/response';

const snaggingService = new SnaggingService();

// Create a new snagging
export const createSnagging = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const snagging = await snaggingService.createSnagging(req.user!, req.body);
    res.status(201).json(successResponse(snagging, 'Snagging created successfully'));
  } catch (error) {
    next(error);
  }
};

// Get all snaggings (admin only)
export const getAllSnaggings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await snaggingService.getAllSnaggings(req.user!, req.query as any);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

// Get user's own snaggings
export const getMySnaggings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await snaggingService.getMySnaggings(req.user!, req.query as any);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

// Get snaggings by unit
export const getSnaggingsByUnit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { unitId } = req.params;
    const result = await snaggingService.getSnaggingsByUnit(
      req.user!,
      unitId,
      req.query as any
    );
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};

// Get snagging by ID
export const getSnaggingById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { includeMessages, messageLimit } = req.query;

    const snagging = await snaggingService.getSnaggingById(
      req.user!,
      id,
      includeMessages === 'true',
      messageLimit ? parseInt(messageLimit as string) : 10
    );
    res.json(successResponse(snagging));
  } catch (error) {
    next(error);
  }
};

// Update snagging
export const updateSnagging = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const snagging = await snaggingService.updateSnagging(
      req.user!,
      id,
      req.body
    );
    res.json(successResponse(snagging, 'Snagging updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Delete snagging
export const deleteSnagging = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await snaggingService.deleteSnagging(req.user!, id);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
};