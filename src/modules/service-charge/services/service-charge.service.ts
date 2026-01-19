import { Role, AuditAction, Prisma } from '@prisma/client';
import { ServiceChargeRepository } from '../repositories/service-charge.repository';
import { NotFoundError, ForbiddenError, ConflictError } from '../../../common/errors';
import {
  getPaginationParams,
  getPrismaSkipTake,
  createPaginatedResponse,
  PaginatedResponse,
} from '../../../common/utils/pagination';
import {
  GetAllProjectServiceChargesQueryDto,
  CreateProjectServiceChargeDto,
  UpdateProjectServiceChargeDto,
  GetUnitServiceChargesQueryDto,
  OverrideUnitServiceChargeDto,
  GetOwnerServiceChargesQueryDto,
} from '../dto/service-charge.dto';
import { prisma } from '../../../config/database';
import { Decimal } from '@prisma/client/runtime/library';

export class ServiceChargeService {
  private repo: ServiceChargeRepository;

  constructor() {
    this.repo = new ServiceChargeRepository();
  }

  /**
   * Get all project service charges (Admin only)
   */
  async getAllProjectServiceCharges(
    query: GetAllProjectServiceChargesQueryDto,
    requestingUser: { id: string; role: Role }
  ): Promise<PaginatedResponse<any>> {
    // Only admins can view all service charges
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can view all service charges');
    }

    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: Prisma.ProjectServiceChargeWhereInput = {};

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.year) {
      where.year = parseInt(query.year);
    }

    if (query.periodType) {
      where.periodType = query.periodType;
    }

    const orderBy: Prisma.ProjectServiceChargeOrderByWithRelationInput = {
      [sortBy as keyof Prisma.ProjectServiceChargeOrderByWithRelationInput]: sortOrder,
    };

    const [serviceCharges, total] = await Promise.all([
      this.repo.findAllProjectServiceCharges({ skip, take, where, orderBy }),
      this.repo.countProjectServiceCharges(where),
    ]);

    return createPaginatedResponse(serviceCharges, page, limit, total);
  }

  /**
   * Get project service charge by ID (Admin only)
   */
  async getProjectServiceChargeById(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<any> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can view service charge details');
    }

    const serviceCharge = await this.repo.findProjectServiceChargeById(id);
    if (!serviceCharge) {
      throw new NotFoundError('Service charge not found');
    }

    return serviceCharge;
  }

  /**
   * Create project service charge and calculate unit charges
   */
  async createProjectServiceCharge(
    data: CreateProjectServiceChargeDto,
    requestingUser: { id: string; role: Role }
  ): Promise<any> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can create service charges');
    }

    // Check for duplicate (project + year + quarter combination)
    const duplicate = await this.repo.checkDuplicate(
      data.projectId,
      data.year,
      data.periodType === 'QUARTERLY' ? data.quarter! : null
    );

    if (duplicate) {
      throw new ConflictError(
        `Service charge already exists for this project, year${
          data.periodType === 'QUARTERLY' ? `, and quarter ${data.quarter}` : ''
        }`
      );
    }

    // Create the project service charge
    const serviceCharge = await this.repo.createProjectServiceCharge({
      year: data.year,
      quarter: data.periodType === 'QUARTERLY' ? data.quarter! : null,
      periodType: data.periodType,
      percentage: new Decimal(data.percentage),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      project: {
        connect: { id: data.projectId },
      },
      createdBy: {
        connect: { id: requestingUser.id },
      },
    });

    // Get units with prices for this project
    const units = await this.repo.getUnitsWithPricesForProject(data.projectId);

    // Debug logging
    console.log(`[Service Charge Debug] Project ID: ${data.projectId}`);
    console.log(`[Service Charge Debug] Found ${units.length} units with prices`);
    if (units.length > 0) {
      console.log(`[Service Charge Debug] Sample unit:`, {
        id: units[0].id,
        unitNumber: units[0].unitNumber,
        price: units[0].price?.toString(),
        projectId: data.projectId
      });
    } else {
      console.log(`[Service Charge Debug] No units found. Checking all units in project...`);
      const allUnitsInProject = await prisma.unit.findMany({
        where: { projectId: data.projectId },
        select: { id: true, unitNumber: true, price: true, projectId: true }
      });
      console.log(`[Service Charge Debug] Total units in project: ${allUnitsInProject.length}`);
      console.log(`[Service Charge Debug] Units without prices: ${allUnitsInProject.filter(u => !u.price).length}`);
      if (allUnitsInProject.length > 0) {
        console.log(`[Service Charge Debug] Sample unit from project:`, allUnitsInProject[0]);
      }
    }

    // Calculate and create unit service charges
    const unitChargesData = units.map((unit) => {
      const unitPrice = new Decimal(unit.price.toString());
      const percentage = new Decimal(data.percentage);
      const calculatedAmount = unitPrice.mul(percentage).div(100);

      return {
        unitId: unit.id,
        projectServiceChargeId: serviceCharge.id,
        amount: calculatedAmount,
      };
    });

    if (unitChargesData.length > 0) {
      await this.repo.bulkCreateUnitServiceCharges(unitChargesData);
      console.log(`[Service Charge Debug] Created ${unitChargesData.length} unit charges`);
    } else {
      console.log(`[Service Charge Debug] No unit charges created - no units with prices found`);
    }

    // Audit log
    await this.createAuditLog({
      action: AuditAction.SERVICE_CHARGE_CREATED,
      entityType: 'project_service_charge',
      entityId: serviceCharge.id,
      actorId: requestingUser.id,
      changes: { created: data, unitsAffected: units.length },
    });

    return serviceCharge;
  }

  /**
   * Update project service charge
   */
  async updateProjectServiceCharge(
    id: string,
    data: UpdateProjectServiceChargeDto,
    requestingUser: { id: string; role: Role }
  ): Promise<any> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can update service charges');
    }

    const existing = await this.repo.findProjectServiceChargeById(id);
    if (!existing) {
      throw new NotFoundError('Service charge not found');
    }

    const updateData: Prisma.ProjectServiceChargeUpdateInput = {};

    if (data.percentage !== undefined) {
      updateData.percentage = new Decimal(data.percentage);
    }

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    const updated = await this.repo.updateProjectServiceCharge(id, updateData);

    // Audit log
    await this.createAuditLog({
      action: AuditAction.SERVICE_CHARGE_UPDATED,
      entityType: 'project_service_charge',
      entityId: id,
      actorId: requestingUser.id,
      changes: { old: existing, new: data },
    });

    return updated;
  }

  /**
   * Delete project service charge (cascades to unit charges)
   */
  async deleteProjectServiceCharge(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<void> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can delete service charges');
    }

    const existing = await this.repo.findProjectServiceChargeById(id);
    if (!existing) {
      throw new NotFoundError('Service charge not found');
    }

    await this.repo.deleteProjectServiceCharge(id);

    // Audit log
    await this.createAuditLog({
      action: AuditAction.SERVICE_CHARGE_DELETED,
      entityType: 'project_service_charge',
      entityId: id,
      actorId: requestingUser.id,
      changes: { deleted: existing },
    });
  }

  /**
   * Get unit service charges for a project service charge (Admin only)
   */
  async getUnitServiceCharges(
    projectServiceChargeId: string,
    query: GetUnitServiceChargesQueryDto,
    requestingUser: { id: string; role: Role }
  ): Promise<PaginatedResponse<any>> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can view unit service charges');
    }

    // Verify project service charge exists
    const serviceCharge = await this.repo.findProjectServiceChargeById(projectServiceChargeId);
    if (!serviceCharge) {
      throw new NotFoundError('Project service charge not found');
    }

    const { page, limit } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: Prisma.UnitServiceChargeWhereInput = {
      projectServiceChargeId,
    };

    const [unitCharges, total] = await Promise.all([
      this.repo.findUnitServiceCharges({
        skip,
        take,
        where,
        orderBy: { unit: { unitNumber: 'asc' } },
      }),
      this.repo.countUnitServiceCharges(where),
    ]);

    return createPaginatedResponse(unitCharges, page, limit, total);
  }

  /**
   * Override unit service charge amount (Admin only)
   */
  async overrideUnitServiceCharge(
    id: string,
    data: OverrideUnitServiceChargeDto,
    requestingUser: { id: string; role: Role }
  ): Promise<any> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can override service charges');
    }

    const existing = await this.repo.findUnitServiceChargeById(id);
    if (!existing) {
      throw new NotFoundError('Unit service charge not found');
    }

    const updated = await this.repo.updateUnitServiceCharge(id, {
      overriddenAmount: new Decimal(data.overriddenAmount),
      isOverridden: true,
      overriddenAt: new Date(),
      overriddenBy: {
        connect: { id: requestingUser.id },
      },
    });

    // Audit log
    await this.createAuditLog({
      action: AuditAction.UNIT_SERVICE_CHARGE_OVERRIDDEN,
      entityType: 'unit_service_charge',
      entityId: id,
      actorId: requestingUser.id,
      unitId: existing.unitId,
      changes: {
        old: { amount: existing.amount, isOverridden: existing.isOverridden },
        new: { overriddenAmount: data.overriddenAmount, isOverridden: true },
      },
    });

    return updated;
  }

  /**
   * Get owner service charges (for owned units)
   */
  async getOwnerServiceCharges(
    query: GetOwnerServiceChargesQueryDto,
    requestingUser: { id: string; role: Role }
  ): Promise<PaginatedResponse<any>> {
    if (requestingUser.role !== Role.OWNER) {
      throw new ForbiddenError('This endpoint is only for owners');
    }

    const { page, limit } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    const where: Prisma.UnitServiceChargeWhereInput = {
      unit: {
        ownerId: requestingUser.id,
      },
    };

    const projectServiceChargeFilter: any = {};

    if (query.year) {
      projectServiceChargeFilter.year = parseInt(query.year);
    }

    if (query.periodType) {
      projectServiceChargeFilter.periodType = query.periodType;
    }

    if (Object.keys(projectServiceChargeFilter).length > 0) {
      where.projectServiceCharge = projectServiceChargeFilter;
    }

    const [serviceCharges, total] = await Promise.all([
      this.repo.findUnitServiceCharges({
        skip,
        take,
        where,
        orderBy: { projectServiceCharge: { year: 'desc' } },
      }),
      this.repo.countUnitServiceCharges(where),
    ]);

    return createPaginatedResponse(serviceCharges, page, limit, total);
  }

  /**
   * Get download URL for PDF statement (Owner can download their own)
   */
  async getDownloadUrl(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<{ url: string }> {
    const unitChargeRaw = await this.repo.findUnitServiceChargeById(id);
    if (!unitChargeRaw) {
      throw new NotFoundError('Service charge not found');
    }

    // Type assertion for included relations
    const unitCharge = unitChargeRaw as any;

    // Check access: Admin can access all, Owner can only access their own
    if (requestingUser.role === Role.OWNER) {
      if (unitCharge.unit.owner?.id !== requestingUser.id) {
        throw new ForbiddenError('You can only download statements for your own units');
      }
    }

    if (!unitCharge.pdfUrl) {
      throw new NotFoundError('PDF statement has not been generated yet');
    }

    return { url: unitCharge.pdfUrl };
  }

  /**
   * Create audit log
   */
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
