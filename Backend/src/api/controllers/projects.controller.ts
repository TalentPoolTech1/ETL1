import { Request, Response, NextFunction } from 'express';
import { projectsService } from '../services/projects.service';

export class ProjectsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projects = await projectsService.getProjects();
      res.json(projects);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const project = await projectsService.getProjectById(req.params['id']!);
      res.json(project);
    } catch (err) {
      next(err);
    }
  }

  async getHierarchy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hierarchy = await projectsService.getHierarchy(req.params['id']!);
      res.json({ success: true, data: hierarchy });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description } = req.body;
      const userId = res.locals['userId'] || 'system';
      const projectId = await projectsService.createProject(name, description, userId);
      res.status(201).json({ id: projectId });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description } = req.body;
      const userId = res.locals['userId'] || 'system';
      await projectsService.updateProject(req.params['id']!, name, description, userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await projectsService.deleteProject(req.params['id']!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
}

export const projectsController = new ProjectsController();
