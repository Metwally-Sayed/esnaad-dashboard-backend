import { z } from 'zod';

// Create message schema
export const createSnaggingMessageSchema = z.object({
  params: z.object({
    snaggingId: z.string().cuid()
  }),
  body: z.object({
    bodyTitle: z.string().min(1).max(200).optional(),
    bodyText: z.string().min(1).max(5000),
    attachments: z.array(z.object({
      url: z.string().url(),
      fileName: z.string(),
      mimeType: z.string().regex(/^image\/(jpeg|jpg|png|gif|webp)$/i, 'Only image files are allowed'),
      sizeBytes: z.number().positive().max(10 * 1024 * 1024) // 10MB max
    })).optional().default([])
  })
});

// Update message schema
export const updateSnaggingMessageSchema = z.object({
  params: z.object({
    snaggingId: z.string().cuid(),
    messageId: z.string().cuid()
  }),
  body: z.object({
    bodyTitle: z.string().min(1).max(200).optional(),
    bodyText: z.string().min(1).max(5000).optional()
  })
});

// List messages with cursor pagination schema
export const listSnaggingMessagesSchema = z.object({
  params: z.object({
    snaggingId: z.string().cuid()
  }),
  query: z.object({
    cursor: z.string().optional(), // Format: "timestamp_id"
    limit: z.string().transform(Number).pipe(z.number().positive().max(50)).optional(),
    direction: z.enum(['forward', 'backward']).optional().default('forward')
  })
});

// Delete message schema
export const deleteSnaggingMessageSchema = z.object({
  params: z.object({
    snaggingId: z.string().cuid(),
    messageId: z.string().cuid()
  })
});

export type CreateSnaggingMessageDto = z.infer<typeof createSnaggingMessageSchema>['body'];
export type UpdateSnaggingMessageDto = z.infer<typeof updateSnaggingMessageSchema>['body'];
export type ListMessagesQueryDto = z.infer<typeof listSnaggingMessagesSchema>['query'];