import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';
const initialState = {
    projects: [],
    pipelinesByProject: {},
    orchestratorsByProject: {},
    foldersByProject: {},
    pipelinesByFolder: {},
    orchestratorsByFolder: {},
    globalPipelines: [],
    globalPipelinesLoaded: false,
    globalOrchestrators: [],
    globalOrchestratorsLoaded: false,
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
function mapProject(r) {
    return {
        projectId: r.project_id ?? r.projectId,
        projectDisplayName: r.project_display_name ?? r.projectDisplayName,
        projectDescText: r.project_desc_text ?? r.projectDescText ?? null,
        createdDtm: r.created_dtm ?? r.createdDtm,
        updatedDtm: r.updated_dtm ?? r.updatedDtm,
    };
}
function mapPipeline(r) {
    return {
        pipelineId: r.pipeline_id ?? r.pipelineId,
        projectId: r.project_id ?? r.projectId ?? null,
        folderId: r.folder_id ?? r.folderId ?? null,
        pipelineDisplayName: r.pipeline_display_name ?? r.pipelineDisplayName,
        pipelineDescText: r.pipeline_desc_text ?? r.pipelineDescText ?? null,
        activeVersionId: r.active_version_id ?? r.activeVersionId ?? null,
        createdDtm: r.created_dtm ?? r.createdDtm,
        updatedDtm: r.updated_dtm ?? r.updatedDtm,
    };
}
function mapOrchestrator(r) {
    return {
        orchId: r.orch_id ?? r.orchId,
        projectId: r.project_id ?? r.projectId ?? null,
        folderId: r.folder_id ?? r.folderId ?? null,
        orchDisplayName: r.orch_display_name ?? r.orchDisplayName,
        orchDescText: r.orch_desc_text ?? r.orchDescText ?? null,
        createdDtm: r.created_dtm ?? r.createdDtm,
        updatedDtm: r.updated_dtm ?? r.updatedDtm,
    };
}
function mapFolder(r) {
    return {
        folderId: r.folder_id ?? r.folderId,
        projectId: r.project_id ?? r.projectId,
        parentFolderId: r.parent_folder_id ?? r.parentFolderId ?? null,
        folderDisplayName: r.folder_display_name ?? r.folderDisplayName,
        folderTypeCode: r.folder_type_code ?? r.folderTypeCode ?? 'PIPELINE',
        createdDtm: r.created_dtm ?? r.createdDtm,
        updatedDtm: r.updated_dtm ?? r.updatedDtm,
    };
}
// ─── Thunks ───────────────────────────────────────────────────────────────────
export const fetchProjects = createAsyncThunk('projects/fetchAll', async () => {
    const res = await api.getProjects();
    return (res.data.data ?? res.data).map(mapProject);
});
export const fetchPipelinesForProject = createAsyncThunk('projects/fetchPipelines', async (projectId) => {
    const res = await api.getPipelinesForProject(projectId);
    return { projectId, pipelines: (res.data.data ?? res.data).map(mapPipeline) };
});
export const fetchOrchestratorsForProject = createAsyncThunk('projects/fetchOrchestrators', async (projectId) => {
    const res = await api.getOrchestratorsForProject(projectId);
    return { projectId, orchestrators: (res.data.data ?? res.data).map(mapOrchestrator) };
});
export const fetchFoldersForProject = createAsyncThunk('projects/fetchFolders', async (projectId) => {
    const res = await api.getFoldersByProject(projectId);
    return { projectId, folders: (res.data.data ?? res.data).map(mapFolder) };
});
export const fetchFolderPipelines = createAsyncThunk('projects/fetchFolderPipelines', async (folderId) => {
    const res = await api.getFolderPipelines(folderId);
    return { folderId, pipelines: (res.data.data ?? res.data).map(mapPipeline) };
});
export const fetchFolderOrchestrators = createAsyncThunk('projects/fetchFolderOrchestrators', async (folderId) => {
    const res = await api.getFolderOrchestrators(folderId);
    return { folderId, orchestrators: (res.data.data ?? res.data).map(mapOrchestrator) };
});
export const fetchGlobalPipelines = createAsyncThunk('projects/fetchGlobalPipelines', async () => {
    const res = await api.getGlobalPipelines();
    return (res.data.data ?? res.data).map(mapPipeline);
});
export const fetchGlobalOrchestrators = createAsyncThunk('projects/fetchGlobalOrchestrators', async () => {
    const res = await api.getGlobalOrchestrators();
    return (res.data.data ?? res.data).map(mapOrchestrator);
});
export const createProject = createAsyncThunk('projects/create', async (data) => {
    const res = await api.createProject(data);
    return mapProject(res.data.data ?? res.data);
});
export const createPipeline = createAsyncThunk('projects/createPipeline', async (data) => {
    const res = await api.createPipeline(data);
    const r = res.data.data ?? res.data;
    return { pipeline: mapPipeline(r), projectId: data.projectId ?? null, folderId: data.folderId ?? null };
});
export const createOrchestrator = createAsyncThunk('projects/createOrchestrator', async (data) => {
    const res = await api.createOrchestrator(data);
    const r = res.data.data ?? res.data;
    return { orchestrator: mapOrchestrator(r), projectId: data.projectId ?? null, folderId: data.folderId ?? null };
});
export const createFolder = createAsyncThunk('projects/createFolder', async (data) => {
    const res = await api.createFolder(data);
    return mapFolder(res.data.data ?? res.data);
});
export const deleteProject = createAsyncThunk('projects/delete', async (id) => {
    await api.deleteProject(id);
    return id;
});
export const renameProject = createAsyncThunk('projects/rename', async ({ id, name }) => {
    await api.updateProject(id, { projectDisplayName: name });
    return { id, name };
});
export const deletePipeline = createAsyncThunk('projects/deletePipeline', async ({ projectId, pipelineId }) => {
    await api.deletePipeline(pipelineId);
    return { projectId, pipelineId };
});
export const renamePipeline = createAsyncThunk('projects/renamePipeline', async ({ projectId, pipelineId, name }) => {
    await api.savePipeline(pipelineId, { pipelineDisplayName: name });
    return { projectId, pipelineId, name };
});
export const deleteOrchestrator = createAsyncThunk('projects/deleteOrchestrator', async ({ projectId, orchId }) => {
    await api.deleteOrchestrator(orchId);
    return { projectId, orchId };
});
export const renameOrchestrator = createAsyncThunk('projects/renameOrchestrator', async ({ projectId, orchId, name }) => {
    await api.saveOrchestrator(orchId, { orchDisplayName: name });
    return { projectId, orchId, name };
});
export const renameFolder = createAsyncThunk('projects/renameFolder', async ({ projectId, folderId, name }) => {
    await api.renameFolder(folderId, name);
    return { projectId, folderId, name };
});
export const deleteFolder = createAsyncThunk('projects/deleteFolder', async ({ projectId, folderId }) => {
    await api.deleteFolder(folderId);
    return { projectId, folderId };
});
// ─── Slice ────────────────────────────────────────────────────────────────────
const projectsSlice = createSlice({
    name: 'projects',
    initialState,
    reducers: {
        toggleProjectExpanded(state, action) {
            const id = action.payload;
            const idx = state.expandedProjectIds.indexOf(id);
            if (idx === -1)
                state.expandedProjectIds.push(id);
            else
                state.expandedProjectIds.splice(idx, 1);
        },
        openCreateProject(state) { state.createProjectOpen = true; },
        closeCreateProject(state) { state.createProjectOpen = false; },
        openCreatePipeline(state, action) {
            state.createPipelineOpen = true;
            state.createPipelineProjectId = action.payload.projectId;
            state.createPipelineFolderId = action.payload.folderId ?? null;
        },
        closeCreatePipeline(state) {
            state.createPipelineOpen = false;
            state.createPipelineProjectId = null;
            state.createPipelineFolderId = null;
        },
        openCreateOrchestrator(state, action) {
            state.createOrchestratorOpen = true;
            state.createOrchestratorProjectId = action.payload.projectId;
            state.createOrchestratorFolderId = action.payload.folderId ?? null;
        },
        closeCreateOrchestrator(state) {
            state.createOrchestratorOpen = false;
            state.createOrchestratorProjectId = null;
            state.createOrchestratorFolderId = null;
        },
        openCreateFolder(state, action) {
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
            .addCase(fetchGlobalPipelines.fulfilled, (state, action) => {
            state.globalPipelines = action.payload;
            state.globalPipelinesLoaded = true;
        })
            .addCase(fetchGlobalOrchestrators.fulfilled, (state, action) => {
            state.globalOrchestrators = action.payload;
            state.globalOrchestratorsLoaded = true;
        })
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
            }
            else if (!folderId) {
                // project root pipeline
                const list = state.pipelinesByProject[projectId] ?? [];
                list.push(pipeline);
                state.pipelinesByProject[projectId] = list;
            }
            else {
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
            }
            else if (!folderId) {
                const list = state.orchestratorsByProject[projectId] ?? [];
                list.push(orchestrator);
                state.orchestratorsByProject[projectId] = list;
            }
            else {
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
            if (idx !== -1)
                state.expandedProjectIds.splice(idx, 1);
        })
            .addCase(renameProject.fulfilled, (state, action) => {
            const p = state.projects.find(p => p.projectId === action.payload.id);
            if (p)
                p.projectDisplayName = action.payload.name;
        })
            .addCase(deletePipeline.fulfilled, (state, action) => {
            const { projectId, pipelineId } = action.payload;
            if (!projectId) {
                state.globalPipelines = state.globalPipelines.filter(p => p.pipelineId !== pipelineId);
            }
            else {
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
                if (p)
                    p.pipelineDisplayName = name;
            }
            else {
                const p1 = (state.pipelinesByProject[projectId] ?? []).find(p => p.pipelineId === pipelineId);
                if (p1)
                    p1.pipelineDisplayName = name;
                Object.values(state.pipelinesByFolder).forEach(list => {
                    const p2 = list.find(p => p.pipelineId === pipelineId);
                    if (p2)
                        p2.pipelineDisplayName = name;
                });
            }
        })
            .addCase(deleteOrchestrator.fulfilled, (state, action) => {
            const { projectId, orchId } = action.payload;
            if (!projectId) {
                state.globalOrchestrators = state.globalOrchestrators.filter(o => o.orchId !== orchId);
            }
            else {
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
                if (o)
                    o.orchDisplayName = name;
            }
            else {
                const o1 = (state.orchestratorsByProject[projectId] ?? []).find(o => o.orchId === orchId);
                if (o1)
                    o1.orchDisplayName = name;
                Object.values(state.orchestratorsByFolder).forEach(list => {
                    const o2 = list.find(o => o.orchId === orchId);
                    if (o2)
                        o2.orchDisplayName = name;
                });
            }
        })
            .addCase(renameFolder.fulfilled, (state, action) => {
            const { projectId, folderId, name } = action.payload;
            const f = (state.foldersByProject[projectId] ?? []).find(f => f.folderId === folderId);
            if (f)
                f.folderDisplayName = name;
        })
            .addCase(deleteFolder.fulfilled, (state, action) => {
            const { projectId, folderId } = action.payload;
            state.foldersByProject[projectId] = (state.foldersByProject[projectId] ?? [])
                .filter(f => f.folderId !== folderId);
        });
    },
});
export const { toggleProjectExpanded, openCreateProject, closeCreateProject, openCreatePipeline, closeCreatePipeline, openCreateOrchestrator, closeCreateOrchestrator, openCreateFolder, closeCreateFolder, } = projectsSlice.actions;
export default projectsSlice.reducer;
