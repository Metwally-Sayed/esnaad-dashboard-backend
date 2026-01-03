import { z } from 'zod';

export const getUnitsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    search: z.string().optional(),
    ownerId: z.string().optional(),
    hasOwner: z.enum(['true', 'false']).optional(),
  }),
});

export const getUnitByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createUnitSchema = z.object({
  body: z.object({
    unitNumber: z.string().min(1),
    unitType: z.enum(['Apartment', 'Villa', 'Office', 'Other']).optional(),
    buildingName: z.string().optional(),
    address: z.string().optional(),
    floor: z.number().int().optional(),
    area: z.number().positive().optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    amenities: z.string().optional(),
    description: z.string().optional(),
    imageUrls: z.array(z.string().url()).optional(),
    documentUrls: z.array(z.string().url()).optional(),
    projectId: z.string().optional(),
    ownerId: z.string().optional(),
  }),
});

export const updateUnitSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    unitNumber: z.string().optional(),
    unitType: z.enum(['Apartment', 'Villa', 'Office', 'Other']).optional(),
    buildingName: z.string().optional(),
    address: z.string().optional(),
    floor: z.number().int().optional(),
    area: z.number().positive().optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    amenities: z.string().optional(),
    description: z.string().optional(),
    imageUrls: z.array(z.string().url()).optional(),
    documentUrls: z.array(z.string().url()).optional(),
    projectId: z.string().optional(),
    ownerId: z.string().optional(),
  }),
});

export const assignOwnerSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    ownerId: z.string().min(1),
  }),
});

export const deleteUnitSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export type GetUnitsQueryDto = z.infer<typeof getUnitsQuerySchema>['query'];
export type CreateUnitDto = z.infer<typeof createUnitSchema>['body'];
export type UpdateUnitDto = z.infer<typeof updateUnitSchema>['body'];
export type AssignOwnerDto = z.infer<typeof assignOwnerSchema>['body'];
