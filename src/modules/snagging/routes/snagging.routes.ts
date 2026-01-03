import { Router } from 'express';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import { Role } from '@prisma/client';

// Controllers
import {
  createSnagging,
  getAllSnaggings,
  getMySnaggings,
  getSnaggingById,
  updateSnagging,
  deleteSnagging
} from '../controllers/snagging.controller';

import {
  addMessage,
  getMessages,
  updateMessage,
  deleteMessage
} from '../controllers/snagging-message.controller';

// DTOs
import {
  createSnaggingSchema,
  updateSnaggingSchema,
  listSnaggingsSchema,
  getSnaggingByIdSchema,
  deleteSnaggingSchema
} from '../dto/snagging.dto';

import {
  createSnaggingMessageSchema,
  updateSnaggingMessageSchema,
  listSnaggingMessagesSchema,
  deleteSnaggingMessageSchema
} from '../dto/snagging-message.dto';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Snagging thread routes
router.post(
  '/',
  validate(createSnaggingSchema),
  createSnagging
);

router.get(
  '/',
  requireRole(Role.ADMIN),
  validate(listSnaggingsSchema),
  getAllSnaggings
);

router.get(
  '/my',
  getMySnaggings
);

router.get(
  '/:id',
  validate(getSnaggingByIdSchema),
  getSnaggingById
);

router.patch(
  '/:id',
  validate(updateSnaggingSchema),
  updateSnagging
);

router.delete(
  '/:id',
  validate(deleteSnaggingSchema),
  deleteSnagging
);

// Message routes
router.post(
  '/:snaggingId/messages',
  validate(createSnaggingMessageSchema),
  addMessage
);

router.get(
  '/:snaggingId/messages',
  validate(listSnaggingMessagesSchema),
  getMessages
);

router.patch(
  '/:snaggingId/messages/:messageId',
  validate(updateSnaggingMessageSchema),
  updateMessage
);

router.delete(
  '/:snaggingId/messages/:messageId',
  validate(deleteSnaggingMessageSchema),
  deleteMessage
);

export default router;