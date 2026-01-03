import { Request, Response, NextFunction } from 'express';
import { ProjectsService } from '../services/projects.service';
import { successResponse } from '../../../common/utils/response';
import { GetProjectsQueryDto, CreateProjectDto, UpdateProjectDto } from '../dto/projects.dto';

export class ProjectsController {
  private projectsService: ProjectsService;

  constructor() {
    this.projectsService = new ProjectsService();
  }

  getProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: GetProjectsQueryDto = req.query;
      const result = await this.projectsService.getProjects(query, req.user!);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getProjectById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const project = await this.projectsService.getProjectById(id, req.user!);
      res.json(successResponse({ project }));
    } catch (error) {
      next(error);
    }
  };

  createProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data: CreateProjectDto = req.body;
      const project = await this.projectsService.createProject(data, req.user!);
      res.status(201).json(successResponse({ project }, 'Project created successfully'));
    } catch (error) {
      next(error);
    }
  };

  updateProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data: UpdateProjectDto = req.body;
      const project = await this.projectsService.updateProject(id, data, req.user!);
      res.json(successResponse({ project }, 'Project updated successfully'));
    } catch (error) {
      next(error);
    }
  };

  deleteProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.projectsService.deleteProject(id, req.user!);
      res.json(successResponse(null, 'Project deleted successfully'));
    } catch (error) {
      next(error);
    }
  };
}
