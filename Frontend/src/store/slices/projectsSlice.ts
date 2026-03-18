import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';

export interface Project {
  projectId: string;
  projectDisplayName: string;
  projectDescText: string | null;
  createdDtm: string;
  updatedDtm: string;
}

export interface PipelineSummary {
  pipelineId: string;
  projectId: string | null;
  folderId: string | null;
  pipelineDisplayName: string;
  pipelineDescText: string | null;
  activeVersionId: string | null;
  createdDtm: string;
  updatedDtm: string;
}

export interface OrchestratorSummary {
  orchId: string;
  projectId: string | null;
  folderId: string | null;
  orchDisplayName: string;
  orchDescText: string | null;
  createdDtm: string;
  updatedDtm: string;
}

export interface FolderSummary {
  folderId: string;
  projectId: string;
  parentFolderId: string | null;
  folderDisplayName: string;
  folderTypeCode: string;
  createdDtm: string;
  updatedDtm: string;
}

interface ProjectsState {
  projects: Project[];
  /** Root-level (folder_id IS NULL) pipelines keyed by projectId */
  pipelinesByProject: Record<string, PipelineSummary[]>;
  /** Root-level (folder_id IS NULL) orchestrators keyed by projectId */
  orchestratorsByProject: Record<string, OrchestratorSummary[]>;
  /** Root-level folders keyed by projectId */
  foldersByProject: Record<string, FolderSummary[]>;
  /** Folder-scoped pipelines keyed by folderId */
  pipelinesByFolder: Record<string, PipelineSummary[]>;
  /** Folder-scoped orchestrators keyed by folderId */
  orchestratorsByFolder: Record<string, OrchestratorSummary[]>;
  /** Global pipelines (project_id IS NULL) */
  globalPipelines: PipelineSummary[];
  globalPipelinesLoaded: boolean;
  globalPipelinesCursor: string | null;
  globalPipelinesLoading: boolean;
  /** Global orchestrators (project_id IS NULL) */
  globalOrchestrators: OrchestratorSummary[];
  globalOrchestratorsLoaded: boolean;
  globalOrchestratorsCursor: string | null;
  globalOrchestratorsLoading: boolean;
  expandedProjectIds: string[];
  isLoading: boolean;
  error: string | null;
  // ── create pipeline dialog ─────────────────────────────────────────────────
  createPipelineOpen: boolean;
  createPipelineProjectId: string | null;   // null = global
  createPipelineFolderId: string | null;
  // ── create orchestrator dialog ─────────────────────────────────────────────
  createOrchestratorOpen: boolean;
  createOrchestratorProjectId: string | null; // null = global
  createOrchestratorFolderId: string | null;
  // ── create project dialog ──────────────────────────────────────────────────
  createProjectOpen: boolean;
  // ── create folder dialog ───────────────────────────────────────────────────
  createFolderOpen: boolean;
  createFolderProjectId: string | null;
  createFolderParentId: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  pipelinesByProject: {},
  orchestratorsByProject: {},
  foldersByProject: {},
  pipelinesByFolder: {},
  orchestratorsByFolder: {},
  globalPipelines: [],
  globalPipelinesLoaded: false,
  globalPipelinesCursor: null,
  globalPipelinesLoading: false,
  globalOrchestrators: [],
  globalOrchestratorsLoaded: false,
  globalOrchestratorsCursor: null,
  globalOrchestratorsLoading: false,
  expandedProjectIds: [],
  isLoading: false,
  error: null,
  createPipelineOpen: false,
  createPipelineProjectId: null,
  createPipelineFolderId: null,
  createOrchestratorOpen: false,
  createOrchestratorProjectId: null,
  createOrchestratorFolderId: null,
  createProjectOpen: false,
  createFolderOpen: false,
  createFolderProjectId: null,
  createFolderParentId: null,
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapProject(r: any): Project {
  return {
    projectId:          r.project_id           ?? r.projectId,
    projectDisplayName: r.project_display_name  ?? r.projectDisplayName,
    projectDescText:    r.project_desc_text     ?? r.projectDescText    ?? null,
    createdDtm:         r.created_dtm           ?? r.createdDtm,
    updatedDtm:         r.updated_dtm           ?? r.updatedDtm,
  };
}

function mapPipeline(r: any): PipelineSummary {
  return {
    pipelineId:          r.pipeline_id           ?? r.pipelineId,
    projectId:           r.project_id            ?? r.projectId           ?? null,
    folderId:            r.folder_id             ?? r.folderId            ?? null,
    pipelineDisplayName: r.pipeline_display_name  ?? r.pipelineDisplayName,
    pipelineDescText:    r.pipeline_desc_text     ?? r.pipelineDescText   ?? null,
    activeVersionId:     r.active_version_id      ?? r.activeVersionId    ?? null,
    createdDtm:          r.created_dtm            ?? r.createdDtm,
    updatedDtm:          r.updated_dtm            ?? r.updatedDtm,
  };
}

function mapOrchestrator(r: any): OrchestratorSummary {
  return {
    orchId:          r.orch_id           ?? r.orchId,
    projectId:       r.project_id        ?? r.projectId       ?? null,
    folderId:        r.folder_id         ?? r.folderId        ?? null,
    orchDisplayName: r.orch_display_name  ?? r.orchDisplayName,
    orchDescText:    r.orch_desc_text     ?? r.orchDescText    ?? null,
    createdDtm:      r.created_dtm        ?? r.createdDtm,
    updatedDtm:      r.updated_dtm        ?? r.updatedDtm,
  };
}

function mapFolder(r: any): FolderSummary {
  return {
    folderId:          r.folder_id           ?? r.folderId,
    projectId:         r.project_id          ?? r.projectId,
    parentFolderId:    r.parent_folder_id    ?? r.parentFolderId    ?? null,
    folderDisplayName: r.folder_display_name  ?? r.folderDisplayName,
    folderTypeCode:    r.folder_type_code     ?? r.folderTypeCode    ?? 'PIPELINE',
    createdDtm:        r.created_dtm          ?? r.createdDtm,
    updatedDtm:        r.updated_dtm          ?? r.updatedDtm,
  };
}

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchProjects = createAsyncThunk('projects/fetchAll', async () => {
  const res = await api.getProjects();
  return ((res.data.data ?? res.data) as any[]).map(mapProject);
});

export const fetchPipelinesForProject = createAsyncThunk(
  'projects/fetchPipelines',
  async (projectId: string) => {
    const res = await api.getPipelinesForProject(projectId);
    return { projectId, pipelines: ((res.data.data ?? res.data) as any[]).map(mapPipeline) };
  }
);

export const fetchOrchestratorsForProject = createAsyncThunk(
  'projects/fetchOrchestrators',
  async (projectId: string) => {
    const res = await api.getOrchestratorsForProject(projectId);
    return { projectId, orchestrators: ((res.data.data ?? res.data) as any[]).map(mapOrchestrator) };
  }
);

export const fetchFoldersForProject = createAsyncThunk(
  'projects/fetchFolders',
  async (projectId: string) => {
    const res = await api.getFoldersByProject(projectId);
    return { projectId, folders: ((res.data.data ?? res.data) as any[]).map(mapFolder) };
  }
);

export const fetchFolderPipelines = createAsyncThunk(
  'projects/fetchFolderPipelines',
  async (folderId: string) => {
    const res = await api.getFolderPipelines(folderId);
    return { folderId, pipelines: ((res.data.data ?? res.data) as any[]).map(mapPipeline) };
  }
);

export const fetchFolderOrchestrators = createAsyncThunk(
  'projects/fetchFolderOrchestrators',
  async (folderId: string) => {
    const res = await api.getFolderOrchestrators(folderId);
    return { folderId, orchestrators: ((res.data.data ?? res.data) as any[]).map(mapOrchestrator) };
  }
);

export const fetchGlobalPipelines = createAsyncThunk(
  'projects/fetchGlobalPipelines',
  async (after?: string) => {
    const res = await api.getGlobalPipelines({ after, limit: 50 });
    const items = ((res.data.data ?? res.data) as any[]).map(mapPipeline);
    const nextCursor: string | null = res.data.nextCursor ?? null;
    return { items, nextCursor, append: !!after };
  },
);

export const fetchGlobalOrchestrators = createAsyncThunk(
  'projects/fetchGlobalOrchestrators',
  async (after?: string) => {
    const res = await api.getGlobalOrchestrators({ after, limit: 50 });
    const items = ((res.data.data ?? res.data) as any[]).map(mapOrchestrator);
    const nextCursor: string | null = res.data.nextCursor ?? null;
    return { items, nextCursor, append: !!after };
});

export const createProject = createAsyncThunk(
  'projects/create',
  async (data: { projectDisplayName: string; projectDescText?: string }) => {
    const res = await api.createProject(data);
    return mapProject(res.data.data ?? res.data);
  }
);

export const createPipeline = createAsyncThunk(
  'projects/createPipeline',
  async (data: {
    projectId?: string | null;
    pipelineDisplayName: string;
    pipelineDescText?: string;
    folderId?: string | null;
  }) => {
    const res = await api.createPipeline(data);
    const r = res.data.data ?? res.data;
    return { pipeline: mapPipeline(r), projectId: data.projectId ?? null, folderId: data.folderId ?? null };
  }
);

export const createOrchestrator = createAsyncThunk(
  'projects/createOrchestrator',
  async (data: {
    projectId?: string | null;
    orchDisplayName: string;
    orchDescText?: string;
    folderId?: string | null;
  }) => {
    const res = await api.createOrchestrator(data);
    const r = res.data.data ?? res.data;
    return { orchestrator: mapOrchestrator(r), projectId: data.projectId ?? null, folderId: data.folderId ?? null };
  }
);

export const createFolder = createAsyncThunk(
  'projects/createFolder',
  async (data: {
    projectId: string;
    parentFolderId?: string | null;
    folderDisplayName: string;
    folderTypeCode?: string;
  }) => {
    const res = await api.createFolder(data);
    return mapFolder(res.data.data ?? res.data);
  }
);

export const deleteProject = createAsyncThunk('projects/delete', async (id: string) => {
  await api.deleteProject(id);
  return id;
});

export const renameProject = createAsyncThunk(
  'projects/rename',
  async ({ id, name }: { id: string; name: string }) => {
    await api.updateProject(id, { projectDisplayName: name });
    return { id, name };
  }
);

export const deletePipeline = createAsyncThunk(
  'projects/deletePipeline',
  async ({ projectId, pipelineId }: { projectId: string | null; pipelineId: string }) => {
    await api.deletePipeline(pipelineId);
    return { projectId, pipelineId };
  }
);

export const renamePipeline = createAsyncThunk(
  'projects/renamePipeline',
  async ({ projectId, pipelineId, name }: { projectId: string | null; pipelineId: string; name: string }) => {
    await api.savePipeline(pipelineId, { pipelineDisplayName: name });
    return { projectId, pipelineId, name };
  }
);

export const deleteOrchestrator = createAsyncThunk(
  'projects/deleteOrchestrator',
  async ({ projectId, orchId }: { projectId: string | null; orchId: string }) => {
    await api.deleteOrchestrator(orchId);
    return { projectId, orchId };
  }
);

export const renameOrchestrator = createAsyncThunk(
  'projects/renameOrchestrator',
  async ({ projectId, orchId, name }: { projectId: string | null; orchId: string; name: string }) => {
    await api.saveOrchestrator(orchId, { orchDisplayName: name });
    return { projectId, orchId, name };
  }
);

export const renameFolder = createAsyncThunk(
  'projects/renameFolder',
  async ({ projectId, folderId, name }: { projectId: string; folderId: string; name: string }) => {
    await api.renameFolder(folderId, name);
    return { projectId, folderId, name };
  }
);

export const deleteFolder = createAsyncThunk(
  'projects/deleteFolder',
  async ({ projectId, folderId }: { projectId: string; folderId: string }) => {
    await api.deleteFolder(folderId);
    return { projectId, folderId };
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    toggleProjectExpanded(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.expandedProjectIds.indexOf(id);
      if (idx === -1) state.expandedProjectIds.push(id);
      else state.expandedProjectIds.splice(idx, 1);
    },
    openCreateProject(state) { state.createProjectOpen = true; },
    closeCreateProject(state) { state.createProjectOpen = false; },
    openCreatePipeline(state, action: PayloadAction<{ projectId: string | null; folderId?: string | null }>) {
      state.createPipelineOpen = true;
      state.createPipelineProjectId = action.payload.projectId;
      state.createPipelineFolderId = action.payload.folderId ?? null;
    },
    closeCreatePipeline(state) {
      state.createPipelineOpen = false;
      state.createPipelineProjectId = null;
      state.createPipelineFolderId = null;
    },
    openCreateOrchestrator(state, action: PayloadAction<{ projectId: string | null; folderId?: string | null }>) {
      state.createOrchestratorOpen = true;
      state.createOrchestratorProjectId = action.payload.projectId;
      state.createOrchestratorFolderId = action.payload.folderId ?? null;
    },
    closeCreateOrchestrator(state) {
      state.createOrchestratorOpen = false;
      state.createOrchestratorProjectId = null;
      state.createOrchestratorFolderId = null;
    },
    openCreateFolder(state, action: PayloadAction<{ projectId: string; parentFolderId?: string | null }>) {
      state.createFolderOpen = true;
      state.createFolderProjectId = action.payload.projectId;
      state.createFolderParentId = action.payload.parentFolderId ?? null;
    },
    closeCreateFolder(state) {
      state.createFolderOpen = false;
      state.createFolderProjectId = null;
      state.createFolderParentId = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProjects.pending, state => { state.isLoading = true; state.error = null; })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message ?? 'Failed to load projects';
      })
      .addCase(fetchPipelinesForProject.fulfilled, (state, action) => {
        state.pipelinesByProject[action.payload.projectId] = action.payload.pipelines;
      })
      .addCase(fetchOrchestratorsForProject.fulfilled, (state, action) => {
        state.orchestratorsByProject[action.payload.projectId] = action.payload.orchestrators;
      })
      .addCase(fetchFoldersForProject.fulfilled, (state, action) => {
        state.foldersByProject[action.payload.projectId] = action.payload.folders;
      })
      .addCase(fetchFolderPipelines.fulfilled, (state, action) => {
        state.pipelinesByFolder[action.payload.folderId] = action.payload.pipelines;
      })
      .addCase(fetchFolderOrchestrators.fulfilled, (state, action) => {
        state.orchestratorsByFolder[action.payload.folderId] = action.payload.orchestrators;
      })
      .addCase(fetchGlobalPipelines.pending, state => { state.globalPipelinesLoading = true; })
      .addCase(fetchGlobalPipelines.fulfilled, (state, action) => {
        const { items, nextCursor, append } = action.payload;
        state.globalPipelines = append ? [...state.globalPipelines, ...items] : items;
        state.globalPipelinesLoaded = true;
        state.globalPipelinesCursor = nextCursor;
        state.globalPipelinesLoading = false;
      })
      .addCase(fetchGlobalPipelines.rejected, state => { state.globalPipelinesLoading = false; })
      .addCase(fetchGlobalOrchestrators.pending, state => { state.globalOrchestratorsLoading = true; })
      .addCase(fetchGlobalOrchestrators.fulfilled, (state, action) => {
        const { items, nextCursor, append } = action.payload;
        state.globalOrchestrators = append ? [...state.globalOrchestrators, ...items] : items;
        state.globalOrchestratorsLoaded = true;
        state.globalOrchestratorsCursor = nextCursor;
        state.globalOrchestratorsLoading = false;
      })
      .addCase(fetchGlobalOrchestrators.rejected, state => { state.globalOrchestratorsLoading = false; })
      .addCase(createProject.fulfilled, (state, action) => {
        state.projects.push(action.payload);
        state.createProjectOpen = false;
      })
      .addCase(createPipeline.fulfilled, (state, action) => {
        const { pipeline, projectId, folderId } = action.payload;
        state.createPipelineOpen = false;
        state.createPipelineProjectId = null;
        state.createPipelineFolderId = null;
        if (!projectId) {
          // global pipeline
          state.globalPipelines.push(pipeline);
        } else if (!folderId) {
          // project root pipeline
          const list = state.pipelinesByProject[projectId] ?? [];
          list.push(pipeline);
          state.pipelinesByProject[projectId] = list;
        } else {
          // folder-scoped pipeline
          const list = state.pipelinesByFolder[folderId] ?? [];
          list.push(pipeline);
          state.pipelinesByFolder[folderId] = list;
        }
      })
      .addCase(createOrchestrator.fulfilled, (state, action) => {
        const { orchestrator, projectId, folderId } = action.payload;
        state.createOrchestratorOpen = false;
        state.createOrchestratorProjectId = null;
        state.createOrchestratorFolderId = null;
        if (!projectId) {
          state.globalOrchestrators.push(orchestrator);
        } else if (!folderId) {
          const list = state.orchestratorsByProject[projectId] ?? [];
          list.push(orchestrator);
          state.orchestratorsByProject[projectId] = list;
        } else {
          const list = state.orchestratorsByFolder[folderId] ?? [];
          list.push(orchestrator);
          state.orchestratorsByFolder[folderId] = list;
        }
      })
      .addCase(createFolder.fulfilled, (state, action) => {
        const f = action.payload;
        const list = state.foldersByProject[f.projectId] ?? [];
        list.push(f);
        state.foldersByProject[f.projectId] = list;
        state.createFolderOpen = false;
        state.createFolderProjectId = null;
        state.createFolderParentId = null;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.projects = state.projects.filter(p => p.projectId !== action.payload);
        delete state.pipelinesByProject[action.payload];
        delete state.orchestratorsByProject[action.payload];
        delete state.foldersByProject[action.payload];
        const idx = state.expandedProjectIds.indexOf(action.payload);
        if (idx !== -1) state.expandedProjectIds.splice(idx, 1);
      })
      .addCase(renameProject.fulfilled, (state, action) => {
        const p = state.projects.find(p => p.projectId === action.payload.id);
        if (p) p.projectDisplayName = action.payload.name;
      })
      .addCase(deletePipeline.fulfilled, (state, action) => {
        const { projectId, pipelineId } = action.payload;
        if (!projectId) {
          state.globalPipelines = state.globalPipelines.filter(p => p.pipelineId !== pipelineId);
        } else {
          if (state.pipelinesByProject[projectId]) {
            state.pipelinesByProject[projectId] = state.pipelinesByProject[projectId].filter(p => p.pipelineId !== pipelineId);
          }
          // Also check all folders, since we don't have folderId in payload
          Object.keys(state.pipelinesByFolder).forEach(fid => {
            state.pipelinesByFolder[fid] = state.pipelinesByFolder[fid].filter(p => p.pipelineId !== pipelineId);
          });
        }
      })
      .addCase(renamePipeline.fulfilled, (state, action) => {
        const { projectId, pipelineId, name } = action.payload;
        if (!projectId) {
          const p = state.globalPipelines.find(p => p.pipelineId === pipelineId);
          if (p) p.pipelineDisplayName = name;
        } else {
          const p1 = (state.pipelinesByProject[projectId] ?? []).find(p => p.pipelineId === pipelineId);
          if (p1) p1.pipelineDisplayName = name;
          Object.values(state.pipelinesByFolder).forEach(list => {
            const p2 = list.find(p => p.pipelineId === pipelineId);
            if (p2) p2.pipelineDisplayName = name;
          });
        }
      })
      .addCase(deleteOrchestrator.fulfilled, (state, action) => {
        const { projectId, orchId } = action.payload;
        if (!projectId) {
          state.globalOrchestrators = state.globalOrchestrators.filter(o => o.orchId !== orchId);
        } else {
          if (state.orchestratorsByProject[projectId]) {
            state.orchestratorsByProject[projectId] = state.orchestratorsByProject[projectId].filter(o => o.orchId !== orchId);
          }
          Object.keys(state.orchestratorsByFolder).forEach(fid => {
            state.orchestratorsByFolder[fid] = state.orchestratorsByFolder[fid].filter(o => o.orchId !== orchId);
          });
        }
      })
      .addCase(renameOrchestrator.fulfilled, (state, action) => {
        const { projectId, orchId, name } = action.payload;
        if (!projectId) {
          const o = state.globalOrchestrators.find(o => o.orchId === orchId);
          if (o) o.orchDisplayName = name;
        } else {
          const o1 = (state.orchestratorsByProject[projectId] ?? []).find(o => o.orchId === orchId);
          if (o1) o1.orchDisplayName = name;
          Object.values(state.orchestratorsByFolder).forEach(list => {
            const o2 = list.find(o => o.orchId === orchId);
            if (o2) o2.orchDisplayName = name;
          });
        }
      })
      .addCase(renameFolder.fulfilled, (state, action) => {
        const { projectId, folderId, name } = action.payload;
        const f = (state.foldersByProject[projectId] ?? []).find(f => f.folderId === folderId);
        if (f) f.folderDisplayName = name;
      })
      .addCase(deleteFolder.fulfilled, (state, action) => {
        const { projectId, folderId } = action.payload;
        state.foldersByProject[projectId] = (state.foldersByProject[projectId] ?? [])
          .filter(f => f.folderId !== folderId);
      });
  },
});

export const {
  toggleProjectExpanded,
  openCreateProject, closeCreateProject,
  openCreatePipeline, closeCreatePipeline,
  openCreateOrchestrator, closeCreateOrchestrator,
  openCreateFolder, closeCreateFolder,
} = projectsSlice.actions;

export default projectsSlice.reducer;
