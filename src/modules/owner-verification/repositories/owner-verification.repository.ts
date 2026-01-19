import { PrismaClient, Prisma, Role, OwnerVerificationStatus } from '@prisma/client';
import { VerificationFiltersDto } from '../dto/owner-verification.dto';

// Minimal user type for repository operations
type RepoUser = { id: string; role: Role };

export class OwnerVerificationRepository {
  constructor(private prisma: PrismaClient) {}

  // ===== OwnerDocument Operations =====

  // Create owner document
  async createDocument(data: Prisma.OwnerDocumentCreateInput) {
    return this.prisma.ownerDocument.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            verificationStatus: true
          }
        }
      }
    });
  }

  // Find document by ID
  async findDocumentById(id: string) {
    return this.prisma.ownerDocument.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            verificationStatus: true
          }
        },
        reviewedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  // Get user's documents
  async findDocumentsByUserId(userId: string) {
    return this.prisma.ownerDocument.findMany({
      where: { userId },
      include: {
        reviewedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Count documents by user and type
  async countDocumentsByType(userId: string, type: 'PASSPORT' | 'NATIONAL_ID') {
    return this.prisma.ownerDocument.count({
      where: { userId, type }
    });
  }

  // Update document
  async updateDocument(id: string, data: Prisma.OwnerDocumentUpdateInput) {
    return this.prisma.ownerDocument.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            verificationStatus: true
          }
        },
        reviewedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  // Delete document
  async deleteDocument(id: string) {
    return this.prisma.ownerDocument.delete({
      where: { id }
    });
  }

  // ===== User Verification Status Operations =====

  // Get user with verification details
  async findUserWithDocuments(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownerDocuments: {
          include: {
            reviewedByAdmin: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  // Update user verification status
  async updateUserVerificationStatus(
    userId: string,
    status: OwnerVerificationStatus,
    note?: string
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: status,
        verificationNote: note || null
      },
      include: {
        ownerDocuments: {
          include: {
            reviewedByAdmin: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });
  }

  // ===== Admin Operations =====

  // Find pending verifications with pagination
  async findPendingVerifications(filters: VerificationFiltersDto, user: RepoUser) {
    const { page, limit, sortBy, sortOrder, status, search, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {
      role: Role.OWNER
    };

    // Filter by verification status
    if (status) {
      where.verificationStatus = status;
    }

    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { email: { contains: search, mode: Prisma.QueryMode.insensitive } }
      ];
    }

    // Date filters
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Determine sort field
    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy === 'name' || sortBy === 'email') {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Execute query
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          ownerDocuments: {
            include: {
              reviewedByAdmin: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  // Get verification statistics
  async getVerificationStats() {
    const [pendingDocuments, pendingApproval, approved, rejected] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: Role.OWNER,
          verificationStatus: 'PENDING_DOCUMENTS'
        }
      }),
      this.prisma.user.count({
        where: {
          role: Role.OWNER,
          verificationStatus: 'PENDING_APPROVAL'
        }
      }),
      this.prisma.user.count({
        where: {
          role: Role.OWNER,
          verificationStatus: 'APPROVED'
        }
      }),
      this.prisma.user.count({
        where: {
          role: Role.OWNER,
          verificationStatus: 'REJECTED'
        }
      })
    ]);

    return {
      pendingDocuments,
      pendingApproval,
      approved,
      rejected,
      total: pendingDocuments + pendingApproval + approved + rejected
    };
  }
}
