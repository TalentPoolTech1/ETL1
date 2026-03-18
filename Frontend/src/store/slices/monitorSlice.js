import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';
const defaultFilters = {
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
const initialState = {
    filters: defaultFilters,
    autoRefreshEnabled: true,
    autoRefreshIntervalMs: 30000,
    lastRefreshedAt: null,
    isLoading: false,
    loading: false,
    kpis: null,
    pipelineRuns: [],
    orchestratorRuns: [],
    expandedOrchRunIds: [],
    selectedRunIds: [],
    page: 1,
    pageSize: 50,
    totalCount: 0,
};
// ─── Async thunks ──────────────────────────────────────────────────────────────
export const fetchKpis = createAsyncThunk('monitor/fetchKpis', async () => {
    const res = await api.getMonitorKpis({});
    const d = res.data?.data ?? res.data;
    return {
        totalToday: d.total_today ?? d.totalToday ?? 0,
        runningNow: d.running_now ?? d.runningNow ?? 0,
        successRateToday: d.success_rate_today ?? d.successRateToday ?? 0,
        failedToday: d.failed_today ?? d.failedToday ?? 0,
        avgDurationMsToday: d.avg_duration_ms_today ?? d.avgDurationMsToday ?? null,
        slaBreachesToday: d.sla_breaches_today ?? d.slaBreachesToday ?? 0,
        dataVolumeGbToday: d.data_volume_gb_today ?? d.dataVolumeGbToday ?? 0,
        activePipelines: d.active_pipelines ?? d.activePipelines ?? 0,
    };
});
// ─── Slice ─────────────────────────────────────────────────────────────────────
const monitorSlice = createSlice({
    name: 'monitor',
    initialState,
    reducers: {
        setScope(state, action) {
            state.filters.scope = action.payload;
            if (action.payload === 'global')
                state.filters.projectId = null;
            state.page = 1;
        },
        setProjectFilter(state, action) {
            state.filters.projectId = action.payload;
            state.filters.scope = action.payload ? 'project' : 'global';
            state.page = 1;
        },
        setStatusFilter(state, action) {
            state.filters.status = action.payload;
            state.page = 1;
        },
        setTriggerTypeFilter(state, action) {
            state.filters.triggerType = action.payload;
            state.page = 1;
        },
        setDateRange(state, action) {
            state.filters.dateFrom = action.payload.from;
            state.filters.dateTo = action.payload.to;
            state.page = 1;
        },
        setSearch(state, action) {
            state.filters.search = action.payload;
            state.page = 1;
        },
        setObjectType(state, action) {
            state.filters.objectType = action.payload;
            state.page = 1;
        },
        setMyJobsOnly(state, action) {
            state.filters.myJobsOnly = action.payload;
            state.page = 1;
        },
        resetFilters(state) {
            state.filters = defaultFilters;
            state.page = 1;
        },
        setAutoRefresh(state, action) {
            state.autoRefreshEnabled = action.payload;
        },
        setAutoRefreshInterval(state, action) {
            state.autoRefreshIntervalMs = action.payload;
        },
        setLoading(state, action) {
            state.isLoading = action.payload;
        },
        setKpis(state, action) {
            state.kpis = action.payload;
        },
        setPipelineRuns(state, action) {
            state.pipelineRuns = action.payload.runs;
            state.totalCount = action.payload.total;
            state.lastRefreshedAt = new Date().toISOString();
            state.isLoading = false;
        },
        setOrchestratorRuns(state, action) {
            state.orchestratorRuns = action.payload.runs;
            state.totalCount = action.payload.total;
            state.lastRefreshedAt = new Date().toISOString();
            state.isLoading = false;
        },
        setPage(state, action) {
            state.page = action.payload;
        },
        setPageSize(state, action) {
            state.pageSize = action.payload;
            state.page = 1;
        },
        toggleOrchRunExpanded(state, action) {
            const id = action.payload;
            const idx = state.expandedOrchRunIds.indexOf(id);
            if (idx === -1) {
                state.expandedOrchRunIds.push(id);
            }
            else {
                state.expandedOrchRunIds.splice(idx, 1);
            }
        },
        toggleRunSelected(state, action) {
            const id = action.payload;
            const idx = state.selectedRunIds.indexOf(id);
            if (idx === -1) {
                state.selectedRunIds.push(id);
            }
            else {
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
    extraReducers: builder => {
        builder
            .addCase(fetchKpis.pending, state => {
            state.loading = true;
        })
            .addCase(fetchKpis.fulfilled, (state, action) => {
            state.loading = false;
            state.kpis = action.payload;
            state.lastRefreshedAt = new Date().toISOString();
        })
            .addCase(fetchKpis.rejected, state => {
            state.loading = false;
        });
    },
});
export const { setScope, setProjectFilter, setStatusFilter, setTriggerTypeFilter, setDateRange, setSearch, setObjectType, setMyJobsOnly, resetFilters, setAutoRefresh, setAutoRefreshInterval, setLoading, setKpis, setPipelineRuns, setOrchestratorRuns, setPage, setPageSize, toggleOrchRunExpanded, toggleRunSelected, clearSelection, selectAll, markRefreshed, } = monitorSlice.actions;
export default monitorSlice.reducer;
