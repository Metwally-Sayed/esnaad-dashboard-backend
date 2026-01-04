import { PrismaClient, Prisma, DocumentModule } from '@prisma/client';
import { DocumentFiltersDto } from '../dto/document.dto';

export class DocumentRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: any) {
    return this.prisma.document.create({
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  async findById(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  async findByModuleAndEntity(module: DocumentModule, entityId: string) {
    return this.prisma.document.findMany({
      where: {
        module,
        entityId
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  async findMany(filters: DocumentFiltersDto) {
    const where: Prisma.DocumentWhereInput = {};

    if (filters.module) {
      where.module = filters.module as DocumentModule;
    }
    if (filters.entityId) {
      where.entityId = filters.entityId;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.templateKey) {
      where.templateKey = filters.templateKey;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      this.prisma.document.count({ where })
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
}