import { AuditLog, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';

export class AuditRepository {
  async findAll(params: {
    skip: number;
    take: number;
    where?: Prisma.AuditLogWhereInput;
    orderBy?: Prisma.AuditLogOrderByWithRelationInput;
  }): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      skip: params.skip,
      take: params.take,
      where: params.where,
      orderBy: params.orderBy,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
          },
        },
      },
    });
  }

  async count(where?: Prisma.AuditLogWhereInput): Promise<number> {
    return prisma.auditLog.count({ where });
  }
}
