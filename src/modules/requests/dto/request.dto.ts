import { z } from 'zod';

// Enum schemas
export const RequestTypeSchema = z.enum(['GUEST_VISIT', 'WORK_PERMISSION']);
export const RequestStatusSchema = z.enum(['SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']);
export const ExpiresModeSchema = z.enum(['DATE', 'USES', 'UNLIMITED']);

// Create request schema
export const CreateRequestSchema = z.object({
  unitId: z.string().cuid(),
  type: RequestTypeSchema,
  purpose: z.string().max(5000).optional(),

  // Visitor info (for GUEST_VISIT)
  visitorName: z.string().min(1).max(200).optional(),
  visitorPhone: z.string().max(50).optional(),

  // Work info (for WORK_PERMISSION)
  companyName: z.string().min(1).max(200).optional(),
  representativeName: z.string().max(200).optional(),

  // Schedule
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional()
}).refine((data) => {
  // Validate GUEST_VISIT requires visitorName
  if (data.type === 'GUEST_VISIT' && !data.visitorName) {
    return false;
  }
  // Validate WORK_PERMISSION requires companyName
  if (data.type === 'WORK_PERMISSION' && !data.companyName) {
    return false;
  }
  return true;
}, {
  message: 'Guest visits require visitorName, work permissions require companyName'
});

// Approve request schema
export const ApproveRequestSchema = z.object({
  expiresMode: ExpiresModeSchema,
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional()
}).refine((data) => {
  // DATE mode requires expiresAt
  if (data.expiresMode === 'DATE' && !data.expiresAt) {
    return false;
  }
  // USES mode requires maxUses
  if (data.expiresMode === 'USES' && !data.maxUses) {
    return false;
  }
  // UNLIMITED mode doesn't need either
  if (data.expiresMode === 'UNLIMITED' && (data.expiresAt || data.maxUses)) {
    return false;
  }
  return true;
}, {
  message: 'Invalid expiry configuration for the selected mode'
});

// Reject request schema
export const RejectRequestSchema = z.object({
  reason: z.string().min(1).max(5000)
});

// Filter schemas
export const RequestFiltersSchema = z.object({
  status: RequestStatusSchema.optional(),
  type: RequestTypeSchema.optional(),
  unitId: z.string().cuid().optional(),
  ownerId: z.string().cuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.enum(['createdAt', 'approvedAt', 'type', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Type exports
export type CreateRequestDto = z.infer<typeof CreateRequestSchema>;
export type ApproveRequestDto = z.infer<typeof ApproveRequestSchema>;
export type RejectRequestDto = z.infer<typeof RejectRequestSchema>;
export type RequestFiltersDto = z.infer<typeof RequestFiltersSchema>;
export type RequestType = z.infer<typeof RequestTypeSchema>;
export type RequestStatus = z.infer<typeof RequestStatusSchema>;
export type ExpiresMode = z.infer<typeof ExpiresModeSchema>;
