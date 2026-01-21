import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import {
  getNotificationsSchema,
  markAsReadSchema,
  markAllAsReadSchema,
} from '../dto/notification.dto';

const router = Router();
const controller = new NotificationController();

// All routes require authentication
router.use(requireAuth);

// Get notifications (paginated, with optional unreadOnly filter)
router.get('/', validate(getNotificationsSchema), controller.getNotifications);

// Get unread count (for badge)
router.get('/unread-count', controller.getUnreadCount);

// Mark single notification as read
router.patch('/:id/read', validate(markAsReadSchema), controller.markAsRead);

// Mark all (or selected) notifications as read
router.post('/mark-all-read', validate(markAllAsReadSchema), controller.markAllAsRead);

export default router;
