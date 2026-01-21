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
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { NotificationRepository } from '@/modules/notifications/repositories/notification.repository';

export class ServiceChargeService {
  private repo: ServiceChargeRepository;
  private notificationService: NotificationService;

  constructor() {
    this.repo = new ServiceChargeRepository();
    const notificationRepo = new NotificationRepository();
    this.notificationService = new NotificationService(notificationRepo);
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

    // Determine if using percentage-based or per-unit charges
    const isPerUnitCharge = data.unitCharges && data.unitCharges.length > 0;
    let unitChargesData: Array<{ unitId: string; projectServiceChargeId: string; amount: Decimal }> = [];
    let totalAmount = new Decimal(0);

    if (isPerUnitCharge) {
      // Per-unit charge method: validate units belong to project
      const unitIds = data.unitCharges!.map((uc) => uc.unitId);
      const validCount = await this.repo.validateUnitsForProject(data.projectId, unitIds);

      if (validCount !== unitIds.length) {
        throw new ConflictError(
          `Some units do not belong to this project. Expected ${unitIds.length} but found ${validCount}`
        );
      }

      // Prepare unit charges data with explicit amounts
      unitChargesData = data.unitCharges!.map((uc) => ({
        unitId: uc.unitId,
        projectServiceChargeId: '', // Will be filled after creating service charge
        amount: new Decimal(uc.amount),
      }));

      // Calculate total for audit log
      totalAmount = unitChargesData.reduce(
        (sum, uc) => sum.add(uc.amount),
        new Decimal(0)
      );
    }

    // Create the project service charge
    const serviceCharge = await this.repo.createProjectServiceCharge({
      year: data.year,
      quarter: data.periodType === 'QUARTERLY' ? data.quarter! : null,
      periodType: data.periodType,
      percentage: data.percentage ? new Decimal(data.percentage) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      project: {
        connect: { id: data.projectId },
      },
      createdBy: {
        connect: { id: requestingUser.id },
      },
    });

    if (isPerUnitCharge) {
      // Create unit charges with explicit amounts
      unitChargesData.forEach((uc) => {
        uc.projectServiceChargeId = serviceCharge.id;
      });

      if (unitChargesData.length > 0) {
        await this.repo.bulkCreateUnitServiceCharges(unitChargesData);
        console.log(`[Service Charge] Created ${unitChargesData.length} unit charges with total amount: ${totalAmount.toString()}`);
      }

      // Audit log for per-unit charges
      await this.createAuditLog({
        action: AuditAction.SERVICE_CHARGE_CREATED,
        entityType: 'project_service_charge',
        entityId: serviceCharge.id,
        actorId: requestingUser.id,
        changes: {
          created: data,
          chargeType: 'per-unit',
          unitsAffected: unitChargesData.length,
          totalAmount: totalAmount.toString(),
        },
      });
    } else {
      // Percentage-based method (legacy): calculate from unit prices
      const units = await this.repo.getUnitsWithPricesForProject(data.projectId);

      console.log(`[Service Charge] Project ID: ${data.projectId}`);
      console.log(`[Service Charge] Found ${units.length} units with prices`);

      // Calculate and create unit service charges
      unitChargesData = units.map((unit) => {
        const unitPrice = new Decimal(unit.price.toString());
        const percentage = new Decimal(data.percentage!);
        const calculatedAmount = unitPrice.mul(percentage).div(100);

        return {
          unitId: unit.id,
          projectServiceChargeId: serviceCharge.id,
          amount: calculatedAmount,
        };
      });

      if (unitChargesData.length > 0) {
        await this.repo.bulkCreateUnitServiceCharges(unitChargesData);
        console.log(`[Service Charge] Created ${unitChargesData.length} unit charges`);
      } else {
        console.log(`[Service Charge] No unit charges created - no units with prices found`);
      }

      // Audit log for percentage-based charges
      await this.createAuditLog({
        action: AuditAction.SERVICE_CHARGE_CREATED,
        entityType: 'project_service_charge',
        entityId: serviceCharge.id,
        actorId: requestingUser.id,
        changes: {
          created: data,
          chargeType: 'percentage',
          unitsAffected: units.length,
        },
      });
    }

    // Notify each affected owner that service charge was created
    const affectedOwners = new Set<string>();

    // Get unique owner IDs from unit charges
    for (const unitCharge of unitChargesData) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitCharge.unitId },
        select: { ownerId: true },
      });

      if (unit?.ownerId && !affectedOwners.has(unit.ownerId)) {
        affectedOwners.add(unit.ownerId);

        // Create notification for each unique owner
        await this.notificationService.createNotification({
          userId: unit.ownerId,
          type: 'SERVICE_CHARGE_CREATED',
          title: 'New Service Charge',
          message: `A new service charge has been created for ${data.periodType === 'YEARLY' ? `year ${data.year}` : `Q${data.quarter} ${data.year}`}`,
          entityType: 'service_charge',
          entityId: serviceCharge.id,
          actionUrl: '/service-charge',
          metadata: {
            year: data.year,
            quarter: data.quarter,
            periodType: data.periodType,
          },
        });
      }
    }

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
   * Get units for a project (for service charge creation)
   */
  async getUnitsForProject(
    projectId: string,
    requestingUser: { id: string; role: Role }
  ): Promise<any[]> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can access this endpoint');
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const units = await this.repo.getUnitsForProject(projectId);
    return units;
  }

  /**
   * Get all units from all projects (for service charge creation)
   */
  async getAllUnitsForServiceCharge(
    requestingUser: { id: string; role: Role }
  ): Promise<any[]> {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenError('Only administrators can access this endpoint');
    }

    const units = await this.repo.getAllUnitsForServiceCharge();
    return units;
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
