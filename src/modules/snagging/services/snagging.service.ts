import { SnaggingStatus, SnaggingPriority, AuditAction, Role } from '@prisma/client';
import { SnaggingRepository } from '../repositories/snagging.repository';
import { AppError } from '../../../common/errors/AppError';
import { prisma } from '../../../config/database';

// Type for authenticated user from JWT
type AuthUser = { id: string; email: string; role: Role };

export class SnaggingService {
  private snaggingRepo = new SnaggingRepository();

  // Create a new snagging thread
  async createSnagging(
    user: AuthUser,
    data: {
      unitId: string;
      title: string;
      description: string;
      priority?: SnaggingPriority;
      attachments?: Array<{
        url: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      }>;
    }
  ) {
    // Check if user has access to the unit
    const unit = await prisma.unit.findUnique({
      where: { id: data.unitId }
    });

    if (!unit) {
      throw new AppError('Unit not found', 404);
    }

    // OWNER can create snagging for units they own
    // ADMIN can create for any unit
    if (user.role === 'OWNER' && unit.ownerId !== user.id) {
      // Allow owners to create snaggings for units they don't own (as per requirements)
      // This enables reporting issues for any unit they have access to
    }

    const { attachments, ...snaggingData } = data;

    // Create snagging and initial message in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the snagging thread
      const snagging = await tx.snagging.create({
        data: {
          ...snaggingData,
          createdByUserId: user.id
        },
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              buildingName: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      // Create initial message with attachments
      if (attachments && attachments.length > 0) {
        await tx.snaggingMessage.create({
          data: {
            snaggingId: snagging.id,
            authorUserId: user.id,
            authorRole: user.role,
            bodyTitle: 'Initial Report',
            bodyText: data.description,
            attachments: {
              create: attachments
            }
          }
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: AuditAction.SNAGGING_CREATED,
          entityType: 'snagging',
          entityId: snagging.id,
          actorId: user.id,
          unitId: unit.id,
          changes: {
            created: {
              title: snagging.title,
              status: snagging.status,
              priority: snagging.priority
            }
          }
        }
      });

      return snagging;
    });

    return result;
  }

  // Get all snaggings (admin only)
  async getAllSnaggings(
    user: AuthUser,
    params: {
      page?: number;
      limit?: number;
      status?: SnaggingStatus;
      priority?: SnaggingPriority;
      unitId?: string;
      createdByUserId?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      fromDate?: string;
      toDate?: string;
    }
  ) {
    if (user.role !== 'ADMIN') {
      throw new AppError('Only admins can view all snaggings', 403);
    }

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    // Handle search
    if (params.search) {
      const result = await this.snaggingRepo.search({
        skip,
        take: limit,
        search: params.search,
        status: params.status,
        priority: params.priority,
        unitId: params.unitId,
        createdByUserId: params.createdByUserId,
        fromDate: params.fromDate ? new Date(params.fromDate) : undefined,
        toDate: params.toDate ? new Date(params.toDate) : undefined
      });

      return {
        data: result.data,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page * limit < result.total,
          hasPrev: page > 1
        }
      };
    }

