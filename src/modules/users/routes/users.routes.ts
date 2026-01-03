import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { requireAuth, requireRole, requireOwnerOrAdmin } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import {
  getUsersQuerySchema,
  getUserByIdSchema,
  updateUserSchema,
  deleteUserSchema,
} from '../dto/users.dto';
import { Role } from '@prisma/client';

const router = Router();
const usersController = new UsersController();

// All routes require authentication
router.use(requireAuth);

// Get all users (admin only)
router.get(
  '/',
  requireRole(Role.ADMIN),
  validate(getUsersQuerySchema),
  usersController.getUsers
);

// Get user by ID (owner can view self, admin can view all)
router.get(
  '/:id',
  validate(getUserByIdSchema),
  requireOwnerOrAdmin((req) => req.params.id),
  usersController.getUserById
);

// Update user (admin only)
router.put(
  '/:id',
  requireRole(Role.ADMIN),
  validate(updateUserSchema),
  usersController.updateUser
);

// Delete user (admin only)
router.delete(
  '/:id',
  requireRole(Role.ADMIN),
  validate(deleteUserSchema),
  usersController.deleteUser
);

export default router;
