import { prisma } from '../../../config/database';
import { Prisma, ProjectServiceCharge, UnitServiceCharge } from '@prisma/client';

export class ServiceChargeRepository {
  // ============================================
  // PROJECT SERVICE CHARGES
  // ============================================

  /**
   * Find all project service charges with optional filters
   */
  async findAllProjectServiceCharges(options: {
    skip: number;
    take: number;
    where?: Prisma.ProjectServiceChargeWhereInput;
    orderBy?: Prisma.ProjectServiceChargeOrderByWithRelationInput;
  }): Promise<ProjectServiceCharge[]> {
    return prisma.projectServiceCharge.findMany({
      ...options,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        unitCharges: {
          select: {
            id: true,
            unitId: true,
            amount: true,
            isOverridden: true,
            overriddenAmount: true,
            unit: {
              select: {
                id: true,
                unitNumber: true,
                buildingName: true,
                owner: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            unitCharges: true,
          },
        },
      },
    });
  }

  /**
   * Count project service charges with optional filters
   */
  async countProjectServiceCharges(where?: Prisma.ProjectServiceChargeWhereInput): Promise<number> {
    return prisma.projectServiceCharge.count({ where });
  }

  /**
   * Find project service charge by ID
   */
  async findProjectServiceChargeById(id: string): Promise<ProjectServiceCharge | null> {
    return prisma.projectServiceCharge.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            unitCharges: true,
          },
        },
      },
    });
  }

  /**
   * Check if project service charge exists for project/year/quarter
   */
  async checkDuplicate(
    projectId: string,
    year: number,
    quarter: number | null
  ): Promise<boolean> {
    const existing = await prisma.projectServiceCharge.findFirst({
      where: {
        projectId,
        year,
        quarter,
      },
    });
    return !!existing;
  }

  /**
   * Create project service charge
   */
  async createProjectServiceCharge(
    data: Prisma.ProjectServiceChargeCreateInput
  ): Promise<ProjectServiceCharge> {
    return prisma.projectServiceCharge.create({
      data,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Update project service charge
   */
  async updateProjectServiceCharge(
    id: string,
    data: Prisma.ProjectServiceChargeUpdateInput
  ): Promise<ProjectServiceCharge> {
    return prisma.projectServiceCharge.update({
      where: { id },
      data,
      include: {
        project: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Delete project service charge (cascades to unit charges)
   */
  async deleteProjectServiceCharge(id: string): Promise<void> {
    await prisma.projectServiceCharge.delete({
      where: { id },
    });
  }

  // ============================================
  // UNIT SERVICE CHARGES
  // ============================================

  /**
   * Find unit service charges for a project service charge
   */
  async findUnitServiceCharges(options: {
    skip: number;
    take: number;
    where?: Prisma.UnitServiceChargeWhereInput;
    orderBy?: Prisma.UnitServiceChargeOrderByWithRelationInput;
  }): Promise<UnitServiceCharge[]> {
    return prisma.unitServiceCharge.findMany({
      ...options,
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            price: true,
            owner: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        projectServiceCharge: {
          select: {
            id: true,
            year: true,
            quarter: true,
            periodType: true,
            percentage: true,
            dueDate: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        overriddenBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Count unit service charges
   */
  async countUnitServiceCharges(where?: Prisma.UnitServiceChargeWhereInput): Promise<number> {
    return prisma.unitServiceCharge.count({ where });
  }

  /**
   * Find unit service charge by ID
   */
  async findUnitServiceChargeById(id: string): Promise<UnitServiceCharge | null> {
    return prisma.unitServiceCharge.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            price: true,
            owner: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        projectServiceCharge: {
          select: {
            id: true,
            year: true,
            quarter: true,
            periodType: true,
            percentage: true,
            dueDate: true,
            project: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        overriddenBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Create unit service charge
   */
  async createUnitServiceCharge(
    data: Prisma.UnitServiceChargeCreateInput
  ): Promise<UnitServiceCharge> {
    return prisma.unitServiceCharge.create({
      data,
    });
  }

  /**
   * Bulk create unit service charges
   */
  async bulkCreateUnitServiceCharges(
    data: Prisma.UnitServiceChargeCreateManyInput[]
  ): Promise<number> {
    const result = await prisma.unitServiceCharge.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Update unit service charge (for override)
   */
  async updateUnitServiceCharge(
    id: string,
    data: Prisma.UnitServiceChargeUpdateInput
  ): Promise<UnitServiceCharge> {
    return prisma.unitServiceCharge.update({
      where: { id },
      data,
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
          },
        },
        projectServiceCharge: {
          select: {
            year: true,
            quarter: true,
            periodType: true,
          },
        },
        overriddenBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get units with prices for a project
   */
  async getUnitsWithPricesForProject(projectId: string): Promise<
    Array<{
      id: string;
      unitNumber: string;
      buildingName: string | null;
      price: any; // Decimal type from Prisma
      ownerId: string | null;
    }>
  > {
    return prisma.unit.findMany({
      where: {
        projectId,
        price: {
          not: null,
        },
      },
      select: {
        id: true,
        unitNumber: true,
        buildingName: true,
        price: true,
        ownerId: true,
      },
      orderBy: {
        unitNumber: 'asc',
      },
    });
  }

  /**
   * Get all units for a project (for service charge selection)
   */
  async getUnitsForProject(projectId: string): Promise<
    Array<{
      id: string;
      unitNumber: string;
      buildingName: string | null;
      floor: number | null;
      area: number | null;
      price: any; // Decimal type from Prisma
      owner: {
        id: string;
        email: string;
        name: string | null;
      } | null;
    }>
  > {
    return prisma.unit.findMany({
      where: {
        projectId,
      },
      select: {
        id: true,
        unitNumber: true,
        buildingName: true,
        floor: true,
        area: true,
        price: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        unitNumber: 'asc',
      },
    });
  }

  /**
   * Validate that all units belong to a specific project
   * Returns the count of units that belong to the project
   */
  async validateUnitsForProject(projectId: string, unitIds: string[]): Promise<number> {
    const count = await prisma.unit.count({
      where: {
        id: {
          in: unitIds,
        },
        projectId,
      },
    });
    return count;
  }

  /**
   * Get all units from all projects (for service charge creation)
   */
  async getAllUnitsForServiceCharge(): Promise<
    Array<{
      id: string;
      unitNumber: string;
      buildingName: string | null;
      floor: number | null;
      area: number | null;
      price: any;
      projectId: string | null;
      project: {
        id: string;
        name: string;
        location: string | null;
      } | null;
      owner: {
        id: string;
        email: string;
        name: string | null;
      } | null;
    }>
  > {
    return prisma.unit.findMany({
      where: {
        projectId: {
          not: null,
        },
      },
      select: {
        id: true,
        unitNumber: true,
        buildingName: true,
        floor: true,
        area: true,
        price: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          project: {
            name: 'asc',
          },
        },
        {
          unitNumber: 'asc',
        },
      ],
    });
  }
}