    // Build where clause
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.unitId) where.unitId = params.unitId;
    if (params.createdByUserId) where.createdByUserId = params.createdByUserId;

    if (params.fromDate || params.toDate) {
      where.createdAt = {};
      if (params.fromDate) where.createdAt.gte = new Date(params.fromDate);
      if (params.toDate) where.createdAt.lte = new Date(params.toDate);
    }

    // Build orderBy
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    const result = await this.snaggingRepo.findAll({
      skip,
      take: limit,
      where,
      orderBy
    });

    return {
      data: result.data,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext: page * limit < result.total,
        hasPrev: page > 1
      }
    };
  }

  // Get user's own snaggings
  async getMySnaggings(
    user: AuthUser,
    params: {
      page?: number;
      limit?: number;
      status?: SnaggingStatus;
      priority?: SnaggingPriority;
    }
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const result = await this.snaggingRepo.findByUser(user.id, {
      skip,
      take: limit,
      status: params.status,
      priority: params.priority
    });

    return {
      data: result.data,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext: page * limit < result.total,
        hasPrev: page > 1
      }
    };
  }

  // Get snaggings by unit
  async getSnaggingsByUnit(
    user: AuthUser,
    unitId: string,
    params: {
      page?: number;
      limit?: number;
      status?: SnaggingStatus;
      priority?: SnaggingPriority;
    }
  ) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId }
    });

    if (!unit) {
      throw new AppError('Unit not found', 404);
    }

    // Access control
    if (user.role === 'OWNER') {
      // Owner can see snaggings for units they own or snaggings they created
      const page = Number(params.page) || 1;
      const limit = Number(params.limit) || 20;
      const skip = (page - 1) * limit;

      const result = await this.snaggingRepo.findByUnit(unitId, {
        skip,
        take: limit,
        status: params.status,
        priority: params.priority,
        createdByUserId: unit.ownerId === user.id ? undefined : user.id
      });

      return {
        data: result.data,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page * limit < result.total,
          hasPrev: page > 1
        }
      };
    }

    // Admin can see all snaggings for the unit
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const result = await this.snaggingRepo.findByUnit(unitId, {
      skip,
      take: limit,
      status: params.status,
      priority: params.priority
    });

    return {
      data: result.data,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext: page * limit < result.total,
        hasPrev: page > 1
      }
    };
  }

  // Get snagging by ID
  async getSnaggingById(
    user: AuthUser,
    snaggingId: string,
    includeMessages = false,
    messageLimit = 10
  ) {
    const snagging = await this.snaggingRepo.findById(snaggingId, includeMessages, messageLimit);

    if (!snagging) {
      throw new AppError('Snagging not found', 404);
    }

    // Access control
    if (user.role === 'OWNER') {
      // Owner can view if they created it or own the unit
      if (snagging.createdByUserId !== user.id && snagging.unit.ownerId !== user.id) {
        throw new AppError('You do not have permission to view this snagging', 403);
      }
    }

    return snagging;
  }

  // Update snagging
  async updateSnagging(
    user: AuthUser,
    snaggingId: string,
    data: {
      title?: string;
      description?: string;
      status?: SnaggingStatus;
      priority?: SnaggingPriority;
    }
  ) {
    const snagging = await this.snaggingRepo.findById(snaggingId);

    if (!snagging) {
      throw new AppError('Snagging not found', 404);
    }

    // Authorization
    if (user.role === 'OWNER' && snagging.createdByUserId !== user.id) {
      throw new AppError('You can only edit your own snaggings', 403);
    }

    const oldStatus = snagging.status;
    const updated = await this.snaggingRepo.update(snaggingId, data);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: data.status && data.status !== oldStatus
          ? AuditAction.SNAGGING_STATUS_CHANGED
          : AuditAction.SNAGGING_UPDATED,
        entityType: 'snagging',
        entityId: snaggingId,
        actorId: user.id,
        unitId: snagging.unit.id,
        changes: {
          before: { title: snagging.title, description: snagging.description, status: oldStatus, priority: snagging.priority },
          after: data
        }
      }
    });

    return updated;
  }

  // Delete snagging (soft delete)
  async deleteSnagging(user: AuthUser, snaggingId: string) {
    const snagging = await this.snaggingRepo.findById(snaggingId);

    if (!snagging) {
      throw new AppError('Snagging not found', 404);
    }

    // Authorization
    if (user.role === 'OWNER' && snagging.createdByUserId !== user.id) {
      throw new AppError('You can only delete your own snaggings', 403);
    }

    await this.snaggingRepo.softDelete(snaggingId);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.SNAGGING_DELETED,
        entityType: 'snagging',
        entityId: snaggingId,
        actorId: user.id,
        unitId: snagging.unit.id
      }
    });

    return { message: 'Snagging deleted successfully' };
  }
}