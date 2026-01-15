import { z } from 'zod';

// Create snagging schema (ADMIN ONLY)
// Accepts images at root level or nested in items
export const createSnaggingSchema = z.object({
  body: z.object({
    unitId: z.string().cuid('Invalid unit ID'),
    ownerId: z.string().cuid('Invalid owner ID'),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    notes: z.string().max(5000).optional(), // Admin internal notes
    // Support both formats:
    // 1. Root-level images (simpler format)
    images: z.array(z.object({
      imageUrl: z.string().url('Invalid image URL'),
      publicId: z.string().min(1).optional(), // Optional - will generate if not provided
      caption: z.string().max(200).optional()
    })).optional(),
    // 2. Items with nested images (structured format)
    items: z.array(z.object({
      category: z.string().min(1).max(100).optional(),
      label: z.string().min(1).max(500).optional(),
      location: z.string().min(1).max(200).optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      notes: z.string().max(1000).optional(),
      images: z.array(z.object({
        imageUrl: z.string().url('Invalid image URL'),
        publicId: z.string().min(1),
        caption: z.string().max(200).optional()
      })).max(5, 'Maximum 5 images per item').optional()
    })).max(50, 'Maximum 50 items allowed').optional()
  })
});

// Update snagging schema (ADMIN ONLY, DRAFT status only)
export const updateSnaggingSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid snagging ID')
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    notes: z.string().max(5000).optional(),
    items: z.array(z.object({
      id: z.string().cuid().optional(), // For existing items
      category: z.string().min(1).max(100),
      label: z.string().min(1).max(500),
      location: z.string().min(1).max(200),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      notes: z.string().max(1000).optional(),
      images: z.array(z.object({
        imageUrl: z.string().url('Invalid image URL'),
        publicId: z.string().min(1),
        caption: z.string().max(200).optional()
      })).max(5)
    })).optional()
  })
});

// Send to owner schema (ADMIN ONLY)
export const sendToOwnerSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid snagging ID')
  })
});

// Schedule appointment schema (OWNER ONLY, status must be SENT_TO_OWNER)
export const scheduleAppointmentSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid snagging ID')
  }),
  body: z.object({
    scheduledAt: z.string().datetime().refine(
      (date) => new Date(date) > new Date(),
      'Appointment must be in the future'
    ),
    scheduledNote: z.string().max(500).optional()
  })
});

// Accept snagging schema (OWNER ONLY) - NO PAYLOAD
export const acceptSnaggingSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid snagging ID')
  })
});

// Cancel snagging schema (ADMIN ONLY)
export const cancelSnaggingSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid snagging ID')
  })
});

// List snaggings query schema (ADMIN ONLY)
export const listSnaggingsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().positive()).optional(),
    limit: z.string().transform(Number).pipe(z.number().positive().max(100)).optional(),
    unitId: z.string().cuid().optional(),
    ownerId: z.string().cuid().optional(),
    status: z.enum(['DRAFT', 'SENT_TO_OWNER', 'ACCEPTED', 'CANCELLED']).optional()
  })
});

// Get snagging by ID schema
export const getSnaggingByIdSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid snagging ID')
  })
});

// Get snaggings by unit ID schema (for widget)
export const getSnaggingsByUnitIdSchema = z.object({
  params: z.object({
    unitId: z.string().cuid('Invalid unit ID')
  })
});

// Type exports
export type CreateSnaggingDto = z.infer<typeof createSnaggingSchema>['body'];
export type UpdateSnaggingDto = z.infer<typeof updateSnaggingSchema>['body'];
export type ScheduleAppointmentDto = z.infer<typeof scheduleAppointmentSchema>['body'];
export type SnaggingFiltersDto = z.infer<typeof listSnaggingsSchema>['query'];
