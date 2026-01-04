import { z } from 'zod';

export const GeneratePresignedUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  type: z.enum(['image', 'document', 'any']).default('any'),
  prefix: z.string().optional(),
  maxSize: z.number().int().positive().optional()
});

export type GeneratePresignedUrlDto = z.infer<typeof GeneratePresignedUrlSchema>;