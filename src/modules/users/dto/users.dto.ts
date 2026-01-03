import { z } from 'zod';
import { Role } from '@prisma/client';

export const getUsersQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    role: z.nativeEnum(Role).optional(),
    search: z.string().optional(), // Search by email or name
    isActive: z.string().optional(),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(10).max(20).optional(),
    address: z.string().min(5).max(500).optional(),
    nationalId: z.string().min(5).max(20).optional(),
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export type GetUsersQueryDto = z.infer<typeof getUsersQuerySchema>['query'];
export type UpdateUserDto = z.infer<typeof updateUserSchema>['body'];
