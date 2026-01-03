import { Unit, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';

export class UnitsRepository {
  async findAll(params: {
    skip: number;
    take: number;
    where?: Prisma.UnitWhereInput;
    orderBy?: Prisma.UnitOrderByWithRelationInput;
  }): Promise<Unit[]> {
    return prisma.unit.findMany({
      skip: params.skip,
      take: params.take,
      where: params.where,
      orderBy: params.orderBy,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async count(where?: Prisma.UnitWhereInput): Promise<number> {
    return prisma.unit.count({ where });
  }

  async findById(id: string): Promise<Unit | null> {
    return prisma.unit.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async findByUnitNumber(unitNumber: string): Promise<Unit | null> {
    return prisma.unit.findUnique({
      where: { unitNumber },
    });
  }

  async create(data: Prisma.UnitCreateInput): Promise<Unit> {
    return prisma.unit.create({
      data,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.UnitUpdateInput): Promise<Unit> {
    return prisma.unit.update({
      where: { id },
      data,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async delete(id: string): Promise<Unit> {
    return prisma.unit.delete({
      where: { id },
    });
  }

  async assignOwner(unitId: string, ownerId: string): Promise<Unit> {
    return prisma.unit.update({
      where: { id: unitId },
      data: { ownerId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async unassignOwner(unitId: string): Promise<Unit> {
    return prisma.unit.update({
      where: { id: unitId },
      data: { ownerId: null },
    });
  }
}
