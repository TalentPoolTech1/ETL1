import axios from 'axios';
class APIClient {
    constructor(baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api') {
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.client = axios.create({
            baseURL,
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
        });
        this.client.interceptors.request.use(config => {
            const token = localStorage.getItem('authToken');
            if (token)
                config.headers.Authorization = `Bearer ${token}`;
            const userId = localStorage.getItem('userId');
            if (userId)
                config.headers['X-User-Id'] = userId;
            return config;
        });
        this.client.interceptors.response.use(response => response, (error) => {
            if (error.response?.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                window.history.replaceState({}, '', '/');
                window.location.reload();
            }
            return Promise.reject(error);
        });
    }
    // ─── Auth ──────────────────────────────────────────────────────────────────
    login(email, password) {
        return this.client.post('/auth/login', { email, password });
    }
    getMe() {
        return this.client.get('/auth/me');
    }
    changePassword(data) {
        return this.client.post('/auth/change-password', data);
    }
    // ─── Projects ──────────────────────────────────────────────────────────────
    getProjects() {
        return this.client.get('/projects');
    }
    getProject(id) {
        return this.client.get(`/projects/${id}`);
    }
    createProject(data) {
        return this.client.post('/projects', data);
    }
    updateProject(id, data) {
        return this.client.put(`/projects/${id}`, data);
    }
    deleteProject(id) {
        return this.client.delete(`/projects/${id}`);
    }
    // ─── Pipelines ─────────────────────────────────────────────────────────────
    /** Project root-level pipelines (folder_id IS NULL) */
    getPipelinesForProject(projectId) {
        return this.client.get(`/projects/${projectId}/pipelines`);
    }
    /** Global pipelines (project_id IS NULL) */
    getGlobalPipelines() {
        return this.client.get('/pipelines/global');
    }
    getPipeline(id) {
        return this.client.get(`/pipelines/${id}`);
    }
    createPipeline(data) {
        return this.client.post('/pipelines', data);
    }
    savePipeline(id, data) {
        return this.client.put(`/pipelines/${id}`, data);
    }
    getPipelineParameters(id) {
        return this.client.get(`/pipelines/${id}/parameters`);
    }
    savePipelineParameters(id, parameters) {
        return this.client.put(`/pipelines/${id}/parameters`, { parameters });
    }
    runPipeline(id, options) {
        return this.client.post(`/pipelines/${id}/run`, options ?? {});
    }
    validatePipeline(id) {
        return this.client.post(`/pipelines/${id}/validate`);
    }
    generateCode(id, options) {
        return this.client.post(`/pipelines/${id}/generate`, { options: options ?? {} });
    }
    deletePipeline(id) {
        return this.client.delete(`/pipelines/${id}`);
    }
    getPipelineAuditLogs(id, params) {
        return this.client.get(`/pipelines/${id}/audit-logs`, { params });
    }
    getPipelinePermissions(id) {
        return this.client.get(`/pipelines/${id}/permissions`);
    }
    updatePipelinePermissions(id, data) {
        return this.client.put(`/pipelines/${id}/permissions`, data);
    }
    getPreview(nodeId, options = {}) {
        return this.client.get(`/nodes/${nodeId}/preview`, { params: options });
    }
    getLineage(pipelineId) {
        return this.client.get(`/pipelines/${pipelineId}/lineage`);
    }
    // ─── Orchestrators ─────────────────────────────────────────────────────────
    /** Project root-level orchestrators (folder_id IS NULL) */
    getOrchestratorsForProject(projectId) {
        return this.client.get(`/projects/${projectId}/orchestrators`);
    }
    /** Global orchestrators (project_id IS NULL) */
    getGlobalOrchestrators() {
        return this.client.get('/orchestrators/global');
    }
    getOrchestrator(id) {
        return this.client.get(`/orchestrators/${id}`);
    }
    createOrchestrator(data) {
        return this.client.post('/orchestrators', data);
    }
    saveOrchestrator(id, data) {
        return this.client.put(`/orchestrators/${id}`, data);
    }
    runOrchestrator(id, options) {
        return this.client.post(`/orchestrators/${id}/run`, options ?? {});
    }
    deleteOrchestrator(id) {
        return this.client.delete(`/orchestrators/${id}`);
    }
    getOrchestratorAuditLogs(id, params) {
        return this.client.get(`/orchestrators/${id}/audit-logs`, { params });
    }
    getOrchestratorPermissions(id) {
        return this.client.get(`/orchestrators/${id}/permissions`);
    }
    updateOrchestratorPermissions(id, data) {
        return this.client.put(`/orchestrators/${id}/permissions`, data);
    }
    // ─── Folders ───────────────────────────────────────────────────────────────
    getFoldersByProject(projectId) {
        return this.client.get(`/folders/project/${projectId}`);
    }
    getFolderChildren(folderId) {
        return this.client.get(`/folders/${folderId}/children`);
    }
    getFolderPipelines(folderId) {
        return this.client.get(`/folders/${folderId}/pipelines`);
    }
    getFolderOrchestrators(folderId) {
        return this.client.get(`/folders/${folderId}/orchestrators`);
    }
    createFolder(data) {
        return this.client.post('/folders', data);
    }
    renameFolder(id, folderDisplayName) {
        return this.client.put(`/folders/${id}/rename`, { folderDisplayName });
    }
    deleteFolder(id) {
        return this.client.delete(`/folders/${id}`);
    }
    // ─── Metadata ──────────────────────────────────────────────────────────────
    getMetadataTree() {
        return this.client.get('/metadata/tree');
    }
    searchTree(query) {
        return this.client.get('/metadata/tree/search', { params: { query } });
    }
    getProfile(datasetId) {
        return this.client.get(`/metadata/${datasetId}/profile`);
    }
    // ─── Connections ───────────────────────────────────────────────────────────
    getConnections() {
        return this.client.get('/connections');
    }
    getConnectionTypes() {
        return this.client.get('/connections/types');
    }
    getConnection(id) {
        return this.client.get(`/connections/${id}`);
    }
    createConnection(data) {
        return this.client.post('/connections', data);
    }
    updateConnection(id, data) {
        return this.client.put(`/connections/${id}`, data);
    }
    deleteConnection(id) {
        return this.client.delete(`/connections/${id}`);
    }
    testConnectionById(id) {
        return this.client.post(`/connections/${id}/test`);
    }
    testConnection(config) {
        return this.client.post('/connections/test', config);
    }
    getConnectionHealth(id) {
        return this.client.get(`/connections/${id}/health`);
    }
    listDatabases(connectorId) {
        return this.client.get(`/connections/${connectorId}/databases`);
    }
    listSchemas(connectorId, database) {
        return this.client.get(`/connections/${connectorId}/schemas`, { params: { database } });
    }
    listTables(connectorId, database, schema) {
        return this.client.get(`/connections/${connectorId}/tables`, { params: { database, schema } });
    }
    describeTable(connectorId, database, schema, table) {
        return this.client.get(`/connections/${connectorId}/tables/${table}`, { params: { database, schema } });
    }
    // ─── Monitor / Executions ──────────────────────────────────────────────────
    getMonitorKpis(params) {
        return this.client.get('/executions/kpis', { params });
    }
    getPipelineRuns(params) {
        return this.client.get('/executions/pipeline-runs', { params });
    }
    getOrchestratorRuns(params) {
        return this.client.get('/executions/orchestrator-runs', { params });
    }
    getPipelineRunDetail(runId) {
        return this.client.get(`/executions/pipeline-runs/${runId}`);
    }
    getOrchestratorRunDetail(runId) {
        return this.client.get(`/executions/orchestrator-runs/${runId}`);
    }
    getPipelineRunLogs(runId, params) {
        return this.client.get(`/executions/pipeline-runs/${runId}/logs`, { params });
    }
    getPipelineRunNodes(runId) {
        return this.client.get(`/executions/pipeline-runs/${runId}/nodes`);
    }
    retryPipelineRun(runId) {
        return this.client.post(`/executions/pipeline-runs/${runId}/retry`);
    }
    cancelPipelineRun(runId) {
        return this.client.post(`/executions/pipeline-runs/${runId}/cancel`);
    }
    retryOrchestratorRun(runId) {
        return this.client.post(`/executions/orchestrator-runs/${runId}/retry`);
    }
    cancelOrchestratorRun(runId) {
        return this.client.post(`/executions/orchestrator-runs/${runId}/cancel`);
    }
    // ─── Governance ─────────────────────────────────────────────────────────
    getUsers() {
        return this.client.get('/governance/users');
    }
    getUser(id) {
        return this.client.get(`/governance/users/${id}`);
    }
    updateUser(id, data) {
        return this.client.put(`/governance/users/${id}`, data);
    }
    getRoles() {
        return this.client.get('/governance/roles');
    }
    getPermissions() {
        return this.client.get('/governance/permissions');
    }
    assignUserRole(userId, roleId) {
        return this.client.post(`/governance/users/${userId}/roles`, { roleId });
    }
    revokeUserRole(userId, roleId) {
        return this.client.delete(`/governance/users/${userId}/roles/${roleId}`);
    }
    getProjectMembers(projectId) {
        return this.client.get(`/governance/projects/${projectId}/members`);
    }
    addProjectMember(projectId, data) {
        return this.client.post(`/governance/projects/${projectId}/members`, data);
    }
    removeProjectMember(projectId, userId) {
        return this.client.delete(`/governance/projects/${projectId}/members/${userId}`);
    }
}
export const api = new APIClient();
export default api;
