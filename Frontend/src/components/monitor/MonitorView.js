import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setScope, setStatusFilter, setTriggerTypeFilter, setDateRange, setSearch, setObjectType, setMyJobsOnly, resetFilters, setAutoRefresh, setAutoRefreshInterval, setLoading, setKpis, setPipelineRuns, setOrchestratorRuns, setPage, setPageSize, toggleOrchRunExpanded, toggleRunSelected, clearSelection, selectAll, } from '@/store/slices/monitorSlice';
import { openTab } from '@/store/slices/tabsSlice';
import api from '@/services/api';
// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
    PENDING: 'bg-neutral-100 text-neutral-600',
    QUEUED: 'bg-blue-100 text-blue-700',
    RUNNING: 'bg-blue-200 text-blue-800 animate-pulse',
    SUCCESS: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-orange-100 text-orange-700',
    SKIPPED: 'bg-neutral-100 text-neutral-500',
    RETRYING: 'bg-yellow-100 text-yellow-700 animate-pulse',
    TIMED_OUT: 'bg-red-200 text-red-900',
    PARTIALLY_COMPLETED: 'bg-amber-100 text-amber-700',
};
function StatusBadge({ status }) {
    return (_jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-neutral-100 text-neutral-600'}`, children: status.replace(/_/g, ' ') }));
}
function KpiCard({ label, value, sub, color = 'default', onClick }) {
    const border = color === 'green' ? 'border-l-4 border-green-500'
        : color === 'amber' ? 'border-l-4 border-amber-500'
            : color === 'red' ? 'border-l-4 border-red-500'
                : 'border-l-4 border-neutral-200';
    return (_jsxs("div", { className: `bg-white rounded-lg shadow-sm p-4 ${border} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`, onClick: onClick, children: [_jsx("div", { className: "text-xs font-medium text-neutral-500 uppercase tracking-wide", children: label }), _jsx("div", { className: "mt-1 text-2xl font-bold text-neutral-900", children: value }), sub && _jsx("div", { className: "mt-0.5 text-xs text-neutral-500", children: sub })] }));
}
// ─── Duration formatter ───────────────────────────────────────────────────────
function fmtDuration(ms) {
    if (ms === null)
        return '—';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0)
        return `${h}h ${m}m ${sec}s`;
    if (m > 0)
        return `${m}m ${sec}s`;
    return `${sec}s`;
}
function fmtBytes(bytes) {
    if (bytes === null)
        return '—';
    if (bytes >= 1e12)
        return `${(bytes / 1e12).toFixed(1)} TB`;
    if (bytes >= 1e9)
        return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6)
        return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3)
        return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
}
function fmtNumber(n) {
    if (n === null)
        return '—';
    if (n >= 1e9)
        return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6)
        return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3)
        return `${(n / 1e3).toFixed(1)}K`;
    return String(n);
}
function fmtDatetime(iso) {
    if (!iso)
        return '—';
    return new Date(iso).toLocaleString();
}
function PipelineRunRow({ run, indent, selected, onSelect, onOpen }) {
    return (_jsxs("tr", { className: `hover:bg-neutral-50 cursor-pointer ${selected ? 'bg-blue-50' : ''}`, onDoubleClick: onOpen, children: [_jsx("td", { className: "px-3 py-2", children: _jsx("input", { type: "checkbox", checked: selected, onChange: onSelect, onClick: e => e.stopPropagation() }) }), _jsx("td", { className: `px-3 py-2 font-mono text-xs text-neutral-500 ${indent ? 'pl-10' : ''}`, children: _jsxs("span", { title: run.pipelineRunId, children: [run.pipelineRunId.slice(0, 8), "\u2026"] }) }), _jsxs("td", { className: "px-3 py-2 text-sm font-medium text-blue-700", children: [_jsx("button", { className: "hover:underline text-left", onDoubleClick: onOpen, onClick: onOpen, children: run.pipelineName }), run.projectName && (_jsxs("span", { className: "ml-2 text-xs text-neutral-400", children: ["(", run.projectName, ")"] }))] }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-500", children: run.versionLabel }), _jsx("td", { className: "px-3 py-2", children: _jsx(StatusBadge, { status: run.runStatus }) }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: run.triggerType }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: run.submittedBy ?? '—' }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: fmtDatetime(run.startDtm) }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: fmtDuration(run.durationMs) }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: fmtNumber(run.rowsProcessed) }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: fmtBytes(run.bytesRead) }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-500", children: run.retryCount > 0 ? run.retryCount : '—' }), _jsx("td", { className: "px-3 py-2 text-xs", children: run.slaStatus !== 'N_A' && (_jsx("span", { className: `px-1.5 py-0.5 rounded text-xs font-medium ${run.slaStatus === 'BREACHED' ? 'bg-red-100 text-red-700' :
                        run.slaStatus === 'AT_RISK' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`, children: run.slaStatus.replace('_', ' ') })) })] }));
}
function OrchestratorRunRow({ run, expanded, selected, onToggle, onSelect, onOpen, dispatch, selectedRunIds }) {
    return (_jsxs(_Fragment, { children: [_jsxs("tr", { className: `hover:bg-neutral-50 bg-neutral-50 border-t border-neutral-200 cursor-pointer ${selected ? 'bg-blue-50' : ''}`, onDoubleClick: onOpen, children: [_jsx("td", { className: "px-3 py-2", children: _jsx("input", { type: "checkbox", checked: selected, onChange: onSelect, onClick: e => e.stopPropagation() }) }), _jsxs("td", { className: "px-3 py-2 font-mono text-xs text-neutral-500", children: [_jsx("button", { className: "mr-1 text-neutral-400", onClick: onToggle, children: expanded ? '▼' : '▶' }), _jsxs("span", { title: run.orchRunId, children: [run.orchRunId.slice(0, 8), "\u2026"] })] }), _jsxs("td", { className: "px-3 py-2 text-sm font-semibold text-indigo-700", children: [_jsxs("button", { className: "hover:underline text-left", onDoubleClick: onOpen, onClick: onOpen, children: ["\u2699 ", run.orchestratorName] }), run.projectName && (_jsxs("span", { className: "ml-2 text-xs text-neutral-400", children: ["(", run.projectName, ")"] }))] }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-500", children: "\u2014" }), _jsx("td", { className: "px-3 py-2", children: _jsx(StatusBadge, { status: run.runStatus }) }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: run.triggerType }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-500", children: "\u2014" }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: fmtDatetime(run.startDtm) }), _jsx("td", { className: "px-3 py-2 text-xs text-neutral-600", children: fmtDuration(run.durationMs) }), _jsxs("td", { className: "px-3 py-2 text-xs text-neutral-500", colSpan: 4, children: [run.pipelineRuns.length, " pipeline", run.pipelineRuns.length !== 1 ? 's' : ''] })] }), expanded && run.pipelineRuns.map(pr => (_jsx(PipelineRunRow, { run: pr, indent: true, selected: selectedRunIds.includes(pr.pipelineRunId), onSelect: () => dispatch(toggleRunSelected(pr.pipelineRunId)), onOpen: () => dispatch(openTab({
                    id: `execution-${pr.pipelineRunId}`,
                    type: 'execution',
                    objectId: pr.pipelineRunId,
                    objectName: `Run: ${pr.pipelineName}`,
                    unsaved: false,
                    isDirty: false,
                    executionKind: 'pipeline',
                })) }, pr.pipelineRunId)))] }));
}
// ─── Main MonitorView ─────────────────────────────────────────────────────────
export function MonitorView() {
    const dispatch = useAppDispatch();
    const filters = useAppSelector(s => s.monitor.filters);
    const autoRefreshEnabled = useAppSelector(s => s.monitor.autoRefreshEnabled);
    const autoRefreshIntervalMs = useAppSelector(s => s.monitor.autoRefreshIntervalMs);
    const isLoading = useAppSelector(s => s.monitor.isLoading);
    const kpis = useAppSelector(s => s.monitor.kpis);
    const pipelineRuns = useAppSelector(s => s.monitor.pipelineRuns);
    const orchestratorRuns = useAppSelector(s => s.monitor.orchestratorRuns);
    const expandedOrchRunIds = useAppSelector(s => s.monitor.expandedOrchRunIds);
    const selectedRunIds = useAppSelector(s => s.monitor.selectedRunIds);
    const lastRefreshedAt = useAppSelector(s => s.monitor.lastRefreshedAt);
    const page = useAppSelector(s => s.monitor.page);
    const pageSize = useAppSelector(s => s.monitor.pageSize);
    const totalCount = useAppSelector(s => s.monitor.totalCount);
    const [searchInput, setSearchInput] = useState(filters.search);
    const autoRefreshRef = useRef(null);
    // ─── Data loading ──────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        dispatch(setLoading(true));
        const params = {
            scope: filters.scope,
            projectId: filters.projectId ?? undefined,
            status: filters.status ?? undefined,
            triggerType: filters.triggerType ?? undefined,
            dateFrom: filters.dateFrom ?? undefined,
            dateTo: filters.dateTo ?? undefined,
            search: filters.search || undefined,
            objectType: filters.objectType !== 'all' ? filters.objectType : undefined,
            myJobsOnly: filters.myJobsOnly ? 'true' : undefined,
            page: String(page),
            pageSize: String(pageSize),
        };
        try {
            const [kpiRes, runsRes] = await Promise.allSettled([
                api.getMonitorKpis(params),
                filters.objectType === 'orchestrator'
                    ? api.getOrchestratorRuns(params)
                    : filters.objectType === 'pipeline'
                        ? api.getPipelineRuns(params)
                        : api.getPipelineRuns(params),
            ]);
            if (kpiRes.status === 'fulfilled') {
                dispatch(setKpis(kpiRes.value.data.data));
            }
            if (runsRes.status === 'fulfilled') {
                const data = runsRes.value.data.data;
                if (filters.objectType === 'orchestrator') {
                    dispatch(setOrchestratorRuns({ runs: data.items ?? [], total: data.total ?? 0 }));
                }
                else {
                    dispatch(setPipelineRuns({ runs: data.items ?? [], total: data.total ?? 0 }));
                }
            }
            if (filters.objectType === 'all' || filters.objectType === 'orchestrator') {
                try {
                    const orchRes = await api.getOrchestratorRuns(params);
                    dispatch(setOrchestratorRuns({
                        runs: orchRes.data.data.items ?? [],
                        total: orchRes.data.data.total ?? 0,
                    }));
                }
                catch { /* orchestrator endpoint may not exist yet */ }
            }
        }
        finally {
            dispatch(setLoading(false));
        }
    }, [dispatch, filters, page, pageSize]);
    useEffect(() => {
        loadData();
    }, [loadData]);
    // ─── Auto-refresh ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (autoRefreshRef.current)
            clearInterval(autoRefreshRef.current);
        if (autoRefreshEnabled) {
            autoRefreshRef.current = setInterval(loadData, autoRefreshIntervalMs);
        }
        return () => {
            if (autoRefreshRef.current)
                clearInterval(autoRefreshRef.current);
        };
    }, [autoRefreshEnabled, autoRefreshIntervalMs, loadData]);
    // ─── Search debounce ───────────────────────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => dispatch(setSearch(searchInput)), 400);
        return () => clearTimeout(t);
    }, [searchInput, dispatch]);
    // ─── Open execution detail tab ────────────────────────────────────────────
    const openPipelineRun = (run) => {
        dispatch(openTab({
            id: `execution-${run.pipelineRunId}`,
            type: 'execution',
            objectId: run.pipelineRunId,
            objectName: `Run: ${run.pipelineName}`,
            unsaved: false,
            isDirty: false,
            executionKind: 'pipeline',
        }));
    };
    const openOrchestratorRun = (run) => {
        dispatch(openTab({
            id: `execution-orch-${run.orchRunId}`,
            type: 'execution',
            objectId: run.orchRunId,
            objectName: `Orch: ${run.orchestratorName}`,
            unsaved: false,
            isDirty: false,
            executionKind: 'orchestrator',
        }));
    };
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const lastRefreshed = lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : 'never';
    // ─── Render ────────────────────────────────────────────────────────────────
    return (_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden bg-neutral-50", children: [_jsxs("div", { className: "bg-white border-b border-neutral-200 px-4 py-3 flex flex-wrap items-center gap-3", children: [_jsx("div", { className: "flex items-center gap-1 bg-neutral-100 rounded-md p-0.5", children: ['global', 'project'].map(s => (_jsx("button", { onClick: () => dispatch(setScope(s)), className: `px-3 py-1 rounded text-xs font-medium transition-colors ${filters.scope === s ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`, children: s === 'global' ? 'Global' : 'Project' }, s))) }), _jsxs("select", { value: filters.objectType, onChange: e => dispatch(setObjectType(e.target.value)), className: "text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white", children: [_jsx("option", { value: "all", children: "All types" }), _jsx("option", { value: "pipeline", children: "Pipelines only" }), _jsx("option", { value: "orchestrator", children: "Orchestrators only" })] }), _jsxs("select", { value: filters.status ?? '', onChange: e => dispatch(setStatusFilter((e.target.value || null))), className: "text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white", children: [_jsx("option", { value: "", children: "All statuses" }), ['RUNNING', 'SUCCESS', 'FAILED', 'PENDING', 'QUEUED', 'CANCELLED', 'RETRYING', 'TIMED_OUT', 'PARTIALLY_COMPLETED'].map(s => (_jsx("option", { value: s, children: s.replace(/_/g, ' ') }, s)))] }), _jsxs("select", { value: filters.triggerType ?? '', onChange: e => dispatch(setTriggerTypeFilter((e.target.value || null))), className: "text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white", children: [_jsx("option", { value: "", children: "All triggers" }), ['MANUAL', 'SCHEDULED', 'API', 'ORCHESTRATOR'].map(t => (_jsx("option", { value: t, children: t }, t)))] }), _jsx("input", { type: "date", value: filters.dateFrom ?? '', onChange: e => dispatch(setDateRange({ from: e.target.value || null, to: filters.dateTo })), className: "text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white", title: "From date" }), _jsx("span", { className: "text-xs text-neutral-400", children: "to" }), _jsx("input", { type: "date", value: filters.dateTo ?? '', onChange: e => dispatch(setDateRange({ from: filters.dateFrom, to: e.target.value || null })), className: "text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white", title: "To date" }), _jsxs("label", { className: "flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: filters.myJobsOnly, onChange: e => dispatch(setMyJobsOnly(e.target.checked)) }), "My jobs only"] }), _jsx("input", { type: "search", placeholder: "Search runs\u2026", value: searchInput, onChange: e => setSearchInput(e.target.value), className: "text-xs border border-neutral-200 rounded px-3 py-1.5 bg-white w-48" }), _jsx("button", { onClick: () => { dispatch(resetFilters()); setSearchInput(''); }, className: "text-xs text-neutral-500 hover:text-neutral-700 underline", children: "Reset" }), _jsx("div", { className: "flex-1" }), _jsxs("label", { className: "flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: autoRefreshEnabled, onChange: e => dispatch(setAutoRefresh(e.target.checked)) }), "Auto-refresh"] }), autoRefreshEnabled && (_jsxs("select", { value: autoRefreshIntervalMs, onChange: e => dispatch(setAutoRefreshInterval(Number(e.target.value))), className: "text-xs border border-neutral-200 rounded px-2 py-1 bg-white", children: [_jsx("option", { value: 10000, children: "10s" }), _jsx("option", { value: 30000, children: "30s" }), _jsx("option", { value: 60000, children: "1m" }), _jsx("option", { value: 300000, children: "5m" })] })), _jsx("button", { onClick: loadData, disabled: isLoading, className: "flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50", children: isLoading ? '⟳ Loading…' : '⟳ Refresh' }), lastRefreshedAt && (_jsxs("span", { className: "text-xs text-neutral-400", children: ["Last: ", lastRefreshed] }))] }), kpis && (_jsxs("div", { className: "px-4 py-3 grid grid-cols-4 xl:grid-cols-8 gap-3", children: [_jsx(KpiCard, { label: "Total Today", value: kpis.totalToday, color: "default", onClick: () => dispatch(setDateRange({ from: new Date().toISOString().slice(0, 10), to: null })) }), _jsx(KpiCard, { label: "Running Now", value: kpis.runningNow, color: kpis.runningNow > 0 ? 'green' : 'default', onClick: () => dispatch(setStatusFilter('RUNNING')) }), _jsx(KpiCard, { label: "Success Rate", value: `${kpis.successRateToday.toFixed(1)}%`, color: kpis.successRateToday >= 95 ? 'green' : kpis.successRateToday >= 80 ? 'amber' : 'red' }), _jsx(KpiCard, { label: "Failed Today", value: kpis.failedToday, color: kpis.failedToday > 0 ? 'red' : 'default', onClick: () => dispatch(setStatusFilter('FAILED')) }), _jsx(KpiCard, { label: "Avg Duration", value: fmtDuration(kpis.avgDurationMsToday), color: "default" }), _jsx(KpiCard, { label: "SLA Breaches", value: kpis.slaBreachesToday, color: kpis.slaBreachesToday > 0 ? 'red' : 'default' }), _jsx(KpiCard, { label: "Data Volume", value: `${kpis.dataVolumeGbToday.toFixed(1)} GB`, color: "default" })] })), selectedRunIds.length > 0 && (_jsxs("div", { className: "mx-4 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-3 text-xs", children: [_jsxs("span", { className: "font-medium text-blue-700", children: [selectedRunIds.length, " selected"] }), _jsx("button", { className: "text-blue-600 hover:underline", onClick: async () => {
                            await Promise.allSettled(selectedRunIds.map(id => api.retryPipelineRun(id)));
                            dispatch(clearSelection());
                            loadData();
                        }, children: "Retry" }), _jsx("button", { className: "text-blue-600 hover:underline", onClick: async () => {
                            await Promise.allSettled(selectedRunIds.map(id => api.cancelPipelineRun(id)));
                            dispatch(clearSelection());
                            loadData();
                        }, children: "Cancel" }), _jsx("button", { className: "text-blue-600 hover:underline", onClick: () => {
                            const csv = ['Run ID,Name,Status,Trigger,Started,Duration',
                                ...pipelineRuns.filter(r => selectedRunIds.includes(r.pipelineRunId)).map(r => [r.pipelineRunId, r.pipelineName, r.runStatus, r.triggerType, r.startDtm ?? '', r.durationMs ?? ''].join(','))
                            ].join('\n');
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'runs.csv';
                            a.click();
                            URL.revokeObjectURL(url);
                        }, children: "Export CSV" }), _jsx("button", { className: "text-neutral-500 hover:underline ml-auto", onClick: () => dispatch(clearSelection()), children: "Clear" })] })), _jsx("div", { className: "flex-1 overflow-auto px-4 pb-4", children: isLoading && (orchestratorRuns.length + pipelineRuns.length) === 0 ? (_jsx("div", { className: "flex items-center justify-center h-40 text-neutral-400 text-sm", children: "Loading executions\u2026" })) : (orchestratorRuns.length + pipelineRuns.length) === 0 ? (_jsx("div", { className: "flex items-center justify-center h-40 text-neutral-400 text-sm", children: "No executions match the current filters." })) : (_jsxs("table", { className: "w-full text-left bg-white rounded-lg shadow-sm overflow-hidden", children: [_jsx("thead", { className: "bg-neutral-50 border-b border-neutral-200", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 w-8", children: _jsx("input", { type: "checkbox", onChange: e => e.target.checked ? dispatch(selectAll()) : dispatch(clearSelection()), checked: selectedRunIds.length > 0 && selectedRunIds.length === (pipelineRuns.length + orchestratorRuns.length) }) }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Run ID" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Name" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Version" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Status" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Trigger" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Submitted By" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Started At" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Duration" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Rows" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Bytes In" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "Retries" }), _jsx("th", { className: "px-3 py-2 text-xs font-medium text-neutral-600", children: "SLA" })] }) }), _jsxs("tbody", { className: "divide-y divide-neutral-100", children: [orchestratorRuns.map(orch => (_jsx(OrchestratorRunRow, { run: orch, expanded: expandedOrchRunIds.includes(orch.orchRunId), selected: selectedRunIds.includes(orch.orchRunId), onToggle: () => dispatch(toggleOrchRunExpanded(orch.orchRunId)), onSelect: () => dispatch(toggleRunSelected(orch.orchRunId)), onOpen: () => openOrchestratorRun(orch), dispatch: dispatch, selectedRunIds: selectedRunIds }, orch.orchRunId))), pipelineRuns.map(run => (_jsx(PipelineRunRow, { run: run, selected: selectedRunIds.includes(run.pipelineRunId), onSelect: () => dispatch(toggleRunSelected(run.pipelineRunId)), onOpen: () => openPipelineRun(run) }, run.pipelineRunId)))] })] })) }), _jsxs("div", { className: "bg-white border-t border-neutral-200 px-4 py-2 flex items-center gap-3 text-xs text-neutral-600", children: [_jsxs("span", { children: [totalCount.toLocaleString(), " total"] }), _jsx("div", { className: "flex-1" }), _jsx("select", { value: pageSize, onChange: e => dispatch(setPageSize(Number(e.target.value))), className: "border border-neutral-200 rounded px-2 py-1 bg-white", children: [25, 50, 100, 250].map(n => _jsxs("option", { value: n, children: [n, " / page"] }, n)) }), _jsx("button", { onClick: () => dispatch(setPage(Math.max(1, page - 1))), disabled: page <= 1, className: "px-2 py-1 rounded border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50", children: "\u2039 Prev" }), _jsxs("span", { children: ["Page ", page, " of ", totalPages] }), _jsx("button", { onClick: () => dispatch(setPage(Math.min(totalPages, page + 1))), disabled: page >= totalPages, className: "px-2 py-1 rounded border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50", children: "Next \u203A" })] })] }));
}
