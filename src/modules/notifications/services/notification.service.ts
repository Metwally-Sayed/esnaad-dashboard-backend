import { NotificationRepository } from '../repositories/notification.repository';
import { NotFoundError } from '@/common/errors/AppError';
import { NotificationType } from '@prisma/client';

interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: any;
}

export class NotificationService {
  constructor(private notificationRepo: NotificationRepository) {}

  // Get notifications for authenticated user
  async getNotifications(userId: string, filters: any) {
    const skip = (filters.page - 1) * filters.limit;

    const [notifications, total] = await Promise.all([
      this.notificationRepo.findByUserId(userId, {
        skip,
        take: filters.limit,
        unreadOnly: filters.unreadOnly,
      }),
      this.notificationRepo.countByUserId(userId, filters.unreadOnly),
    ]);

    const totalPages = Math.ceil(total / filters.limit);

    return {
      data: notifications,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
        hasNext: filters.page < totalPages,
        hasPrev: filters.page > 1,
      },
    };
  }

  // Get unread count (for badge)
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.getUnreadCount(userId);
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string) {
    try {
      return await this.notificationRepo.markAsRead(notificationId, userId);
    } catch (error) {
      throw new NotFoundError('Notification not found or access denied');
    }
  }

  // Mark multiple as read
  async markManyAsRead(notificationIds: string[], userId: string) {
    return this.notificationRepo.markManyAsRead(notificationIds, userId);
  }

  // Mark all as read
  async markAllAsRead(userId: string) {
    return this.notificationRepo.markAllAsRead(userId);
  }

  // ============================================
  // NOTIFICATION CREATION HELPER
  // Called by other services when events occur
  // ============================================

  async createNotification(data: CreateNotificationData): Promise<void> {
    await this.notificationRepo.create({
      user: { connect: { id: data.userId } },
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entityType,
      entityId: data.entityId,
      actionUrl: data.actionUrl,
      metadata: data.metadata,
    });
  }
}
