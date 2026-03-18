import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setScope, setProjectFilter, setStatusFilter, setTriggerTypeFilter,
  setDateRange, setSearch, setObjectType, setMyJobsOnly, resetFilters,
  setAutoRefresh, setAutoRefreshInterval, setLoading, setKpis,
  setPipelineRuns, setOrchestratorRuns, setPage, setPageSize,
  toggleOrchRunExpanded, toggleRunSelected, clearSelection, selectAll,
} from '@/store/slices/monitorSlice';
import { openTab } from '@/store/slices/tabsSlice';
import {
  MonitorScope, RunStatus, TriggerType,
  PipelineRunSummary, OrchestratorRunSummary, MonitorKpis,
} from '@/types';
import api from '@/services/api';
import { clearSelection as _clearSel } from '@/store/slices/monitorSlice';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<RunStatus, string> = {
  PENDING:              'bg-neutral-100 text-neutral-600',
  QUEUED:               'bg-blue-100 text-blue-700',
  RUNNING:              'bg-blue-200 text-blue-800 animate-pulse',
  SUCCESS:              'bg-green-100 text-green-700',
  FAILED:               'bg-red-100 text-red-700',
  CANCELLED:            'bg-orange-100 text-orange-700',
  SKIPPED:              'bg-neutral-100 text-neutral-500',
  RETRYING:             'bg-yellow-100 text-yellow-700 animate-pulse',
  TIMED_OUT:            'bg-red-200 text-red-900',
  PARTIALLY_COMPLETED:  'bg-amber-100 text-amber-700',
};

function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-neutral-100 text-neutral-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'default' | 'green' | 'amber' | 'red';
  onClick?: () => void;
}

function KpiCard({ label, value, sub, color = 'default', onClick }: KpiCardProps) {
  const border = color === 'green' ? 'border-l-4 border-green-500'
    : color === 'amber' ? 'border-l-4 border-amber-500'
    : color === 'red' ? 'border-l-4 border-red-500'
    : 'border-l-4 border-neutral-200';
  return (
    <div
      className={`bg-white rounded-lg shadow-sm p-4 ${border} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

// ─── Duration formatter ───────────────────────────────────────────────────────

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtNumber(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function fmtDatetime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// ─── Pipeline run row ─────────────────────────────────────────────────────────

interface PipelineRunRowProps {
  run: PipelineRunSummary;
  indent?: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

function PipelineRunRow({ run, indent, selected, onSelect, onOpen }: PipelineRunRowProps) {
  return (
    <tr
      className={`hover:bg-neutral-50 cursor-pointer ${selected ? 'bg-blue-50' : ''}`}
      onDoubleClick={onOpen}
    >
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()} />
      </td>
      <td className={`px-3 py-2 font-mono text-xs text-neutral-500 ${indent ? 'pl-10' : ''}`}>
        <span title={run.pipelineRunId}>{run.pipelineRunId.slice(0, 8)}…</span>
      </td>
      <td className="px-3 py-2 text-sm font-medium text-blue-700">
        <button className="hover:underline text-left" onDoubleClick={onOpen} onClick={onOpen}>
          {run.pipelineName}
        </button>
        {run.projectName && (
          <span className="ml-2 text-xs text-neutral-400">({run.projectName})</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-neutral-500">{run.versionLabel}</td>
      <td className="px-3 py-2"><StatusBadge status={run.runStatus} /></td>
      <td className="px-3 py-2 text-xs text-neutral-600">{run.triggerType}</td>
      <td className="px-3 py-2 text-xs text-neutral-600">{run.submittedBy ?? '—'}</td>
      <td className="px-3 py-2 text-xs text-neutral-600">{fmtDatetime(run.startDtm)}</td>
      <td className="px-3 py-2 text-xs text-neutral-600">{fmtDuration(run.durationMs)}</td>
      <td className="px-3 py-2 text-xs text-neutral-600">{fmtNumber(run.rowsProcessed)}</td>
      <td className="px-3 py-2 text-xs text-neutral-600">{fmtBytes(run.bytesRead)}</td>
      <td className="px-3 py-2 text-xs text-neutral-500">{run.retryCount > 0 ? run.retryCount : '—'}</td>
      <td className="px-3 py-2 text-xs">
        {run.slaStatus !== 'N_A' && (
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            run.slaStatus === 'BREACHED' ? 'bg-red-100 text-red-700' :
            run.slaStatus === 'AT_RISK' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }`}>{run.slaStatus.replace('_', ' ')}</span>
        )}
      </td>
    </tr>
  );
}

