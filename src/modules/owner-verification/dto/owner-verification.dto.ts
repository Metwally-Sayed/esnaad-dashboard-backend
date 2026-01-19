import { z } from 'zod';

// Enum schemas
export const OwnerDocumentTypeSchema = z.enum(['PASSPORT', 'NATIONAL_ID']);
export const DocumentApprovalStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export const OwnerVerificationStatusSchema = z.enum([
  'NOT_REQUIRED',
  'PENDING_DOCUMENTS',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED'
]);

// Upload owner document schema
export const UploadOwnerDocumentSchema = z.object({
  type: OwnerDocumentTypeSchema,
  fileKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024) // 10MB max
});

// Reject owner document schema
export const RejectOwnerDocumentSchema = z.object({
  reason: z.string().min(1).max(1000)
});

// Approve user verification schema
export const ApproveUserVerificationSchema = z.object({
  note: z.string().max(1000).optional()
});

// Reject user verification schema
export const RejectUserVerificationSchema = z.object({
  reason: z.string().min(1).max(1000)
});

// Filter schemas for admin
export const VerificationFiltersSchema = z.object({
  status: OwnerVerificationStatusSchema.optional(),
  search: z.string().optional(), // Search by name or email
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Type exports
export type OwnerDocumentType = z.infer<typeof OwnerDocumentTypeSchema>;
export type DocumentApprovalStatus = z.infer<typeof DocumentApprovalStatusSchema>;
export type OwnerVerificationStatus = z.infer<typeof OwnerVerificationStatusSchema>;
export type UploadOwnerDocumentDto = z.infer<typeof UploadOwnerDocumentSchema>;
export type RejectOwnerDocumentDto = z.infer<typeof RejectOwnerDocumentSchema>;
export type ApproveUserVerificationDto = z.infer<typeof ApproveUserVerificationSchema>;
export type RejectUserVerificationDto = z.infer<typeof RejectUserVerificationSchema>;
export type VerificationFiltersDto = z.infer<typeof VerificationFiltersSchema>;
