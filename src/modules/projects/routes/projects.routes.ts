import { Router } from 'express';
import { ProjectsController } from '../controllers/projects.controller';
import { validate } from '../../../common/middleware/validation.middleware';
import { requireAuth, requireRole } from '../../../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import {
  getProjectsQuerySchema,
  getProjectByIdSchema,
  createProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
} from '../dto/projects.dto';

const router = Router();
const projectsController = new ProjectsController();

// All routes require authentication
router.use(requireAuth);

// Get all projects (Admin and Owners can view)
router.get(
  '/',
  validate(getProjectsQuerySchema),
  projectsController.getProjects
);

// Get project by ID (Admin and Owners can view)
router.get(
  '/:id',
  validate(getProjectByIdSchema),
  projectsController.getProjectById
);

// Create project (Admin only)
router.post(
  '/',
  requireRole(Role.ADMIN),
  validate(createProjectSchema),
  projectsController.createProject
);

// Update project (Admin only)
router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  validate(updateProjectSchema),
  projectsController.updateProject
);

// Delete project (Admin only)
router.delete(
  '/:id',
  requireRole(Role.ADMIN),
  validate(deleteProjectSchema),
  projectsController.deleteProject
);

export default router;
