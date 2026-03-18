import axios, { AxiosInstance, AxiosError } from 'axios';

class APIClient {
  private client: AxiosInstance;

  constructor(baseURL: string = import.meta.env.VITE_API_URL || 'http://localhost:3001/api') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use(config => {
      const token = localStorage.getItem('authToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const userId = localStorage.getItem('userId');
      if (userId) config.headers['X-User-Id'] = userId;
      return config;
    });

    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userId');
          window.history.replaceState({}, '', '/');
          window.location.reload();
        }
        return Promise.reject(error);
      }
    );
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  login(email: string, password: string) {
    return this.client.post('/auth/login', { email, password });
  }

  getMe() {
    return this.client.get('/auth/me');
  }

  changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.client.post('/auth/change-password', data);
  }

  // ─── Projects ──────────────────────────────────────────────────────────────

  getProjects() {
    return this.client.get('/projects');
  }

  getProject(id: string) {
    return this.client.get(`/projects/${id}`);
  }

  createProject(data: { projectDisplayName: string; projectDescText?: string }) {
    return this.client.post('/projects', data);
  }

  updateProject(id: string, data: { projectDisplayName?: string; projectDescText?: string }) {
    return this.client.put(`/projects/${id}`, data);
  }

  deleteProject(id: string) {
    return this.client.delete(`/projects/${id}`);
  }

  // ─── Pipelines ─────────────────────────────────────────────────────────────

  /** Project root-level pipelines (folder_id IS NULL) */
  getPipelinesForProject(projectId: string) {
    return this.client.get(`/projects/${projectId}/pipelines`);
  }

  /** Global pipelines (project_id IS NULL) */
  getGlobalPipelines(params?: { after?: string; limit?: number }) {
    return this.client.get('/pipelines/global', { params });
  }

  getPipeline(id: string) {
    return this.client.get(`/pipelines/${id}`);
  }

  createPipeline(data: {
    projectId?: string | null;
    pipelineDisplayName: string;
    pipelineDescText?: string;
    folderId?: string | null;
  }) {
    return this.client.post('/pipelines', data);
  }

  savePipeline(id: string, data: unknown) {
    return this.client.put(`/pipelines/${id}`, data);
  }

  getPipelineParameters(id: string) {
    return this.client.get(`/pipelines/${id}/parameters`);
  }

  savePipelineParameters(id: string, parameters: unknown[]) {
    return this.client.put(`/pipelines/${id}/parameters`, { parameters });
  }

  runPipeline(id: string, options?: { environment?: string; technology?: string }) {
    return this.client.post(`/pipelines/${id}/run`, options ?? {});
  }

  validatePipeline(id: string) {
    return this.client.post(`/pipelines/${id}/validate`);
  }

  generateCode(id: string, options?: { technology?: string }) {
    return this.client.post(`/pipelines/${id}/generate`, { options: options ?? {} });
  }

  deletePipeline(id: string) {
    return this.client.delete(`/pipelines/${id}`);
  }

  getPipelineAuditLogs(id: string, params?: { limit?: number; offset?: number }) {
    return this.client.get(`/pipelines/${id}/audit-logs`, { params });
  }

  getPipelinePermissions(id: string) {
    return this.client.get(`/pipelines/${id}/permissions`);
  }

  updatePipelinePermissions(id: string, data: unknown) {
    return this.client.put(`/pipelines/${id}/permissions`, data);
  }

  getPipelineAlerts(id: string) {
    return this.client.get(`/pipelines/${id}/alerts`);
  }

  savePipelineAlerts(id: string, rules: Array<{ id?: string; eventTypeCode: string; channelTypeCode: string; channelTargetText: string; enabled: boolean }>) {
    return this.client.put(`/pipelines/${id}/alerts`, { rules });
  }

  getPreview(nodeId: string, options: Record<string, unknown> = {}) {
    return this.client.get(`/nodes/${nodeId}/preview`, { params: options });
  }

  getLineage(pipelineId: string) {
    return this.client.get(`/pipelines/${pipelineId}/lineage`);
  }

  // ─── Orchestrators ─────────────────────────────────────────────────────────

  /** Project root-level orchestrators (folder_id IS NULL) */
  getOrchestratorsForProject(projectId: string) {
    return this.client.get(`/projects/${projectId}/orchestrators`);
  }

  /** Global orchestrators (project_id IS NULL) */
  getGlobalOrchestrators(params?: { after?: string; limit?: number }) {
    return this.client.get('/orchestrators/global', { params });
  }

  getOrchestrator(id: string) {
    return this.client.get(`/orchestrators/${id}`);
  }

  getOrchestratorPipelines(id: string) {
    return this.client.get(`/orchestrators/${id}/pipelines`);
  }

  getOrchestratorSchedule(id: string) {
    return this.client.get(`/orchestrators/${id}/schedule`);
  }

  saveOrchestratorSchedule(id: string, data: { cronExpression: string; timezone?: string; environment?: string; isActive?: boolean }) {
    return this.client.put(`/orchestrators/${id}/schedule`, data);
  }

  deleteOrchestratorSchedule(id: string) {
    return this.client.delete(`/orchestrators/${id}/schedule`);
  }

  createOrchestrator(data: {
    projectId?: string | null;
    orchDisplayName: string;
    orchDescText?: string;
    folderId?: string | null;
  }) {
    return this.client.post('/orchestrators', data);
  }

  saveOrchestrator(id: string, data: unknown) {
    return this.client.put(`/orchestrators/${id}`, data);
  }

  runOrchestrator(id: string, options?: { environment?: string; concurrency?: string }) {
    return this.client.post(`/orchestrators/${id}/run`, options ?? {});
  }

  deleteOrchestrator(id: string) {
    return this.client.delete(`/orchestrators/${id}`);
  }

  getOrchestratorAuditLogs(id: string, params?: { limit?: number; offset?: number }) {
    return this.client.get(`/orchestrators/${id}/audit-logs`, { params });
  }

  getOrchestratorPermissions(id: string) {
    return this.client.get(`/orchestrators/${id}/permissions`);
  }

  updateOrchestratorPermissions(id: string, data: unknown) {
    return this.client.put(`/orchestrators/${id}/permissions`, data);
  }

  // ─── Folders ───────────────────────────────────────────────────────────────

  getFoldersByProject(projectId: string) {
    return this.client.get(`/folders/project/${projectId}`);
  }

  getFolderChildren(folderId: string) {
    return this.client.get(`/folders/${folderId}/children`);
  }

  getFolder(id: string) {
    return this.client.get(`/folders/${id}`);
  }

  getFolderPipelines(folderId: string) {
    return this.client.get(`/folders/${folderId}/pipelines`);
  }

  getFolderOrchestrators(folderId: string) {
    return this.client.get(`/folders/${folderId}/orchestrators`);
  }

  createFolder(data: {
    projectId: string;
    parentFolderId?: string | null;
    folderDisplayName: string;
    folderTypeCode?: string;
  }) {
    return this.client.post('/folders', data);
  }

  renameFolder(id: string, folderDisplayName: string) {
    return this.client.put(`/folders/${id}/rename`, { folderDisplayName });
  }

  deleteFolder(id: string) {
    return this.client.delete(`/folders/${id}`);
  }

  // ─── Metadata ──────────────────────────────────────────────────────────────

  getMetadataTree(search?: string) {
    return this.client.get('/metadata/tree', { params: search ? { search } : undefined });
  }

  searchTree(query: string) {
    return this.client.get('/metadata/tree/search', { params: { query } });
  }

  getProfile(datasetId: string) {
    return this.client.get(`/metadata/${datasetId}/profile`);
  }

  refreshMetadata(datasetId: string) {
    return this.client.post(`/metadata/${datasetId}/refresh`);
  }

  getMetadataLineage(datasetId: string) {
    return this.client.get(`/metadata/${datasetId}/lineage`);
  }

  getMetadataHistory(datasetId: string, params?: { limit?: number; offset?: number }) {
    return this.client.get(`/metadata/${datasetId}/history`, { params });
  }

  getMetadataPermissions(datasetId: string) {
    return this.client.get(`/metadata/${datasetId}/permissions`);
  }

  getTechnologies() {
    return this.client.get('/metadata/technologies');
  }

  // ─── Connections ───────────────────────────────────────────────────────────

  getConnections(params?: { techCode?: string; limit?: number; after?: string }) {
    return this.client.get('/connections', { params });
  }

  getConnectionTypes() {
    return this.client.get('/connections/types');
  }

  getConnection(id: string) {
    return this.client.get(`/connections/${id}`);
  }

  createConnection(data: unknown) {
    return this.client.post('/connections', data);
  }

  updateConnection(id: string, data: unknown) {
    return this.client.put(`/connections/${id}`, data);
  }

  deleteConnection(id: string) {
    return this.client.delete(`/connections/${id}`);
  }

  testConnectionById(id: string) {
    return this.client.post(`/connections/${id}/test`);
  }

  testConnection(config: unknown) {
    return this.client.post('/connections/test', config);
  }

  getConnectionHealth(id: string) {
    return this.client.get(`/connections/${id}/health`);
  }

  getConnectionUsage(id: string) {
    return this.client.get(`/connections/${id}/usage`);
  }

  getConnectionHistory(id: string, params?: { limit?: number; offset?: number }) {
    return this.client.get(`/connections/${id}/history`, { params });
  }

  getConnectionPermissions(id: string) {
    return this.client.get(`/connections/${id}/permissions`);
  }

  updateConnectionPermissions(id: string, grants: Array<{ userId?: string; roleId?: string }>) {
    return this.client.put(`/connections/${id}/permissions`, { grants });
  }

  listDatabases(connectorId: string) {
    return this.client.get(`/connections/${connectorId}/databases`);
  }

  listSchemas(connectorId: string, database: string) {
    return this.client.get(`/connections/${connectorId}/schemas`, { params: { database } });
  }

  listTables(connectorId: string, database: string, schema: string) {
    return this.client.get(`/connections/${connectorId}/tables`, { params: { database, schema } });
  }

  describeTable(connectorId: string, database: string, schema: string, table: string) {
    return this.client.get(`/connections/${connectorId}/tables/${table}`, { params: { database, schema } });
  }

  // ─── Monitor / Executions ──────────────────────────────────────────────────

  getMonitorKpis(params: Record<string, string | null | undefined>) {
    return this.client.get('/executions/kpis', { params });
  }

  getEnvironments() {
    return this.client.get('/executions/environments');
  }

  getPipelineRuns(params: Record<string, string | number | null | undefined>) {
    return this.client.get('/executions/pipeline-runs', { params });
  }

  getOrchestratorRuns(params: Record<string, string | number | null | undefined>) {
    return this.client.get('/executions/orchestrator-runs', { params });
  }

  getPipelineRunDetail(runId: string) {
    return this.client.get(`/executions/pipeline-runs/${runId}`);
  }

  getOrchestratorRunDetail(runId: string) {
    return this.client.get(`/executions/orchestrator-runs/${runId}`);
  }

  getPipelineRunLogs(runId: string, params?: { offset?: number; limit?: number }) {
    return this.client.get(`/executions/pipeline-runs/${runId}/logs`, { params });
  }

  getPipelineRunNodes(runId: string) {
    return this.client.get(`/executions/pipeline-runs/${runId}/nodes`);
  }

  retryPipelineRun(runId: string) {
    return this.client.post(`/executions/pipeline-runs/${runId}/retry`);
  }

  cancelPipelineRun(runId: string) {
    return this.client.post(`/executions/pipeline-runs/${runId}/cancel`);
  }

  retryOrchestratorRun(runId: string) {
    return this.client.post(`/executions/orchestrator-runs/${runId}/retry`);
  }

  cancelOrchestratorRun(runId: string) {
    return this.client.post(`/executions/orchestrator-runs/${runId}/cancel`);
  }

  // ─── Governance ─────────────────────────────────────────────────────────

  getUsers() {
    return this.client.get('/governance/users');
  }

  getUser(id: string) {
    return this.client.get(`/governance/users/${id}`);
  }

  updateUser(id: string, data: { displayName?: string; email?: string; isActive?: boolean }) {
    return this.client.put(`/governance/users/${id}`, data);
  }

  getRoles() {
    return this.client.get('/governance/roles');
  }

  getRole(id: string) {
    return this.client.get(`/governance/roles/${id}`);
  }

  createRole(data: { roleName: string; description?: string }) {
    return this.client.post('/governance/roles', data);
  }

  updateRole(id: string, data: { roleName?: string; description?: string }) {
    return this.client.put(`/governance/roles/${id}`, data);
  }

  getRoleMembers(roleId: string) {
    return this.client.get(`/governance/roles/${roleId}/members`);
  }

  addRoleMember(roleId: string, userId: string) {
    return this.client.post(`/governance/roles/${roleId}/members`, { userId });
  }

  removeRoleMember(roleId: string, userId: string) {
    return this.client.delete(`/governance/roles/${roleId}/members/${userId}`);
  }

  getRolePermissions(roleId: string) {
    return this.client.get(`/governance/roles/${roleId}/permissions`);
  }

  updateRolePermissions(roleId: string, permissionIds: string[]) {
    return this.client.put(`/governance/roles/${roleId}/permissions`, { permissionIds });
  }

  getPermissions() {
    return this.client.get('/governance/permissions');
  }

  assignUserRole(userId: string, roleId: string) {
    return this.client.post(`/governance/users/${userId}/roles`, { roleId });
  }

  revokeUserRole(userId: string, roleId: string) {
    return this.client.delete(`/governance/users/${userId}/roles/${roleId}`);
  }

  getProjectMembers(projectId: string) {
    return this.client.get(`/governance/projects/${projectId}/members`);
  }

  addProjectMember(projectId: string, data: { userId: string; roleId: string }) {
    return this.client.post(`/governance/projects/${projectId}/members`, data);
  }

  removeProjectMember(projectId: string, userId: string) {
    return this.client.delete(`/governance/projects/${projectId}/members/${userId}`);
  }
}

export const api = new APIClient();
export default api;
