import { z } from 'zod';

// Enums
export const ServiceChargePeriodTypeSchema = z.enum(['YEARLY', 'QUARTERLY']);
export type ServiceChargePeriodType = z.infer<typeof ServiceChargePeriodTypeSchema>;

// Get all project service charges (admin)
export const getAllProjectServiceChargesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    projectId: z.string().optional(),
    year: z.string().optional(),
    periodType: ServiceChargePeriodTypeSchema.optional(),
  }),
});

// Get project service charge by ID
export const getProjectServiceChargeByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

// Create project service charge
export const createProjectServiceChargeSchema = z.object({
  body: z.object({
    projectId: z.string().min(1, 'Project ID is required'),
    year: z.number().int().min(2020).max(2100),
    quarter: z.number().int().min(1).max(4).optional(),
    periodType: ServiceChargePeriodTypeSchema,
    percentage: z.number().positive().max(100, 'Percentage cannot exceed 100%'),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  }).refine((data) => {
    // If periodType is QUARTERLY, quarter is required
    if (data.periodType === 'QUARTERLY' && !data.quarter) {
      return false;
    }
    // If periodType is YEARLY, quarter should not be provided
    if (data.periodType === 'YEARLY' && data.quarter) {
      return false;
    }
    return true;
  }, {
    message: 'Quarter is required for QUARTERLY period type and should not be provided for YEARLY',
  }),
});

// Update project service charge
export const updateProjectServiceChargeSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    percentage: z.number().positive().max(100).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  }),
});

// Delete project service charge
export const deleteProjectServiceChargeSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

// Get unit service charges for a project service charge
export const getUnitServiceChargesSchema = z.object({
  params: z.object({
    id: z.string().min(1), // project service charge ID
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

// Override unit service charge
export const overrideUnitServiceChargeSchema = z.object({
  params: z.object({
    id: z.string().min(1), // unit service charge ID
  }),
  body: z.object({
    overriddenAmount: z.number().positive(),
  }),
});

// Generate PDF statement for unit service charge
export const generatePdfStatementSchema = z.object({
  params: z.object({
    id: z.string().min(1), // unit service charge ID
  }),
});

// Get owner service charges (for owned units)
export const getOwnerServiceChargesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    year: z.string().optional(),
    periodType: ServiceChargePeriodTypeSchema.optional(),
  }),
});

// Download PDF statement (owner)
export const downloadPdfStatementSchema = z.object({
  params: z.object({
    id: z.string().min(1), // unit service charge ID
  }),
});

// Type exports
export type GetAllProjectServiceChargesQueryDto = z.infer<typeof getAllProjectServiceChargesSchema>['query'];
export type CreateProjectServiceChargeDto = z.infer<typeof createProjectServiceChargeSchema>['body'];
export type UpdateProjectServiceChargeDto = z.infer<typeof updateProjectServiceChargeSchema>['body'];
export type GetUnitServiceChargesQueryDto = z.infer<typeof getUnitServiceChargesSchema>['query'];
export type OverrideUnitServiceChargeDto = z.infer<typeof overrideUnitServiceChargeSchema>['body'];
export type GetOwnerServiceChargesQueryDto = z.infer<typeof getOwnerServiceChargesSchema>['query'];
