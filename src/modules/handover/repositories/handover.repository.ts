import { PrismaClient, Prisma, HandoverStatus, User } from '@prisma/client';
import { HandoverFiltersDto, MessageFiltersDto } from '../dto/handover.dto';

export class HandoverRepository {
  constructor(private prisma: PrismaClient) {}

  // Create handover with items and attachments
  async create(data: Prisma.HandoverCreateInput) {
    return this.prisma.handover.create({
      data,
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            floor: true,
            area: true,
            bedrooms: true,
            bathrooms: true,
            unitType: true,
            address: true
          }
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            nationalId: true
          }
        },
        createdByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          orderBy: { sortOrder: 'asc' }
        },
        attachments: true,
        _count: {
          select: {
            messages: true,
            documents: true
          }
        }
      }
    });
  }

  // Find handover by ID with full relations
  async findById(id: string) {
    return this.prisma.handover.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            floor: true,
            area: true,
            bedrooms: true,
            bathrooms: true,
            unitType: true,
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
            nationalId: true,
            address: true
          }
        },
        createdByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            attachments: true
          }
        },
        attachments: {
          where: { itemId: null } // Only handover-level attachments
        },
        messages: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          where: { deletedAt: null },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  // List handovers with filters and pagination
  async findMany(filters: HandoverFiltersDto, user: User) {
    const where: Prisma.HandoverWhereInput = {};

    // Apply role-based filtering
    if (user.role === 'OWNER') {
      where.ownerId = user.id;
    }

    // Apply filters
    if (filters.status) {
      where.status = filters.status as HandoverStatus;
    }
    if (filters.unitId) {
      where.unitId = filters.unitId;
    }
    if (filters.ownerId && user.role === 'ADMIN') {
      where.ownerId = filters.ownerId;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(filters.dateTo) })
      };
    }
    if (filters.search) {
      where.OR = [
        { unit: { unitNumber: { contains: filters.search, mode: 'insensitive' } } },
        { unit: { buildingName: { contains: filters.search, mode: 'insensitive' } } },
        { owner: { name: { contains: filters.search, mode: 'insensitive' } } },
        { owner: { email: { contains: filters.search, mode: 'insensitive' } } }
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [data, total] = await Promise.all([
      this.prisma.handover.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: {
          [filters.sortBy]: filters.sortOrder
        },
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
          createdByAdmin: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              items: true,
              attachments: true,
              messages: true,
              documents: true
            }
          }
        }
      }),
      this.prisma.handover.count({ where })
    ]);

    return {
      data,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
        hasNext: filters.page < Math.ceil(total / filters.limit),
        hasPrev: filters.page > 1
      }
    };
  }

  // Update handover
  async update(id: string, data: Prisma.HandoverUpdateInput) {
    return this.prisma.handover.update({
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
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          orderBy: { sortOrder: 'asc' }
        },
        attachments: true
      }
    });
  }

  // Update handover status
  async updateStatus(id: string, status: HandoverStatus, additionalData?: Prisma.HandoverUpdateInput) {
    const updateData: Prisma.HandoverUpdateInput = { status };

    // Add timestamp based on status
    switch (status) {
      case 'OWNER_CONFIRMED':
        updateData.ownerConfirmedAt = new Date();
        break;
      case 'ADMIN_CONFIRMED':
        updateData.adminConfirmedAt = new Date();
        break;
      case 'COMPLETED':
        updateData.completedAt = new Date();
        break;
      case 'CANCELLED':
        updateData.cancelledAt = new Date();
        break;
    }

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    return this.prisma.handover.update({
      where: { id },
      data: updateData
    });
  }

  // Create snapshot for PDF generation
  async createSnapshot(id: string) {
    const handover = await this.findById(id);
    if (!handover) return null;

    const snapshot = {
      handover: {
        id: handover.id,
        status: handover.status,
        scheduledAt: handover.scheduledAt,
        handoverAt: handover.handoverAt,
        notes: handover.notes,
        createdAt: handover.createdAt
      },
      unit: handover.unit,
      owner: {
        id: handover.owner.id,
        name: handover.owner.name,
        email: handover.owner.email,
        phone: handover.owner.phone,
        nationalId: handover.owner.nationalId,
        address: handover.owner.address
      },
      admin: handover.createdByAdmin,
      items: handover.items,
      attachments: handover.attachments
    };

    await this.prisma.handover.update({
      where: { id },
      data: { snapshotJson: snapshot as any }
    });

    return snapshot;
  }

  // Get messages with cursor pagination
  async getMessages(handoverId: string, filters: MessageFiltersDto) {
    const where: Prisma.HandoverMessageWhereInput = {
      handoverId,
      deletedAt: null
    };

    if (filters.cursor) {
      where.id = { lt: filters.cursor };
    }

    const messages = await this.prisma.handoverMessage.findMany({
      where,
      take: filters.limit + 1,
      orderBy: { createdAt: 'desc' },
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

    const hasMore = messages.length > filters.limit;
    const data = messages.slice(0, filters.limit);
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      meta: {
        hasMore,
        nextCursor
      }
    };
  }

  // Create message
  async createMessage(data: Prisma.HandoverMessageCreateInput) {
    return this.prisma.handoverMessage.create({
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

  // Delete items not in update list
  async deleteRemovedItems(handoverId: string, keepItemIds: string[]) {
    if (keepItemIds.length === 0) {
      await this.prisma.handoverItem.deleteMany({
        where: { handoverId }
      });
    } else {
      await this.prisma.handoverItem.deleteMany({
        where: {
          handoverId,
          id: { notIn: keepItemIds }
        }
      });
    }
  }

  // Upsert handover items
  async upsertItems(handoverId: string, items: any[]) {
    const operations = items.map((item, index) => {
      if (item.id) {
        return this.prisma.handoverItem.update({
          where: { id: item.id },
          data: {
            category: item.category,
            label: item.label,
            expectedValue: item.expectedValue,
            actualValue: item.actualValue,
            status: item.status,
            notes: item.notes,
            sortOrder: item.sortOrder ?? index
          }
        });
      } else {
        return this.prisma.handoverItem.create({
          data: {
            handoverId,
            category: item.category,
            label: item.label,
            expectedValue: item.expectedValue,
            actualValue: item.actualValue,
            status: item.status,
            notes: item.notes,
            sortOrder: item.sortOrder ?? index
          }
        });
      }
    });

    return Promise.all(operations);
  }

  // Create attachments
  async createAttachments(handoverId: string, attachments: any[]) {
    return this.prisma.handoverAttachment.createMany({
      data: attachments.map(att => ({
        handoverId,
        itemId: att.itemId,
        url: att.url,
        key: att.key,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        caption: att.caption
      }))
    });
  }
}