// ─── Orchestrator run row ─────────────────────────────────────────────────────

interface OrchestratorRunRowProps {
  run: OrchestratorRunSummary;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onOpen: () => void;
  dispatch: ReturnType<typeof useAppDispatch>;
  selectedRunIds: string[];
}

function OrchestratorRunRow({ run, expanded, selected, onToggle, onSelect, onOpen, dispatch, selectedRunIds }: OrchestratorRunRowProps) {
  return (
    <>
      <tr
        className={`hover:bg-neutral-50 bg-neutral-50 border-t border-neutral-200 cursor-pointer ${selected ? 'bg-blue-50' : ''}`}
        onDoubleClick={onOpen}
      >
        <td className="px-3 py-2">
          <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()} />
        </td>
        <td className="px-3 py-2 font-mono text-xs text-neutral-500">
          <button className="mr-1 text-neutral-400" onClick={onToggle}>{expanded ? '▼' : '▶'}</button>
          <span title={run.orchRunId}>{run.orchRunId.slice(0, 8)}…</span>
        </td>
        <td className="px-3 py-2 text-sm font-semibold text-indigo-700">
          <button className="hover:underline text-left" onDoubleClick={onOpen} onClick={onOpen}>
            ⚙ {run.orchestratorName}
          </button>
          {run.projectName && (
            <span className="ml-2 text-xs text-neutral-400">({run.projectName})</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-neutral-500">—</td>
        <td className="px-3 py-2"><StatusBadge status={run.runStatus} /></td>
        <td className="px-3 py-2 text-xs text-neutral-600">{run.triggerType}</td>
        <td className="px-3 py-2 text-xs text-neutral-500">—</td>
        <td className="px-3 py-2 text-xs text-neutral-600">{fmtDatetime(run.startDtm)}</td>
        <td className="px-3 py-2 text-xs text-neutral-600">{fmtDuration(run.durationMs)}</td>
        <td className="px-3 py-2 text-xs text-neutral-500" colSpan={4}>
          {run.pipelineRuns.length} pipeline{run.pipelineRuns.length !== 1 ? 's' : ''}
        </td>
      </tr>

      {expanded && run.pipelineRuns.map(pr => (
        <PipelineRunRow
          key={pr.pipelineRunId}
          run={pr}
          indent
          selected={selectedRunIds.includes(pr.pipelineRunId)}
          onSelect={() => dispatch(toggleRunSelected(pr.pipelineRunId))}
          onOpen={() => dispatch(openTab({
            id: `execution-${pr.pipelineRunId}`,
            type: 'execution',
            objectId: pr.pipelineRunId,
            objectName: `Run: ${pr.pipelineName}`,
            unsaved: false,
            isDirty: false,
            executionKind: 'pipeline',
          }))}
        />
      ))}
    </>
  );
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
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        dispatch(setKpis(kpiRes.value.data.data as MonitorKpis));
      }

      if (runsRes.status === 'fulfilled') {
        const data = runsRes.value.data.data;
        if (filters.objectType === 'orchestrator') {
          dispatch(setOrchestratorRuns({ runs: data.items ?? [], total: data.total ?? 0 }));
        } else {
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
        } catch { /* orchestrator endpoint may not exist yet */ }
      }
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, filters, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Auto-refresh ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if (autoRefreshEnabled) {
      autoRefreshRef.current = setInterval(loadData, autoRefreshIntervalMs);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefreshEnabled, autoRefreshIntervalMs, loadData]);

  // ─── Search debounce ───────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => dispatch(setSearch(searchInput)), 400);
    return () => clearTimeout(t);
  }, [searchInput, dispatch]);

  // ─── Open execution detail tab ────────────────────────────────────────────

  const openPipelineRun = (run: PipelineRunSummary) => {
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

  const openOrchestratorRun = (run: OrchestratorRunSummary) => {
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 flex flex-wrap items-center gap-3">

        {/* Scope filter */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-md p-0.5">
          {(['global', 'project'] as MonitorScope[]).map(s => (
            <button
              key={s}
              onClick={() => dispatch(setScope(s))}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filters.scope === s ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {s === 'global' ? 'Global' : 'Project'}
            </button>
          ))}
        </div>

        {/* Object type filter */}
        <select
          value={filters.objectType}
          onChange={e => dispatch(setObjectType(e.target.value as 'all' | 'pipeline' | 'orchestrator'))}
          className="text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white"
        >
          <option value="all">All types</option>
          <option value="pipeline">Pipelines only</option>
          <option value="orchestrator">Orchestrators only</option>
        </select>

        {/* Status filter */}
        <select
          value={filters.status ?? ''}
          onChange={e => dispatch(setStatusFilter((e.target.value || null) as RunStatus | null))}
          className="text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white"
        >
          <option value="">All statuses</option>
          {(['RUNNING', 'SUCCESS', 'FAILED', 'PENDING', 'QUEUED', 'CANCELLED', 'RETRYING', 'TIMED_OUT', 'PARTIALLY_COMPLETED'] as RunStatus[]).map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Trigger type filter */}
        <select
          value={filters.triggerType ?? ''}
          onChange={e => dispatch(setTriggerTypeFilter((e.target.value || null) as TriggerType | null))}
          className="text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white"
        >
          <option value="">All triggers</option>
          {(['MANUAL', 'SCHEDULED', 'API', 'ORCHESTRATOR'] as TriggerType[]).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={e => dispatch(setDateRange({ from: e.target.value || null, to: filters.dateTo }))}
          className="text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white"
          title="From date"
        />
        <span className="text-xs text-neutral-400">to</span>
        <input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={e => dispatch(setDateRange({ from: filters.dateFrom, to: e.target.value || null }))}
          className="text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white"
          title="To date"
        />

        {/* My jobs toggle */}
        <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.myJobsOnly}
            onChange={e => dispatch(setMyJobsOnly(e.target.checked))}
          />
          My jobs only
        </label>

        {/* Search */}
        <input
          type="search"
          placeholder="Search runs…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="text-xs border border-neutral-200 rounded px-3 py-1.5 bg-white w-48"
        />

        {/* Reset */}
        <button
          onClick={() => { dispatch(resetFilters()); setSearchInput(''); }}
          className="text-xs text-neutral-500 hover:text-neutral-700 underline"
        >
          Reset
        </button>

        <div className="flex-1" />

        {/* Auto-refresh */}
        <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={e => dispatch(setAutoRefresh(e.target.checked))}
          />
          Auto-refresh
        </label>

        {autoRefreshEnabled && (
          <select
            value={autoRefreshIntervalMs}
            onChange={e => dispatch(setAutoRefreshInterval(Number(e.target.value)))}
            className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white"
          >
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>
        )}

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? '⟳ Loading…' : '⟳ Refresh'}
        </button>

        {lastRefreshedAt && (
          <span className="text-xs text-neutral-400">Last: {lastRefreshed}</span>
        )}
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      {kpis && (
        <div className="px-4 py-3 grid grid-cols-4 xl:grid-cols-8 gap-3">
          <KpiCard label="Total Today"       value={kpis.totalToday}  color="default" onClick={() => dispatch(setDateRange({ from: new Date().toISOString().slice(0,10), to: null }))} />
          <KpiCard label="Running Now"       value={kpis.runningNow}  color={kpis.runningNow > 0 ? 'green' : 'default'} onClick={() => dispatch(setStatusFilter('RUNNING'))} />
          <KpiCard label="Success Rate"      value={`${kpis.successRateToday.toFixed(1)}%`} color={kpis.successRateToday >= 95 ? 'green' : kpis.successRateToday >= 80 ? 'amber' : 'red'} />
          <KpiCard label="Failed Today"      value={kpis.failedToday} color={kpis.failedToday > 0 ? 'red' : 'default'} onClick={() => dispatch(setStatusFilter('FAILED'))} />
          <KpiCard label="Avg Duration"      value={fmtDuration(kpis.avgDurationMsToday)} color="default" />
          <KpiCard label="SLA Breaches"      value={kpis.slaBreachesToday} color={kpis.slaBreachesToday > 0 ? 'red' : 'default'} />
          <KpiCard label="Data Volume"       value={`${kpis.dataVolumeGbToday.toFixed(1)} GB`} color="default" />
        </div>
      )}

      {/* ── Bulk action bar ───────────────────────────────────────────────────── */}
      {selectedRunIds.length > 0 && (
        <div className="mx-4 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-3 text-xs">
          <span className="font-medium text-blue-700">{selectedRunIds.length} selected</span>
          <button className="text-blue-600 hover:underline" onClick={async () => {
            await Promise.allSettled(selectedRunIds.map(id => api.retryPipelineRun(id)));
            dispatch(clearSelection());
            loadData();
          }}>Retry</button>
          <button className="text-blue-600 hover:underline" onClick={async () => {
            await Promise.allSettled(selectedRunIds.map(id => api.cancelPipelineRun(id)));
            dispatch(clearSelection());
            loadData();
          }}>Cancel</button>
          <button className="text-blue-600 hover:underline" onClick={() => {
            const csv = ['Run ID,Name,Status,Trigger,Started,Duration',
              ...pipelineRuns.filter(r => selectedRunIds.includes(r.pipelineRunId)).map(r =>
                [r.pipelineRunId, r.pipelineName, r.runStatus, r.triggerType, r.startDtm ?? '', r.durationMs ?? ''].join(',')
              )
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'runs.csv'; a.click();
            URL.revokeObjectURL(url);
          }}>Export CSV</button>
          <button className="text-neutral-500 hover:underline ml-auto" onClick={() => dispatch(clearSelection())}>Clear</button>
        </div>
      )}

      {/* ── Execution grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {isLoading && (orchestratorRuns.length + pipelineRuns.length) === 0 ? (
          <div className="flex items-center justify-center h-40 text-neutral-400 text-sm">Loading executions…</div>
        ) : (orchestratorRuns.length + pipelineRuns.length) === 0 ? (
          <div className="flex items-center justify-center h-40 text-neutral-400 text-sm">No executions match the current filters.</div>
        ) : (
          <table className="w-full text-left bg-white rounded-lg shadow-sm overflow-hidden">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    onChange={e => e.target.checked ? dispatch(selectAll()) : dispatch(clearSelection())}
                    checked={selectedRunIds.length > 0 && selectedRunIds.length === (pipelineRuns.length + orchestratorRuns.length)}
                  />
                </th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Run ID</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Name</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Version</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Status</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Trigger</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Submitted By</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Started At</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Duration</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Rows</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Bytes In</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">Retries</th>
                <th className="px-3 py-2 text-xs font-medium text-neutral-600">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">

              {/* Orchestrator runs */}
              {orchestratorRuns.map(orch => (
                <OrchestratorRunRow
                  key={orch.orchRunId}
                  run={orch}
                  expanded={expandedOrchRunIds.includes(orch.orchRunId)}
                  selected={selectedRunIds.includes(orch.orchRunId)}
                  onToggle={() => dispatch(toggleOrchRunExpanded(orch.orchRunId))}
                  onSelect={() => dispatch(toggleRunSelected(orch.orchRunId))}
                  onOpen={() => openOrchestratorRun(orch)}
                  dispatch={dispatch}
                  selectedRunIds={selectedRunIds}
                />
              ))}

              {/* Standalone pipeline runs */}
              {pipelineRuns.map(run => (
                <PipelineRunRow
                  key={run.pipelineRunId}
                  run={run}
                  selected={selectedRunIds.includes(run.pipelineRunId)}
                  onSelect={() => dispatch(toggleRunSelected(run.pipelineRunId))}
                  onOpen={() => openPipelineRun(run)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-neutral-200 px-4 py-2 flex items-center gap-3 text-xs text-neutral-600">
        <span>{totalCount.toLocaleString()} total</span>
        <div className="flex-1" />
        <select
          value={pageSize}
          onChange={e => dispatch(setPageSize(Number(e.target.value)))}
          className="border border-neutral-200 rounded px-2 py-1 bg-white"
        >
          {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button
          onClick={() => dispatch(setPage(Math.max(1, page - 1)))}
          disabled={page <= 1}
          className="px-2 py-1 rounded border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50"
        >
          ‹ Prev
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          onClick={() => dispatch(setPage(Math.min(totalPages, page + 1)))}
          disabled={page >= totalPages}
          className="px-2 py-1 rounded border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
