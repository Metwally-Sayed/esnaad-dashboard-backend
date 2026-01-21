import { prisma } from '@/config/database';
import { Prisma, Notification } from '@prisma/client';

export class NotificationRepository {
  // Find notifications for user with pagination
  async findByUserId(
    userId: string,
    options: {
      skip: number;
      take: number;
      unreadOnly?: boolean;
    }
  ): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = { userId };

    if (options.unreadOnly) {
      where.isRead = false;
    }

    return prisma.notification.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Count notifications
  async countByUserId(userId: string, unreadOnly?: boolean): Promise<number> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }
    return prisma.notification.count({ where });
  }

  // Mark single notification as read
  async markAsRead(id: string, userId: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id, userId }, // Ensure user owns notification
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // Mark multiple notifications as read
  async markManyAsRead(notificationIds: string[], userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId, // Security: only mark user's own notifications
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return result.count;
  }

  // Mark ALL notifications as read for user
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return result.count;
  }

  // Create notification (used by NotificationService)
  async create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return prisma.notification.create({ data });
  }

  // Get unread count (for badge)
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }
}
