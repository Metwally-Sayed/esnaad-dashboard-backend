import { AuditLog, Prisma } from '@prisma/client';
import { AuditRepository } from '../repositories/audit.repository';
import {
  getPaginationParams,
  getPrismaSkipTake,
  createPaginatedResponse,
  PaginatedResponse,
} from '../../../common/utils/pagination';

export class AuditService {
  private auditRepo: AuditRepository;

  constructor() {
    this.auditRepo = new AuditRepository();
  }

  async getAuditLogs(query: any): Promise<PaginatedResponse<AuditLog>> {
    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: Prisma.AuditLogWhereInput = {};

    // Filter by action
    if (query.action) {
      where.action = query.action;
    }

    // Filter by entity type
    if (query.entityType) {
      where.entityType = query.entityType;
    }

    // Filter by date range
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      [sortBy as keyof Prisma.AuditLogOrderByWithRelationInput]: sortOrder,
    };

    const [logs, total] = await Promise.all([
      this.auditRepo.findAll({ skip, take, where, orderBy }),
      this.auditRepo.count(where),
    ]);

    return createPaginatedResponse(logs, page, limit, total);
  }

  async getAuditLogsByEntity(
    entityType: string,
    entityId: string,
    query: any
  ): Promise<PaginatedResponse<AuditLog>> {
    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    // For unit entities, include both unit-specific logs AND snagging logs for that unit
    const where: Prisma.AuditLogWhereInput =
      entityType === 'unit'
        ? {
            OR: [
              { entityType: 'unit', entityId },  // Direct unit operations
              { unitId: entityId }  // Snagging operations for this unit
            ]
          }
        : {
            entityType,
            entityId,
          };

    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      [sortBy as keyof Prisma.AuditLogOrderByWithRelationInput]: sortOrder,
    };

    const [logs, total] = await Promise.all([
      this.auditRepo.findAll({ skip, take, where, orderBy }),
      this.auditRepo.count(where),
    ]);

    return createPaginatedResponse(logs, page, limit, total);
  }

  async getAuditLogsByActor(
    actorId: string,
    query: any
  ): Promise<PaginatedResponse<AuditLog>> {
    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: Prisma.AuditLogWhereInput = {
      actorId,
    };

    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [logs, total] = await Promise.all([
      this.auditRepo.findAll({ skip, take, where, orderBy }),
      this.auditRepo.count(where),
    ]);

    return createPaginatedResponse(logs, page, limit, total);
  }
}
