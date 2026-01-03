import { Prisma, SnaggingStatus, SnaggingPriority } from '@prisma/client';
import { prisma } from '../../../config/database';

export class SnaggingRepository {
  // Soft delete filter - exclude deleted records by default
  private excludeDeleted = { deletedAt: null };

  async findAll(params: {
    skip: number;
    take: number;
    where?: Prisma.SnaggingWhereInput;
    orderBy?: Prisma.SnaggingOrderByWithRelationInput;
    includeDeleted?: boolean;
  }) {
    const where = params.includeDeleted
      ? params.where
      : { ...params.where, ...this.excludeDeleted };

    const [data, total] = await Promise.all([
      prisma.snagging.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: params.orderBy,
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              buildingName: true,
              ownerId: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          messages: {
            where: this.excludeDeleted,
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              createdAt: true,
              author: {
                select: {
                  name: true,
                  role: true
                }
              }
            }
          },
          _count: {
            select: {
              messages: {
                where: this.excludeDeleted
              }
            }
          }
        }
      }),
      prisma.snagging.count({ where })
    ]);

    return { data, total };
  }

  async findById(id: string, includeMessages = false, messageLimit = 10) {
    return prisma.snagging.findFirst({
      where: {
        id,
        ...this.excludeDeleted
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            address: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        messages: includeMessages ? {
          where: this.excludeDeleted,
          take: messageLimit,
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            },
            attachments: true
          }
        } : false,
        _count: {
          select: {
            messages: {
              where: this.excludeDeleted
            }
          }
        }
      }
    });
  }

  async findByUnit(unitId: string, params: {
    skip: number;
    take: number;
    status?: SnaggingStatus;
    priority?: SnaggingPriority;
    createdByUserId?: string;
  }) {
    const where: Prisma.SnaggingWhereInput = {
      unitId,
      ...this.excludeDeleted,
      ...(params.status && { status: params.status }),
      ...(params.priority && { priority: params.priority }),
      ...(params.createdByUserId && { createdByUserId: params.createdByUserId })
    };

    const [data, total] = await Promise.all([
      prisma.snagging.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          _count: {
            select: {
              messages: {
                where: this.excludeDeleted
              }
            }
          }
        }
      }),
      prisma.snagging.count({ where })
    ]);

    return { data, total };
  }

  async findByUser(userId: string, params: {
    skip: number;
    take: number;
    status?: SnaggingStatus;
    priority?: SnaggingPriority;
  }) {
    const where: Prisma.SnaggingWhereInput = {
      createdByUserId: userId,
      ...this.excludeDeleted,
      ...(params.status && { status: params.status }),
      ...(params.priority && { priority: params.priority })
    };

    const [data, total] = await Promise.all([
      prisma.snagging.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              buildingName: true
            }
          },
          _count: {
            select: {
              messages: {
                where: this.excludeDeleted
              }
            }
          }
        }
      }),
      prisma.snagging.count({ where })
    ]);

    return { data, total };
  }

  async create(data: Prisma.SnaggingCreateInput) {
    return prisma.snagging.create({
      data,
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
  }

  async update(id: string, data: Prisma.SnaggingUpdateInput) {
    return prisma.snagging.update({
      where: { id },
      data,
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
  }

  async softDelete(id: string) {
    return prisma.snagging.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async hardDelete(id: string) {
    return prisma.snagging.delete({
      where: { id }
    });
  }

  // Search with text query
  async search(params: {
    skip: number;
    take: number;
    search: string;
    status?: SnaggingStatus;
    priority?: SnaggingPriority;
    unitId?: string;
    createdByUserId?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const where: Prisma.SnaggingWhereInput = {
      ...this.excludeDeleted,
      AND: [
        {
          OR: [
            { title: { contains: params.search, mode: 'insensitive' } },
            { description: { contains: params.search, mode: 'insensitive' } }
          ]
        },
        ...(params.status ? [{ status: params.status }] : []),
        ...(params.priority ? [{ priority: params.priority }] : []),
        ...(params.unitId ? [{ unitId: params.unitId }] : []),
        ...(params.createdByUserId ? [{ createdByUserId: params.createdByUserId }] : []),
        ...(params.fromDate ? [{ createdAt: { gte: params.fromDate } }] : []),
        ...(params.toDate ? [{ createdAt: { lte: params.toDate } }] : [])
      ]
    };

    const [data, total] = await Promise.all([
      prisma.snagging.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: { createdAt: 'desc' },
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
          },
          _count: {
            select: {
              messages: {
                where: this.excludeDeleted
              }
            }
          }
        }
      }),
      prisma.snagging.count({ where })
    ]);

    return { data, total };
  }
}