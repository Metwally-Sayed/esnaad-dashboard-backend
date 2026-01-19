import { z } from 'zod';

// Enum schemas
export const RequestTypeSchema = z.enum(['GUEST_VISIT', 'WORK_PERMISSION', 'OWNERSHIP_TRANSFER', 'TENANT_REGISTRATION', 'UNIT_MODIFICATIONS']);

// Unit modification types
export const ModificationTypeSchema = z.enum([
  'RENOVATION',
  'REPAIR',
  'ADDITION',
  'REMOVAL',
  'ELECTRICAL',
  'PLUMBING',
  'HVAC',
  'STRUCTURAL',
  'COSMETIC',
  'OTHER'
]);
export const RequestStatusSchema = z.enum(['SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']);
export const ExpiresModeSchema = z.enum(['DATE', 'USES', 'UNLIMITED']);

// Create request schema
export const CreateRequestSchema = z.object({
  unitId: z.string().cuid().optional(),
  type: RequestTypeSchema,
  purpose: z.string().max(5000).optional(),

  // Visitor info (for GUEST_VISIT)
  visitorName: z.string().min(1).max(200).optional(),
  visitorPhone: z.string().max(50).optional(),

  // Work info (for WORK_PERMISSION)
  companyName: z.string().min(1).max(200).optional(),
  representativeName: z.string().max(200).optional(),

  // Ownership Transfer info (for OWNERSHIP_TRANSFER)
  transferUnitIds: z.array(z.string().cuid()).optional(),
  newOwnerId: z.string().cuid().optional(),
  newOwnerName: z.string().min(1).max(200).optional(),
  newOwnerEmail: z.string().email().optional(),
  newOwnerPhone: z.string().max(50).optional(),
  message: z.string().max(5000).optional(), // Message for ownership transfer requests

  // Tenant Registration info (for TENANT_REGISTRATION)
  tenantName: z.string().min(1).max(200).optional(),
  tenantEmail: z.string().email().optional(),
  tenantPhone: z.string().min(1).max(50).optional(),
  emiratesIdUrl: z.string().url().optional(),
  passportUrl: z.string().url().optional(),
  rentContractUrl: z.string().url().optional(),
  ijaryUrl: z.string().url().optional(),

  // Unit Modifications info (for UNIT_MODIFICATIONS)
  modificationType: ModificationTypeSchema.optional(),
  modificationTypeOther: z.string().min(1).max(200).optional(),
  modificationMessage: z.string().min(1).max(5000).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(1).max(50).optional(),

  // Schedule
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional()
}).refine((data) => {
  // Validate GUEST_VISIT requires visitorName and unitId
  if (data.type === 'GUEST_VISIT' && (!data.visitorName || !data.unitId)) {
    return false;
  }
  // Validate WORK_PERMISSION requires companyName and unitId
  if (data.type === 'WORK_PERMISSION' && (!data.companyName || !data.unitId)) {
    return false;
  }
  // Validate OWNERSHIP_TRANSFER requires transferUnitIds and (newOwnerId OR newOwnerName)
  if (data.type === 'OWNERSHIP_TRANSFER') {
    if (!data.transferUnitIds || data.transferUnitIds.length === 0) {
      return false;
    }
    if (!data.newOwnerId && !data.newOwnerName) {
      return false;
    }
  }
  // Validate TENANT_REGISTRATION requires unitId and tenant info with document URLs
  if (data.type === 'TENANT_REGISTRATION') {
    if (!data.unitId || !data.tenantName || !data.tenantEmail || !data.tenantPhone || !data.emiratesIdUrl || !data.passportUrl || !data.rentContractUrl || !data.ijaryUrl) {
      return false;
    }
  }
  // Validate UNIT_MODIFICATIONS requires unitId, modificationType, modificationMessage, contactEmail, contactPhone
  if (data.type === 'UNIT_MODIFICATIONS') {
    if (!data.unitId || !data.modificationType || !data.modificationMessage || !data.contactEmail || !data.contactPhone) {
      return false;
    }
    // If modificationType is OTHER, modificationTypeOther is required
    if (data.modificationType === 'OTHER' && !data.modificationTypeOther) {
      return false;
    }
  }
  return true;
}, {
  message: 'Guest visits require visitorName and unitId, work permissions require companyName and unitId, ownership transfers require transferUnitIds and new owner info, tenant registration requires unitId and all tenant fields, unit modifications require unitId, modificationType, modificationMessage, contactEmail and contactPhone'
});

// Approve request schema
export const ApproveRequestSchema = z.object({
  expiresMode: ExpiresModeSchema.optional(),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional()
}).refine((data) => {
  // Skip validation if no expiresMode (for OWNERSHIP_TRANSFER)
  if (!data.expiresMode) {
    return true;
  }
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

// Message schemas
export const CreateMessageSchema = z.object({
  body: z.string().min(1).max(5000)
});

export const MessageFiltersSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  cursor: z.string().cuid().optional() // For cursor-based pagination
});

// Type exports
export type CreateRequestDto = z.infer<typeof CreateRequestSchema>;
export type ApproveRequestDto = z.infer<typeof ApproveRequestSchema>;
export type RejectRequestDto = z.infer<typeof RejectRequestSchema>;
export type RequestFiltersDto = z.infer<typeof RequestFiltersSchema>;
export type RequestType = z.infer<typeof RequestTypeSchema>;
export type RequestStatus = z.infer<typeof RequestStatusSchema>;
export type ExpiresMode = z.infer<typeof ExpiresModeSchema>;
export type ModificationType = z.infer<typeof ModificationTypeSchema>;
export type CreateMessageDto = z.infer<typeof CreateMessageSchema>;
export type MessageFiltersDto = z.infer<typeof MessageFiltersSchema>;
