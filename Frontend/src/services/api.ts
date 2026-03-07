import axios, { AxiosInstance, AxiosError } from 'axios';

class APIClient {
  private client: AxiosInstance;

  constructor(baseURL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000/api') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth
    this.client.interceptors.request.use(config => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle auth errors
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Projects
  getProjects() {
    return this.client.get('/projects');
  }

  getProject(id: string) {
    return this.client.get(`/projects/${id}`);
  }

  createProject(data: any) {
    return this.client.post('/projects', data);
  }

  updateProject(id: string, data: any) {
    return this.client.put(`/projects/${id}`, data);
  }

  // Pipelines
  getPipeline(id: string) {
    return this.client.get(`/pipelines/${id}`);
  }

  savePipeline(id: string, data: any) {
    return this.client.put(`/pipelines/${id}`, data);
  }

  runPipeline(id: string) {
    return this.client.post(`/pipelines/${id}/run`);
  }

  getPreview(nodeId: string, options: any = {}) {
    return this.client.get(`/nodes/${nodeId}/preview`, { params: options });
  }

  getLineage(nodeId: string) {
    return this.client.get(`/nodes/${nodeId}/lineage`);
  }

  // Metadata
  getMetadataTree() {
    return this.client.get('/metadata/tree');
  }

  searchTree(query: string) {
    return this.client.get('/metadata/tree/search', { params: { query } });
  }

  getProfile(datasetId: string) {
    return this.client.get(`/metadata/${datasetId}/profile`);
  }

  // Connections
  getConnections() {
    return this.client.get('/connections');
  }

  getConnectionTypes() {
    return this.client.get('/connections/types');
  }

  createConnection(data: any) {
    return this.client.post('/connections', data);
  }

  updateConnection(id: string, data: any) {
    return this.client.put(`/connections/${id}`, data);
  }

  deleteConnection(id: string) {
    return this.client.delete(`/connections/${id}`);
  }

  testConnectionById(id: string) {
    return this.client.post(`/connections/${id}/test`);
  }

  testConnection(config: any) {
    return this.client.post('/connections/test', config);
  }

  getConnectionHealth(id: string) {
    return this.client.get(`/connections/${id}/health`);
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

  // Monitor / Executions
  getMonitorKpis(params: Record<string, string | null | undefined>) {
    return this.client.get('/executions/kpis', { params });
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
}

export const api = new APIClient();
export default api;
