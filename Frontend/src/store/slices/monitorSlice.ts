import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  MonitorFilters, MonitorKpis, PipelineRunSummary, OrchestratorRunSummary, MonitorScope,
  RunStatus, TriggerType,
} from '@/types';

interface MonitorState {
  filters: MonitorFilters;
  autoRefreshEnabled: boolean;
  autoRefreshIntervalMs: number;
  lastRefreshedAt: string | null;
  isLoading: boolean;
  kpis: MonitorKpis | null;
  pipelineRuns: PipelineRunSummary[];
  orchestratorRuns: OrchestratorRunSummary[];
  expandedOrchRunIds: string[];
  selectedRunIds: string[];
  page: number;
  pageSize: number;
  totalCount: number;
}

const defaultFilters: MonitorFilters = {
  scope: 'global',
  projectId: null,
  status: null,
  triggerType: null,
  dateFrom: null,
  dateTo: null,
  search: '',
  objectType: 'all',
  myJobsOnly: false,
};

const initialState: MonitorState = {
  filters: defaultFilters,
  autoRefreshEnabled: true,
  autoRefreshIntervalMs: 30000,
  lastRefreshedAt: null,
  isLoading: false,
  kpis: null,
  pipelineRuns: [],
  orchestratorRuns: [],
  expandedOrchRunIds: [],
  selectedRunIds: [],
  page: 1,
  pageSize: 50,
  totalCount: 0,
};

const monitorSlice = createSlice({
  name: 'monitor',
  initialState,
  reducers: {

    setScope(state, action: PayloadAction<MonitorScope>) {
      state.filters.scope = action.payload;
      if (action.payload === 'global') state.filters.projectId = null;
      state.page = 1;
    },

    setProjectFilter(state, action: PayloadAction<string | null>) {
      state.filters.projectId = action.payload;
      state.filters.scope = action.payload ? 'project' : 'global';
      state.page = 1;
    },

    setStatusFilter(state, action: PayloadAction<RunStatus | null>) {
      state.filters.status = action.payload;
      state.page = 1;
    },

    setTriggerTypeFilter(state, action: PayloadAction<TriggerType | null>) {
      state.filters.triggerType = action.payload;
      state.page = 1;
    },

    setDateRange(state, action: PayloadAction<{ from: string | null; to: string | null }>) {
      state.filters.dateFrom = action.payload.from;
      state.filters.dateTo = action.payload.to;
      state.page = 1;
    },

    setSearch(state, action: PayloadAction<string>) {
      state.filters.search = action.payload;
      state.page = 1;
    },

    setObjectType(state, action: PayloadAction<'all' | 'pipeline' | 'orchestrator'>) {
      state.filters.objectType = action.payload;
      state.page = 1;
    },

    setMyJobsOnly(state, action: PayloadAction<boolean>) {
      state.filters.myJobsOnly = action.payload;
      state.page = 1;
    },

    resetFilters(state) {
      state.filters = defaultFilters;
      state.page = 1;
    },

    setAutoRefresh(state, action: PayloadAction<boolean>) {
      state.autoRefreshEnabled = action.payload;
    },

    setAutoRefreshInterval(state, action: PayloadAction<number>) {
      state.autoRefreshIntervalMs = action.payload;
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    setKpis(state, action: PayloadAction<MonitorKpis>) {
      state.kpis = action.payload;
    },

    setPipelineRuns(state, action: PayloadAction<{ runs: PipelineRunSummary[]; total: number }>) {
      state.pipelineRuns = action.payload.runs;
      state.totalCount = action.payload.total;
      state.lastRefreshedAt = new Date().toISOString();
      state.isLoading = false;
    },

    setOrchestratorRuns(state, action: PayloadAction<{ runs: OrchestratorRunSummary[]; total: number }>) {
      state.orchestratorRuns = action.payload.runs;
      state.totalCount = action.payload.total;
      state.lastRefreshedAt = new Date().toISOString();
      state.isLoading = false;
    },

    setPage(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },

    setPageSize(state, action: PayloadAction<number>) {
      state.pageSize = action.payload;
      state.page = 1;
    },

    toggleOrchRunExpanded(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.expandedOrchRunIds.indexOf(id);
      if (idx === -1) {
        state.expandedOrchRunIds.push(id);
      } else {
        state.expandedOrchRunIds.splice(idx, 1);
      }
    },

    toggleRunSelected(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedRunIds.indexOf(id);
      if (idx === -1) {
        state.selectedRunIds.push(id);
      } else {
        state.selectedRunIds.splice(idx, 1);
      }
    },

    clearSelection(state) {
      state.selectedRunIds = [];
    },

    selectAll(state) {
      const pIds = state.pipelineRuns.map(r => r.pipelineRunId);
      const oIds = state.orchestratorRuns.map(r => r.orchRunId);
      state.selectedRunIds = [...pIds, ...oIds];
    },

    markRefreshed(state) {
      state.lastRefreshedAt = new Date().toISOString();
    },
  },
});

export const {
  setScope, setProjectFilter, setStatusFilter, setTriggerTypeFilter,
  setDateRange, setSearch, setObjectType, setMyJobsOnly, resetFilters,
  setAutoRefresh, setAutoRefreshInterval,
  setLoading, setKpis, setPipelineRuns, setOrchestratorRuns,
  setPage, setPageSize,
  toggleOrchRunExpanded, toggleRunSelected, clearSelection, selectAll,
  markRefreshed,
} = monitorSlice.actions;

export default monitorSlice.reducer;
