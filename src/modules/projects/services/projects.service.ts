import { Project, Role, Prisma, AuditAction } from '@prisma/client';
import { ProjectsRepository } from '../repositories/projects.repository';
import { NotFoundError, ConflictError } from '../../../common/errors';
import {
  getPaginationParams,
  getPrismaSkipTake,
  createPaginatedResponse,
  PaginatedResponse,
} from '../../../common/utils/pagination';
import { GetProjectsQueryDto, CreateProjectDto, UpdateProjectDto } from '../dto/projects.dto';
import { prisma } from '../../../config/database';

export class ProjectsService {
  private projectsRepo: ProjectsRepository;

  constructor() {
    this.projectsRepo = new ProjectsRepository();
  }

  async getProjects(
    query: GetProjectsQueryDto,
    _requestingUser: { id: string; role: Role }
  ): Promise<PaginatedResponse<Project>> {
    const { page, limit, sortBy, sortOrder } = getPaginationParams(query);
    const { skip, take } = getPrismaSkipTake(page, limit);

    // Build where clause
    const where: Prisma.ProjectWhereInput = {};

    // Status filter
    if (query.status) {
      where.status = query.status;
    }

    // Search by project name or location
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ProjectOrderByWithRelationInput = {
      [sortBy as keyof Prisma.ProjectOrderByWithRelationInput]: sortOrder,
    };

    const [projects, total] = await Promise.all([
      this.projectsRepo.findAll({ skip, take, where, orderBy }),
      this.projectsRepo.count(where),
    ]);

    return createPaginatedResponse(projects, page, limit, total);
  }

  async getProjectById(
    id: string,
    _requestingUser: { id: string; role: Role }
  ): Promise<Project> {
    const project = await this.projectsRepo.findById(id);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  }

  async createProject(
    data: CreateProjectDto,
    requestingUser: { id: string; role: Role }
  ): Promise<Project> {
    // Check for duplicate project name
    const existingProject = await this.projectsRepo.findByName(data.name);
    if (existingProject) {
      throw new ConflictError('Project with this name already exists');
    }

    const project = await this.projectsRepo.create({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    });

    await this.createAuditLog({
      action: AuditAction.PROJECT_CREATED,
      entityType: 'project',
      entityId: project.id,
      actorId: requestingUser.id,
      changes: { created: data },
    });

    return project;
  }

  async updateProject(
    id: string,
    data: UpdateProjectDto,
    requestingUser: { id: string; role: Role }
  ): Promise<Project> {
    const existingProject = await this.projectsRepo.findById(id);
    if (!existingProject) {
      throw new NotFoundError('Project not found');
    }

    // Check for duplicate project name if changing
    if (data.name && data.name !== existingProject.name) {
      const duplicate = await this.projectsRepo.findByName(data.name);
      if (duplicate) {
        throw new ConflictError('Project with this name already exists');
      }
    }

    const updatedProject = await this.projectsRepo.update(id, {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    });

    await this.createAuditLog({
      action: AuditAction.PROJECT_UPDATED,
      entityType: 'project',
      entityId: id,
      actorId: requestingUser.id,
      changes: { old: existingProject, new: data },
    });

    return updatedProject;
  }

  async deleteProject(
    id: string,
    requestingUser: { id: string; role: Role }
  ): Promise<void> {
    const project = await this.projectsRepo.findById(id);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    await this.projectsRepo.delete(id);

    await this.createAuditLog({
      action: AuditAction.PROJECT_DELETED,
      entityType: 'project',
      entityId: id,
      actorId: requestingUser.id,
      changes: { deleted: project },
    });
  }

  private async createAuditLog(data: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    actorId: string;
    changes?: any;
    metadata?: any;
  }) {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        actorId: data.actorId,
        changes: data.changes,
        metadata: data.metadata,
      },
    });
  }
}
