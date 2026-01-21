import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { NotificationRepository } from '../repositories/notification.repository';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    const notificationRepo = new NotificationRepository();
    this.notificationService = new NotificationService(notificationRepo);
  }

  // GET /api/notifications
  getNotifications = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    // Use validated query with defaults applied
    const filters = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      unreadOnly: req.query.unreadOnly === 'true',
    };

    const result = await this.notificationService.getNotifications(userId, filters);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  };

  // GET /api/notifications/unread-count
  getUnreadCount = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const count = await this.notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  };

  // PATCH /api/notifications/:id/read
  markAsRead = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await this.notificationService.markAsRead(id, userId);

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read',
    });
  };

  // POST /api/notifications/mark-all-read
  markAllAsRead = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { notificationIds } = req.body;

    let count: number;
    if (notificationIds && notificationIds.length > 0) {
      count = await this.notificationService.markManyAsRead(notificationIds, userId);
    } else {
      count = await this.notificationService.markAllAsRead(userId);
    }

    res.json({
      success: true,
      data: { count },
      message: `${count} notification(s) marked as read`,
    });
  };
}
