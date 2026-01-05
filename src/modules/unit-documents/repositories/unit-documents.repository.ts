import { UnitDocument, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';

export class UnitDocumentsRepository {
  async findAll(params: {
    skip: number;
    take: number;
    where?: Prisma.UnitDocumentWhereInput;
    orderBy?: Prisma.UnitDocumentOrderByWithRelationInput;
  }): Promise<UnitDocument[]> {
    return prisma.unitDocument.findMany({
      skip: params.skip,
      take: params.take,
      where: params.where,
      orderBy: params.orderBy,
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            ownerId: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });
  }

  async count(where?: Prisma.UnitDocumentWhereInput): Promise<number> {
    return prisma.unitDocument.count({ where });
  }

  async findById(id: string): Promise<UnitDocument | null> {
    return prisma.unitDocument.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            ownerId: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });
  }

  async findByUnitId(params: {
    unitId: string;
    skip: number;
    take: number;
    where?: Prisma.UnitDocumentWhereInput;
    orderBy?: Prisma.UnitDocumentOrderByWithRelationInput;
  }): Promise<UnitDocument[]> {
    const { unitId, skip, take, where, orderBy } = params;

    return prisma.unitDocument.findMany({
      where: {
        unitId,
        ...where,
      },
      skip,
      take,
      orderBy,
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });
  }

  async countByUnitId(unitId: string, where?: Prisma.UnitDocumentWhereInput): Promise<number> {
    return prisma.unitDocument.count({
      where: {
        unitId,
        ...where,
      },
    });
  }

  async create(data: Prisma.UnitDocumentCreateInput): Promise<UnitDocument> {
    return prisma.unitDocument.create({
      data,
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            ownerId: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });
  }

  async delete(id: string): Promise<UnitDocument> {
    return prisma.unitDocument.delete({
      where: { id },
    });
  }
}
