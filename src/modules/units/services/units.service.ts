import { Unit, Role, Prisma, AuditAction } from '@prisma/client';
import { UnitsRepository } from '../repositories/units.repository';
import { NotFoundError, ForbiddenError, ConflictError } from '../../../common/errors';
import {
  getPaginationParams,
  getPrismaSkipTake,
  createPaginatedResponse,
  PaginatedResponse,
} from '../../../common/utils/pagination';
import { GetUnitsQueryDto, CreateUnitDto, UpdateUnitDto } from '../dto/units.dto';
import { prisma } from '../../../config/database';

export class UnitsService {
  private unitsRepo: UnitsRepository;

  constructor() {
    this.unitsRepo = new UnitsRepository();
  }

  async getUnits(
    query: GetUnitsQueryDto,
    requestingUser: { id: string; role: Role }
  ): Promise<PaginatedResponse<Unit>> {
    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    // Build where clause
    const where: Prisma.UnitWhereInput = {};

    // Owners can only see their own units
    if (requestingUser.role === Role.OWNER) {
      where.ownerId = requestingUser.id;
    }

    // Owner filter (admin only)
    if (query.ownerId && requestingUser.role === Role.ADMIN) {
      where.ownerId = query.ownerId;
    }

    // Has owner filter
    if (query.hasOwner !== undefined) {
      where.ownerId = query.hasOwner === 'true' ? { not: null } : null;
    }

    // Search by unit number or building name
    if (query.search) {
      where.OR = [
        { unitNumber: { contains: query.search, mode: 'insensitive' } },
        { buildingName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.UnitOrderByWithRelationInput = {
      [sortBy as keyof Prisma.UnitOrderByWithRelationInput]: sortOrder,
    };

    const [units, total] = await Promise.all([
      this.unitsRepo.findAll({ skip, take, where, orderBy }),
      this.unitsRepo.count(where),
    ]);

    return createPaginatedResponse(units, page, limit, total);
  }

  async getUnitById(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<Unit> {
    const unit = await this.unitsRepo.findById(id);
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    // Owners can only view their own units
    if (requestingUser.role === Role.OWNER && unit.ownerId !== requestingUser.id) {
      throw new ForbiddenError('You can only view your own units');
    }

    return unit;
  }

  async createUnit(
    data: CreateUnitDto,
    requestingUser: { id: string; role: Role }
  ): Promise<Unit> {
    // Check for duplicate unit number
    const existingUnit = await this.unitsRepo.findByUnitNumber(data.unitNumber);
    if (existingUnit) {
      throw new ConflictError('Unit number already exists');
    }

    const unit = await this.unitsRepo.create(data);

    await this.createAuditLog({
      action: AuditAction.UNIT_CREATED,
      entityType: 'unit',
      entityId: unit.id,
      actorId: requestingUser.id,
      unitId: unit.id,
      changes: { created: data },
    });

    return unit;
  }

  async updateUnit(
    id: string,
    data: UpdateUnitDto,
    requestingUser: { id: string; role: Role }
  ): Promise<Unit> {
    const existingUnit = await this.unitsRepo.findById(id);
    if (!existingUnit) {
      throw new NotFoundError('Unit not found');
    }

    // Check for duplicate unit number if changing
    if (data.unitNumber && data.unitNumber !== existingUnit.unitNumber) {
      const duplicate = await this.unitsRepo.findByUnitNumber(data.unitNumber);
      if (duplicate) {
        throw new ConflictError('Unit number already exists');
      }
    }

    const updatedUnit = await this.unitsRepo.update(id, data);

    await this.createAuditLog({
      action: AuditAction.UNIT_UPDATED,
      entityType: 'unit',
      entityId: id,
      actorId: requestingUser.id,
      unitId: id,
      changes: { old: existingUnit, new: data },
    });

    return updatedUnit;
  }

  async assignOwner(
    unitId: string,
    ownerId: string,
    requestingUser: { id: string; role: Role }
  ): Promise<Unit> {
    const unit = await this.unitsRepo.findById(unitId);
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    const oldOwnerId = unit.ownerId;
    const updatedUnit = await this.unitsRepo.assignOwner(unitId, ownerId);

    await this.createAuditLog({
      action: oldOwnerId ? AuditAction.OWNER_CHANGED : AuditAction.UNIT_ASSIGNED,
      entityType: 'unit',
      entityId: unitId,
      actorId: requestingUser.id,
      unitId,
      changes: {
        old: { ownerId: oldOwnerId },
        new: { ownerId },
      },
    });

    return updatedUnit;
  }

  async unassignOwner(
    unitId: string,
    requestingUser: { id: string; role: Role }
  ): Promise<Unit> {
    const unit = await this.unitsRepo.findById(unitId);
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    if (!unit.ownerId) {
      throw new ForbiddenError('Unit has no owner assigned');
    }

    const oldOwnerId = unit.ownerId;
    const updatedUnit = await this.unitsRepo.unassignOwner(unitId);

    await this.createAuditLog({
      action: AuditAction.UNIT_UNASSIGNED,
      entityType: 'unit',
      entityId: unitId,
      actorId: requestingUser.id,
      unitId,
      changes: {
        old: { ownerId: oldOwnerId },
        new: { ownerId: null },
      },
    });

    return updatedUnit;
  }

  async deleteUnit(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<void> {
    const unit = await this.unitsRepo.findById(id);
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    await this.unitsRepo.delete(id);

    await this.createAuditLog({
      action: AuditAction.UNIT_DELETED,
      entityType: 'unit',
      entityId: id,
      actorId: requestingUser.id,
      changes: { deleted: unit },
    });
  }

  // NEW: Get handover status and PDF for owner
  async getUnitHandover(
    unitId: string,
    requestingUser: { id: string; role: Role }
  ): Promise<any> {
    // Verify unit exists
    const unit = await this.unitsRepo.findById(unitId);
    if (!unit) {
      throw new NotFoundError('Unit not found');
    }

    // Owners can only access their own units
    if (requestingUser.role === Role.OWNER && unit.ownerId !== requestingUser.id) {
      throw new ForbiddenError('You can only access handover information for your own units');
    }

    // Get handover for this unit
    const handover = await prisma.handover.findFirst({
      where: {
        unitId,
        status: {
          not: 'CANCELLED' // Exclude cancelled handovers
        }
      },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        handoverAt: true,
        ownerAcceptedAt: true,
        pdfUrl: true,
        adminSignature: true,
        ownerSignature: true,
        notes: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!handover) {
      return {
        exists: false,
        message: 'No handover found for this unit'
      };
    }

    return {
      exists: true,
      handover
    };
  }

  private async createAuditLog(data: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    actorId: string;
    unitId?: string;
    changes?: any;
    metadata?: any;
  }) {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        actorId: data.actorId,
        unitId: data.unitId,
        changes: data.changes,
        metadata: data.metadata,
      },
    });
  }
}
