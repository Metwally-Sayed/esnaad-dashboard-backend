import { z } from 'zod';

export const DocumentModuleSchema = z.enum(['HANDOVER', 'UNIT_PROFILE', 'SNAGGING', 'PROJECT']);
export const DocumentTypeSchema = z.enum(['PDF', 'DOCX', 'XLSX']);

export const DocumentFiltersSchema = z.object({
  module: DocumentModuleSchema.optional(),
  entityId: z.string().cuid().optional(),
  type: DocumentTypeSchema.optional(),
  templateKey: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10)
});

export type DocumentModule = z.infer<typeof DocumentModuleSchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type DocumentFiltersDto = z.infer<typeof DocumentFiltersSchema>;