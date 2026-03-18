import { LoggerFactory } from '../../shared/logging';
import { projectsRepository, ProjectRow } from '../../db/repositories/projects.repository';
import { AppError, ErrorClass } from '../../shared/errors';
import { ProjectHierarchyNode } from '@shared/types/api.types';

const log = LoggerFactory.get('projects');

export class ProjectsService {
  async getProjects(): Promise<ProjectRow[]> {
    log.info('projects.list', 'Fetching all projects');
    return projectsRepository.list();
  }

  async getProjectById(id: string): Promise<ProjectRow> {
    log.info('projects.getById', `Fetching project ${id}`);
    const project = await projectsRepository.findById(id);
    if (!project) {
      throw new AppError({
        code: 'PROJ-001',
        errorClass: ErrorClass.NOT_FOUND,
        userMessage: 'Project not found',
        internalMessage: `Project with ID ${id} does not exist`,
      });
    }
    return project;
  }

  async getHierarchy(id: string): Promise<ProjectHierarchyNode> {
    log.info('projects.getHierarchy', `Fetching hierarchy for project ${id}`);
    return projectsRepository.getHierarchy(id);
  }

  async createProject(name: string, description: string | null, userId: string): Promise<string> {
    log.info('projects.create', `Creating project: ${name}`);
    return projectsRepository.create(name, description, userId);
  }

  async updateProject(id: string, name: string | null, description: string | null, userId: string): Promise<void> {
    log.info('projects.update', `Updating project ${id}`);
    await this.getProjectById(id); // Ensure it exists or throw
    await projectsRepository.update(id, name, description, userId);
  }

  async deleteProject(id: string): Promise<void> {
    log.info('projects.delete', `Deleting project ${id}`);
    await this.getProjectById(id); // Ensure it exists or throw
    await projectsRepository.delete(id);
  }
}

export const projectsService = new ProjectsService();
