import { z } from 'zod';
import { DocumentCategory } from '@prisma/client';

export const getUnitDocumentsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    category: z.nativeEnum(DocumentCategory).optional(),
  }),
});

export const getDocumentByIdSchema = z.object({
  params: z.object({
    documentId: z.string().min(1),
  }),
});

export const createDocumentSchema = z.object({
  params: z.object({
    unitId: z.string().min(1),
  }),
  body: z.object({
    title: z.string().min(1).max(200),
    category: z.nativeEnum(DocumentCategory),
    fileKey: z.string().min(1),
    mimeType: z.string().refine(
      (val) => val === 'application/pdf',
      { message: 'Only PDF files are allowed' }
    ),
    sizeBytes: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
  }),
});

export const deleteDocumentSchema = z.object({
  params: z.object({
    documentId: z.string().min(1),
  }),
});

export const getAllDocumentsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    unitId: z.string().optional(),
    uploadedByUserId: z.string().optional(),
    category: z.nativeEnum(DocumentCategory).optional(),
    search: z.string().optional(),
  }),
});

export const getDownloadUrlSchema = z.object({
  params: z.object({
    documentId: z.string().min(1),
  }),
});

export type GetUnitDocumentsQueryDto = z.infer<typeof getUnitDocumentsQuerySchema>['query'];
export type CreateDocumentDto = z.infer<typeof createDocumentSchema>['body'];
export type GetAllDocumentsQueryDto = z.infer<typeof getAllDocumentsQuerySchema>['query'];
