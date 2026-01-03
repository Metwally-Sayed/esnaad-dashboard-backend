import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '../errors';
import { logger } from '../../config/logger';
import { errorResponse } from '../utils/response';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error({
    err,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user?.id,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.issues.map((e: any) => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    errorResponse(
      res,
      'Validation failed',
      422,
      errors,
      err.stack
    );
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      errorResponse(
        res,
        'A record with this value already exists',
        409,
        { field: err.meta?.target }
      );
      return;
    }

    if (err.code === 'P2025') {
      errorResponse(res, 'Record not found', 404);
      return;
    }

    errorResponse(res, 'Database error', 500);
    return;
  }

  // Custom AppError
  if (err instanceof AppError) {
    const errors = err instanceof ValidationError ? err.errors : undefined;
    errorResponse(
      res,
      err.message,
      err.statusCode,
      errors,
      err.stack
    );
    return;
  }

  // Default error
  errorResponse(
    res,
    'Internal server error',
    500,
    undefined,
    err.stack
  );
};

export const notFoundHandler = (
  req: Request,
  res: Response
): void => {
  errorResponse(res, `Route ${req.url} not found`, 404);
};
