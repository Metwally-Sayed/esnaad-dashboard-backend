import { z } from 'zod';
import { Role } from '@prisma/client';

// Enum schemas
export const HandoverStatusSchema = z.enum([
  'DRAFT',
  'SENT_TO_OWNER',
  'OWNER_CONFIRMED',
  'CHANGES_REQUESTED',
  'ADMIN_CONFIRMED',
  'COMPLETED',
  'CANCELLED'
]);

export const HandoverItemStatusSchema = z.enum(['OK', 'NOT_OK', 'NA']);

// Handover item schemas
export const CreateHandoverItemSchema = z.object({
  category: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  expectedValue: z.string().optional(),
  actualValue: z.string().optional(),
  status: HandoverItemStatusSchema.default('NA'),
  notes: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0)
});

export const UpdateHandoverItemSchema = CreateHandoverItemSchema.partial();

// Handover attachment schemas
export const CreateHandoverAttachmentSchema = z.object({
  itemId: z.string().cuid().optional(),
  url: z.string().url(),
  key: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  caption: z.string().max(500).optional()
});

// Main handover schemas
export const CreateHandoverSchema = z.object({
  unitId: z.string().cuid(),
  ownerId: z.string().cuid(),
  scheduledAt: z.string().datetime().optional(),
  handoverAt: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
  items: z.array(CreateHandoverItemSchema).optional(),
  attachments: z.array(CreateHandoverAttachmentSchema).optional()
});

export const UpdateHandoverSchema = z.object({
  scheduledAt: z.string().datetime().optional().nullable(),
  handoverAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional(),
  internalNotes: z.string().max(5000).optional(),
  items: z.array(CreateHandoverItemSchema).optional(),
  attachments: z.array(CreateHandoverAttachmentSchema).optional()
});

// Message schemas
export const CreateHandoverMessageSchema = z.object({
  body: z.string().min(1).max(5000)
});

// Action schemas
export const SendToOwnerSchema = z.object({
  message: z.string().max(1000).optional()
});

export const OwnerConfirmSchema = z.object({
  acknowledgement: z.string().max(1000).optional(),
  itemUpdates: z.array(z.object({
    id: z.string().cuid(),
    status: HandoverItemStatusSchema,
    actualValue: z.string().optional(),
    notes: z.string().optional()
  })).optional()
});

export const RequestChangesSchema = z.object({
  message: z.string().min(1).max(5000)
});

export const AdminConfirmSchema = z.object({
  finalNotes: z.string().max(1000).optional()
});

export const CancelHandoverSchema = z.object({
  reason: z.string().min(1).max(1000)
});

export const UpdateItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().cuid().optional(), // Optional for new items
    category: z.string().min(1).max(50),
    label: z.string().min(1).max(200),
    expectedValue: z.string().optional(),
    actualValue: z.string().optional(),
    status: HandoverItemStatusSchema.default('NA'),
    notes: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0)
  }))
});

// Filter schemas
export const HandoverFiltersSchema = z.object({
  status: HandoverStatusSchema.optional(),
  unitId: z.string().cuid().optional(),
  ownerId: z.string().cuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.enum(['createdAt', 'updatedAt', 'handoverAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const MessageFiltersSchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

// Type exports
export type CreateHandoverDto = z.infer<typeof CreateHandoverSchema>;
export type UpdateHandoverDto = z.infer<typeof UpdateHandoverSchema>;
export type CreateHandoverMessageDto = z.infer<typeof CreateHandoverMessageSchema>;
export type HandoverFiltersDto = z.infer<typeof HandoverFiltersSchema>;
export type MessageFiltersDto = z.infer<typeof MessageFiltersSchema>;
export type HandoverStatus = z.infer<typeof HandoverStatusSchema>;
export type HandoverItemStatus = z.infer<typeof HandoverItemStatusSchema>;