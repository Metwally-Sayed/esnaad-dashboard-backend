import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';

export class SnaggingMessageRepository {
  private excludeDeleted = { deletedAt: null };

  // Cursor-based pagination for messages
  async findBySnaggingWithCursor(params: {
    snaggingId: string;
    cursor?: string; // Format: "timestamp_id"
    limit: number;
    direction: 'forward' | 'backward';
  }) {
    let cursorCondition: Prisma.SnaggingMessageWhereInput = {};

    if (params.cursor) {
      const [timestamp, id] = params.cursor.split('_');
      const cursorDate = new Date(parseInt(timestamp));

      if (params.direction === 'forward') {
        cursorCondition = {
          OR: [
            { createdAt: { gt: cursorDate } },
            {
              AND: [
                { createdAt: cursorDate },
                { id: { gt: id } }
              ]
            }
          ]
        };
      } else {
        cursorCondition = {
          OR: [
            { createdAt: { lt: cursorDate } },
            {
              AND: [
                { createdAt: cursorDate },
                { id: { lt: id } }
              ]
            }
          ]
        };
      }
    }

    const messages = await prisma.snaggingMessage.findMany({
      where: {
        snaggingId: params.snaggingId,
        ...this.excludeDeleted,
        ...cursorCondition
      },
      take: params.limit + 1, // Get one extra to check if there's more
      orderBy: [
        { createdAt: params.direction === 'forward' ? 'asc' : 'desc' },
        { id: params.direction === 'forward' ? 'asc' : 'desc' }
      ],
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
    });

    let hasMore = false;
    if (messages.length > params.limit) {
      hasMore = true;
      messages.pop(); // Remove the extra item
    }

    // If backward pagination, reverse the results to maintain chronological order
    if (params.direction === 'backward') {
      messages.reverse();
    }

    const nextCursor = hasMore && messages.length > 0
      ? `${messages[messages.length - 1].createdAt.getTime()}_${messages[messages.length - 1].id}`
      : null;

    const previousCursor = messages.length > 0
      ? `${messages[0].createdAt.getTime()}_${messages[0].id}`
      : null;

    return {
      data: messages,
      nextCursor,
      previousCursor,
      hasMore
    };
  }

  async findById(id: string) {
    return prisma.snaggingMessage.findFirst({
      where: {
        id,
        ...this.excludeDeleted
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        attachments: true,
        snagging: {
          select: {
            id: true,
            title: true,
            createdByUserId: true
          }
        }
      }
    });
  }

  async create(data: {
    snaggingId: string;
    authorUserId: string;
    authorRole: 'ADMIN' | 'OWNER';
    bodyTitle?: string;
    bodyText: string;
    attachments?: Array<{
      url: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }>;
  }) {
    const { attachments, ...messageData } = data;

    return prisma.snaggingMessage.create({
      data: {
        ...messageData,
        attachments: attachments ? {
          create: attachments
        } : undefined
      },
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
    });
  }

  async update(id: string, data: {
    bodyTitle?: string;
    bodyText?: string;
  }) {
    return prisma.snaggingMessage.update({
      where: { id },
      data,
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
    });
  }

  async softDelete(id: string) {
    return prisma.snaggingMessage.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async hardDelete(id: string) {
    return prisma.snaggingMessage.delete({
      where: { id }
    });
  }

  // Count undeleted messages for a snagging
  async countBySnagging(snaggingId: string) {
    return prisma.snaggingMessage.count({
      where: {
        snaggingId,
        ...this.excludeDeleted
      }
    });
  }

  // Get latest message for a snagging (for list views)
  async getLatestBySnagging(snaggingId: string) {
    return prisma.snaggingMessage.findFirst({
      where: {
        snaggingId,
        ...this.excludeDeleted
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            name: true,
            role: true
          }
        }
      }
    });
  }
}