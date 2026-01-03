import { z } from 'zod';

export const getProjectsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    status: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const getProjectByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    status: z.enum(['active', 'completed', 'on-hold']).optional(),
    imageUrl: z.string().url().optional(),
  }),
});

export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    status: z.enum(['active', 'completed', 'on-hold']).optional(),
    imageUrl: z.string().url().optional(),
  }),
});

export const deleteProjectSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export type GetProjectsQueryDto = z.infer<typeof getProjectsQuerySchema>['query'];
export type CreateProjectDto = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>['body'];
