import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';

export class SnaggingRepository {
  async findAll(params: {
    skip: number;
    take: number;
    where?: Prisma.SnaggingWhereInput;
    orderBy?: Prisma.SnaggingOrderByWithRelationInput;
  }) {
    const [data, total] = await Promise.all([
      prisma.snagging.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy || { createdAt: 'desc' },
        include: {
          unit: {
            select: {
              id: true,
              unitNumber: true,
              buildingName: true,
              floor: true,
              area: true,
              bedrooms: true,
              address: true,
              project: {
                select: {
                  id: true,
                  name: true
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
            orderBy: { sortOrder: 'asc' },
            include: {
              images: {
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        }
      }),
      prisma.snagging.count({ where: params.where })
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.snagging.findUnique({
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
            address: true,
            ownerId: true
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
          orderBy: { sortOrder: 'asc' },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      }
    });
  }

  // ✅ NEW: Method to load full details with all relations for PDF generation
  async findByIdWithDetails(id: string) {
    return prisma.snagging.findUnique({
      where: { id },
      include: {
        unit: true,
        owner: true,
        createdByAdmin: true,
        items: {
          include: {
            images: true
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
  }

  async findByUnitId(unitId: string) {
    return prisma.snagging.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      }
    });
  }

  async findByOwner(ownerId: string, params: {
    skip: number;
    take: number;
  }) {
    const where: Prisma.SnaggingWhereInput = {
      ownerId
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
              buildingName: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
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
            orderBy: { sortOrder: 'asc' },
            include: {
              images: {
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        }
      }),
      prisma.snagging.count({ where })
    ]);

    return { data, total };
  }

  async create(data: {
    unitId: string;
    ownerId: string;
    createdByAdminId: string;
    title: string;
    description: string;
    notes?: string;
    status?: string;
    items: Array<{
      category: string;
      label: string;
      location: string;
      severity: string;
      notes?: string;
      sortOrder?: number;
      images: Array<{
        imageUrl: string;
        publicId: string;
        caption?: string;
        sortOrder?: number;
      }>;
    }>;
  }) {
    return prisma.snagging.create({
      data: {
        unitId: data.unitId,
        ownerId: data.ownerId,
        createdByAdminId: data.createdByAdminId,
        title: data.title,
        description: data.description,
        notes: data.notes,
        status: data.status as any || 'DRAFT',
        items: {
          create: data.items.map((item, index) => ({
            category: item.category,
            label: item.label,
            location: item.location,
            severity: item.severity as any,
            notes: item.notes,
            sortOrder: item.sortOrder ?? index,
            images: {
              create: item.images.map((img, imgIndex) => ({
                imageUrl: img.imageUrl,
                publicId: img.publicId,
                caption: img.caption,
                sortOrder: img.sortOrder ?? imgIndex
              }))
            }
          }))
        }
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            buildingName: true,
            floor: true,
            area: true,
            bedrooms: true,
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
          orderBy: { sortOrder: 'asc' },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' }
            }
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
            name: true,
            email: true
          }
        },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            images: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      }
    });
  }

  async updatePdfUrl(id: string, pdfUrl: string, pdfPublicId: string) {
    return prisma.snagging.update({
      where: { id },
      data: {
        pdfUrl,
        pdfPublicId
      }
    });
  }

  // ✅ REMOVED: No soft delete (use CANCELLED status instead)
}
