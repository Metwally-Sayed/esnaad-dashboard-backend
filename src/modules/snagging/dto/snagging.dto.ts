import { z } from 'zod';
import { SnaggingStatus, SnaggingPriority } from '@prisma/client';

// Create snagging thread schema
export const createSnaggingSchema = z.object({
  body: z.object({
    unitId: z.string().cuid('Invalid unit ID'),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    priority: z.nativeEnum(SnaggingPriority).optional().default(SnaggingPriority.MEDIUM),
    attachments: z.array(z.object({
      url: z.string().url(),
      fileName: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number().positive()
    })).optional().default([])
  })
});

// Update snagging thread schema
export const updateSnaggingSchema = z.object({
  params: z.object({
    id: z.string().cuid()
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    status: z.nativeEnum(SnaggingStatus).optional(),
    priority: z.nativeEnum(SnaggingPriority).optional()
  })
});

// List snaggings query schema
export const listSnaggingsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().positive()).optional(),
    limit: z.string().transform(Number).pipe(z.number().positive().max(100)).optional(),
    status: z.nativeEnum(SnaggingStatus).optional(),
    priority: z.nativeEnum(SnaggingPriority).optional(),
    unitId: z.string().cuid().optional(),
    createdByUserId: z.string().cuid().optional(),
    search: z.string().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional()
  })
});

// Get snagging by ID schema
export const getSnaggingByIdSchema = z.object({
  params: z.object({
    id: z.string().cuid()
  }),
  query: z.object({
    includeMessages: z.string().transform(val => val === 'true').optional(),
    messageLimit: z.string().transform(Number).pipe(z.number().positive().max(50)).optional()
  })
});

// Delete snagging schema
export const deleteSnaggingSchema = z.object({
  params: z.object({
    id: z.string().cuid()
  })
});

// Get snaggings by unit schema
export const getSnaggingsByUnitSchema = z.object({
  params: z.object({
    unitId: z.string().cuid()
  }),
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().positive()).optional(),
    limit: z.string().transform(Number).pipe(z.number().positive().max(100)).optional(),
    status: z.nativeEnum(SnaggingStatus).optional(),
    priority: z.nativeEnum(SnaggingPriority).optional()
  })
});

export type CreateSnaggingDto = z.infer<typeof createSnaggingSchema>['body'];
export type UpdateSnaggingDto = z.infer<typeof updateSnaggingSchema>['body'];
export type ListSnaggingsQueryDto = z.infer<typeof listSnaggingsSchema>['query'];