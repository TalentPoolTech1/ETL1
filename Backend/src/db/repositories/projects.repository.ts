import { db } from '../connection';
import { ProjectHierarchyNode } from '@shared/types/api.types';

export interface ProjectRow {
  project_id: string;
  project_display_name: string;
  project_desc_text: string | null;
  created_dtm: Date;
  updated_dtm: Date;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
}

export class ProjectsRepository {
  async list(): Promise<ProjectRow[]> {
    return db.queryMany<ProjectRow>(
      `SELECT * FROM etl.fn_get_projects()`
    );
  }

  async findById(id: string): Promise<ProjectRow | null> {
    return db.queryOne<ProjectRow>(
      `SELECT * FROM etl.fn_get_project_by_id($1)`,
      [id]
    );
  }

  async create(name: string, description: string | null, userId: string): Promise<string> {
    const result = await db.queryOne<{ p_project_id: string }>(
      `CALL etl.pr_create_project($1, $2, $3, NULL)`,
      [name, description, userId]
    );
    return result?.p_project_id || '';
  }

  async update(id: string, name: string | null, description: string | null, userId: string): Promise<void> {
    await db.query(
      `CALL etl.pr_update_project($1, $2, $3, $4)`,
      [id, name, description, userId]
    );
  }

  async delete(id: string): Promise<void> {
    await db.query(
      `CALL etl.pr_delete_project($1)`,
      [id]
    );
  }

  /**
   * Builds the full hierarchy for a project.
   */
  async getHierarchy(projectId: string): Promise<ProjectHierarchyNode> {
    // 1. Get project info
    const project = await db.queryOne<ProjectRow>(
      'SELECT * FROM etl.fn_get_project_by_id($1)',
      [projectId]
    );

    if (!project) {
       throw new Error(`Project ${projectId} not found`);
    }

    const root: ProjectHierarchyNode = {
      id:   project.project_id,
      name: project.project_display_name,
      type: 'PROJECT',
      children: []
    };

    // 2. Get folder tree
    const folders = await db.queryMany<any>(
      'SELECT * FROM etl.fn_get_folder_tree($1)',
      [projectId]
    );

    // 3. Get pipelines & orchestrators in this project
    const pipelines = await db.queryMany<any>(
      'SELECT * FROM catalog.fn_get_pipelines($1)',
      [projectId]
    );

    const orchestrators = await db.queryMany<any>(
      'SELECT * FROM catalog.fn_get_orchestrators($1)',
      [projectId]
    );

    // 4. Assemble Hierarchy
    const folderMap = new Map<string, ProjectHierarchyNode>();

    // Initialize folders
    folders.forEach(f => {
      const node: ProjectHierarchyNode = {
        id:   f.folder_id,
        name: f.folder_display_name,
        type: 'FOLDER',
        children: []
      };
      folderMap.set(f.folder_id, node);
    });

    // Link folders to parents or root
    folders.forEach(f => {
      const node = folderMap.get(f.folder_id)!;
      if (f.parent_folder_id && folderMap.has(f.parent_folder_id)) {
        folderMap.get(f.parent_folder_id)!.children?.push(node);
      } else {
        root.children?.push(node);
      }
    });

    // Add Pipelines
    pipelines.forEach(p => {
      const node: ProjectHierarchyNode = {
        id:   p.pipeline_id,
        name: p.pipeline_display_name,
        type: 'PIPELINE'
      };
      if (p.folder_id && folderMap.has(p.folder_id)) {
        folderMap.get(p.folder_id)!.children?.push(node);
      } else {
        root.children?.push(node);
      }
    });

    // Add Orchestrators
    orchestrators.forEach(o => {
      const node: ProjectHierarchyNode = {
        id:   o.orch_id,
        name: o.orch_display_name,
        type: 'ORCHESTRATOR'
      };
      if (o.folder_id && folderMap.has(o.folder_id)) {
        folderMap.get(o.folder_id)!.children?.push(node);
      } else {
        root.children?.push(node);
      }
    });

    return root;
  }
}

export const projectsRepository = new ProjectsRepository();
