import { Response } from 'express';

interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  errors?: any;
  stack?: string;
}

export const successResponse = <T>(
  data: T,
  message?: string
): SuccessResponse<T> => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return response;
};

export const errorResponse = (
  res: Response,
  error: string,
  statusCode: number = 500,
  errors?: any,
  stack?: string
): Response => {
  const response: ErrorResponse = {
    success: false,
    error,
  };

  if (errors) {
    response.errors = errors;
  }

  if (stack && process.env.NODE_ENV === 'development') {
    response.stack = stack;
  }

  return res.status(statusCode).json(response);
};
