import { z } from 'zod';

// Get notifications with pagination
export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    unreadOnly: z.coerce.boolean().optional(),
  }),
});

// Mark as read
export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

// Mark all as read
export const markAllAsReadSchema = z.object({
  body: z.object({
    notificationIds: z.array(z.string()).optional(),
  }),
});

export type GetNotificationsDto = z.infer<typeof getNotificationsSchema>['query'];
export type MarkAsReadDto = z.infer<typeof markAsReadSchema>['params'];
export type MarkAllAsReadDto = z.infer<typeof markAllAsReadSchema>['body'];
