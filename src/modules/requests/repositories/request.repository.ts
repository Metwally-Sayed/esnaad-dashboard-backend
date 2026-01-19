import { PrismaClient, Prisma, Role } from '@prisma/client';
import { RequestFiltersDto, MessageFiltersDto } from '../dto/request.dto';

// Minimal user type for repository operations
type RepoUser = { id: string; role: Role };

export class RequestRepository {
  constructor(private prisma: PrismaClient) {}

  // Create request
  async create(data: Prisma.RequestCreateInput) {
    return this.prisma.request.create({
      data,
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            floor: true,
            area: true,
            address: true
          }
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });
  }

  // Find request by ID with full relations
  async findById(id: string) {
    return this.prisma.request.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            floor: true,
            area: true,
            address: true,
            project: {
              select: {
                id: true,
                name: true,
                location: true
              }
            }
          }
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true
          }
        },
        approvedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        rejectedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  // Find many with filters
  async findMany(filters: RequestFiltersDto, user: RepoUser) {
    const where: Prisma.RequestWhereInput = {
      deletedAt: null
    };

    // Admin sees all, owner sees only their requests
    if (user.role === 'OWNER') {
      where.ownerId = user.id;
    } else if (filters.ownerId) {
      where.ownerId = filters.ownerId;
    }

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.unitId) {
      where.unitId = filters.unitId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    if (filters.search) {
      where.OR = [
        { visitorName: { contains: filters.search, mode: 'insensitive' } },
        { companyName: { contains: filters.search, mode: 'insensitive' } },
        { purpose: { contains: filters.search, mode: 'insensitive' } },
        {
          unit: {
            unitNumber: { contains: filters.search, mode: 'insensitive' }
          }
        },
        {
          owner: {
            name: { contains: filters.search, mode: 'insensitive' }
          }
        }
      ];
    }

    const orderBy: Prisma.RequestOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortOrder
    };

    const skip = (filters.page - 1) * filters.limit;

    const [data, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              buildingName: true,
              floor: true
            }
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          approvedByAdmin: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy,
        skip,
        take: filters.limit
      }),
      this.prisma.request.count({ where })
    ]);

    return {
      data,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit)
      }
    };
  }

  // Update request
  async update(id: string, data: Prisma.RequestUpdateInput) {
    return this.prisma.request.update({
      where: { id },
      data,
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            floor: true
          }
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        approvedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        rejectedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  // Delete (soft delete)
  async delete(id: string) {
    return this.prisma.request.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  // ==================== MESSAGE METHODS ====================

  // Create a message
  async createMessage(data: {
    requestId: string;
    authorUserId: string;
    authorRole: Role;
    body: string;
  }) {
    return this.prisma.requestMessage.create({
      data,
      include: {
        author: {
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

  // Get messages with cursor-based pagination
  async getMessages(requestId: string, filters: MessageFiltersDto) {
    const where = {
      requestId,
      deletedAt: null
    };

    const messages = await this.prisma.requestMessage.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: filters.limit,
      ...(filters.cursor && {
        skip: 1,
        cursor: { id: filters.cursor }
      })
    });

    const nextCursor = messages.length === filters.limit ? messages[messages.length - 1]?.id : undefined;

    return {
      data: messages,
      nextCursor
    };
  }

  // Find message by ID
  async findMessageById(id: string) {
    return this.prisma.requestMessage.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        request: {
          select: {
            id: true,
            ownerId: true
          }
        }
      }
    });
  }

  // Delete message (soft delete)
  async deleteMessage(id: string) {
    return this.prisma.requestMessage.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
