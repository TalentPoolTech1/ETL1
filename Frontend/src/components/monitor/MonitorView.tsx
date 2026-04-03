import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setScope, setProjectFilter, setStatusFilter, setTriggerTypeFilter,
  setDateRange, setSearch, setObjectType, setMyJobsOnly, resetFilters,
  setAutoRefresh, setAutoRefreshInterval, setLoading, setKpis,
  setPipelineRuns, setOrchestratorRuns, setPage, setPageSize,
  toggleOrchRunExpanded, toggleRunSelected, clearSelection, setSelectedRuns,
} from '@/store/slices/monitorSlice';
import { openTab } from '@/store/slices/tabsSlice';
import {
  MonitorScope, RunStatus, TriggerType,
  PipelineRunSummary, OrchestratorRunSummary, MonitorKpis,
} from '@/types';
import api from '@/services/api';
import { formatExecutionTabName } from '@/utils/executionLabels';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<RunStatus, string> = {
  PENDING:              'bg-slate-800 text-slate-300',
  QUEUED:               'bg-blue-900/30 text-blue-400',
  RUNNING:              'bg-blue-900/50 text-blue-300 animate-pulse',
  SUCCESS:              'bg-green-900/30 text-green-400',
  FAILED:               'bg-red-900/30 text-red-400',
  CANCELLED:            'bg-orange-900/30 text-orange-400',
  SKIPPED:              'bg-slate-800 text-slate-400',
  RETRYING:             'bg-yellow-900/30 text-yellow-400 animate-pulse',
  TIMED_OUT:            'bg-red-900/50 text-red-300',
  PARTIALLY_COMPLETED:  'bg-amber-900/30 text-amber-400',
};

function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-slate-800 text-slate-300'}`}>
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
    : 'border-l-4 border-slate-600';
  return (
    <div
      className={`bg-slate-800/60 rounded-lg p-4 border border-slate-700/50 ${border} ${onClick ? 'cursor-pointer hover:bg-slate-800 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
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

type MonitorSortKey =
  | 'start_desc'
  | 'start_asc'
  | 'job_asc'
  | 'job_desc'
  | 'user_asc'
  | 'user_desc'
  | 'run_desc'
  | 'run_asc';

function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' });
}

function sortableTime(iso: string | null | undefined): number {
  if (!iso) return 0;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortPipelineRunList(runs: PipelineRunSummary[], sortBy: MonitorSortKey): PipelineRunSummary[] {
  return [...runs].sort((left, right) => {
    switch (sortBy) {
      case 'start_asc':
        return sortableTime(left.startDtm) - sortableTime(right.startDtm);
      case 'job_asc':
        return compareText(left.pipelineName, right.pipelineName);
      case 'job_desc':
        return compareText(right.pipelineName, left.pipelineName);
      case 'user_asc':
        return compareText(left.submittedBy, right.submittedBy);
      case 'user_desc':
        return compareText(right.submittedBy, left.submittedBy);
      case 'run_asc':
        return compareText(left.pipelineRunId, right.pipelineRunId);
      case 'run_desc':
        return compareText(right.pipelineRunId, left.pipelineRunId);
      case 'start_desc':
      default:
        return sortableTime(right.startDtm) - sortableTime(left.startDtm);
    }
  });
}

function sortOrchestratorRunList(runs: OrchestratorRunSummary[], sortBy: MonitorSortKey): OrchestratorRunSummary[] {
  return [...runs].sort((left, right) => {
    switch (sortBy) {
      case 'start_asc':
        return sortableTime(left.startDtm) - sortableTime(right.startDtm);
      case 'job_asc':
        return compareText(left.orchestratorName, right.orchestratorName);
      case 'job_desc':
        return compareText(right.orchestratorName, left.orchestratorName);
      case 'user_asc':
        return compareText(left.submittedBy, right.submittedBy);
      case 'user_desc':
        return compareText(right.submittedBy, left.submittedBy);
      case 'run_asc':
        return compareText(left.orchRunId, right.orchRunId);
      case 'run_desc':
        return compareText(right.orchRunId, left.orchRunId);
      case 'start_desc':
      default:
        return sortableTime(right.startDtm) - sortableTime(left.startDtm);
    }
  });
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
      className={`hover:bg-slate-800/60 cursor-pointer border-b border-slate-700/40 ${selected ? 'bg-blue-900/20' : ''}`}
      onDoubleClick={onOpen}
    >
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()} />
      </td>
      <td className={`px-3 py-2 font-mono text-xs text-slate-400 ${indent ? 'pl-10' : ''}`}>
        <span title={run.pipelineRunId}>{run.pipelineRunId.slice(0, 8)}…</span>
      </td>
      <td className="px-3 py-2 text-sm font-medium text-blue-400">
        <button className="hover:underline text-left" onDoubleClick={onOpen} onClick={onOpen}>
          {run.pipelineName}
        </button>
        {run.projectName && (
          <span className="ml-2 text-xs text-slate-400">({run.projectName})</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-400">{run.versionLabel}</td>
      <td className="px-3 py-2"><StatusBadge status={run.runStatus} /></td>
      <td className="px-3 py-2 text-xs text-slate-300">{run.triggerType}</td>
      <td className="px-3 py-2 text-xs text-slate-300">{run.submittedBy ?? '—'}</td>
      <td className="px-3 py-2 text-xs text-slate-300">{fmtDatetime(run.startDtm)}</td>
      <td className="px-3 py-2 text-xs text-slate-300">{fmtDuration(run.durationMs)}</td>
      <td className="px-3 py-2 text-xs text-slate-300">{fmtNumber(run.rowsProcessed)}</td>
      <td className="px-3 py-2 text-xs text-slate-300">{fmtBytes(run.bytesRead)}</td>
      <td className="px-3 py-2 text-xs text-slate-400">{run.retryCount > 0 ? run.retryCount : '—'}</td>
      <td className="px-3 py-2 text-xs">
        {run.slaStatus !== 'N_A' && (
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            run.slaStatus === 'BREACHED' ? 'bg-red-900/30 text-red-400' :
            run.slaStatus === 'AT_RISK' ? 'bg-amber-900/30 text-amber-400' : 'bg-green-900/30 text-green-400'
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
        className={`hover:bg-slate-800/60 bg-slate-800/30 border-t border-slate-700/40 cursor-pointer ${selected ? 'bg-blue-900/20' : ''}`}
        onDoubleClick={onOpen}
      >
        <td className="px-3 py-2">
          <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()} />
        </td>
        <td className="px-3 py-2 font-mono text-xs text-slate-400">
          <button className="mr-1 text-slate-300" onClick={onToggle}>{expanded ? '▼' : '▶'}</button>
          <span title={run.orchRunId}>{run.orchRunId.slice(0, 8)}…</span>
        </td>
        <td className="px-3 py-2 text-sm font-semibold text-indigo-400">
          <button className="hover:underline text-left" onDoubleClick={onOpen} onClick={onOpen}>
            ⚙ {run.orchestratorName}
          </button>
          {run.projectName && (
            <span className="ml-2 text-xs text-slate-400">({run.projectName})</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-slate-400">—</td>
        <td className="px-3 py-2"><StatusBadge status={run.runStatus} /></td>
        <td className="px-3 py-2 text-xs text-slate-300">{run.triggerType}</td>
        <td className="px-3 py-2 text-xs text-slate-300">{run.submittedBy ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-slate-300">{fmtDatetime(run.startDtm)}</td>
        <td className="px-3 py-2 text-xs text-slate-300">{fmtDuration(run.durationMs)}</td>
        <td className="px-3 py-2 text-xs text-slate-400" colSpan={4}>
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
            objectName: formatExecutionTabName(pr.pipelineName, pr.pipelineRunId),
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
  const projects = useAppSelector(s => s.projects.projects);
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

  const [searchInput, setSearchInput] = useState(filters.search);
  const [submittedByInput, setSubmittedByInput] = useState('');
  const [sortBy, setSortBy] = useState<MonitorSortKey>('start_desc');
  const [pipelineTotal, setPipelineTotal] = useState(0);
  const [orchestratorTotal, setOrchestratorTotal] = useState(0);
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
      const [kpiRes, pipelineRes, orchRes] = await Promise.allSettled([
        api.getMonitorKpis(params),
        filters.objectType === 'orchestrator'
          ? Promise.resolve(null)
          : api.getPipelineRuns(params),
        filters.objectType === 'pipeline'
          ? Promise.resolve(null)
          : api.getOrchestratorRuns(params),
      ]);

      if (kpiRes.status === 'fulfilled') {
        dispatch(setKpis(kpiRes.value.data.data as MonitorKpis));
      }

      if (pipelineRes.status === 'fulfilled' && pipelineRes.value) {
        const data = pipelineRes.value.data.data;
        dispatch(setPipelineRuns({ runs: data.items ?? [], total: data.total ?? 0 }));
        setPipelineTotal(data.total ?? 0);
      } else {
        dispatch(setPipelineRuns({ runs: [], total: 0 }));
        setPipelineTotal(0);
      }

      if (orchRes.status === 'fulfilled' && orchRes.value) {
        const data = orchRes.value.data.data;
        dispatch(setOrchestratorRuns({
          runs: data.items ?? [],
          total: data.total ?? 0,
        }));
        setOrchestratorTotal(data.total ?? 0);
      } else {
        dispatch(setOrchestratorRuns({ runs: [], total: 0 }));
        setOrchestratorTotal(0);
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
      objectName: formatExecutionTabName(run.pipelineName, run.pipelineRunId),
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

  const normalizedSubmittedBy = submittedByInput.trim().toLowerCase();

  const visiblePipelineRuns = useMemo(() => {
    const filtered = pipelineRuns.filter(run =>
      !normalizedSubmittedBy || String(run.submittedBy ?? '').toLowerCase().includes(normalizedSubmittedBy),
    );
    return sortPipelineRunList(filtered, sortBy);
  }, [normalizedSubmittedBy, pipelineRuns, sortBy]);

  const visibleOrchestratorRuns = useMemo(() => {
    const filtered = orchestratorRuns.filter(run =>
      !normalizedSubmittedBy || String(run.submittedBy ?? '').toLowerCase().includes(normalizedSubmittedBy),
    );
    return sortOrchestratorRunList(filtered, sortBy);
  }, [normalizedSubmittedBy, orchestratorRuns, sortBy]);
  const visiblePipelineRunIdSet = useMemo(() => new Set(visiblePipelineRuns.map(run => run.pipelineRunId)), [visiblePipelineRuns]);
  const visibleOrchestratorRunIdSet = useMemo(() => new Set(visibleOrchestratorRuns.map(run => run.orchRunId)), [visibleOrchestratorRuns]);

  const effectiveTotalCount = filters.objectType === 'pipeline'
    ? pipelineTotal
    : filters.objectType === 'orchestrator'
      ? orchestratorTotal
      : pipelineTotal + orchestratorTotal;
  const visibleTotalCount = visiblePipelineRuns.length + visibleOrchestratorRuns.length;
  const totalCountForPagination = normalizedSubmittedBy ? visibleTotalCount : effectiveTotalCount;
  const totalPages = Math.max(1, Math.ceil(totalCountForPagination / pageSize));
  const lastRefreshed = lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : 'never';
  const activeObjectLabel = filters.objectType === 'orchestrator' ? 'Active Orchestrators' : 'Active Pipelines';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0f1117]">

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#161b25] border-b border-slate-700/60 px-4 py-3 flex flex-wrap items-center gap-3">

        {/* Scope filter */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-md p-0.5">
          {(['global', 'project'] as MonitorScope[]).map(s => (
            <button
              key={s}
              onClick={() => dispatch(setScope(s))}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filters.scope === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s === 'global' ? 'Global' : 'Project'}
            </button>
          ))}
        </div>

        <select
          value={filters.projectId ?? ''}
          onChange={e => dispatch(setProjectFilter(e.target.value || null))}
          disabled={filters.scope !== 'project'}
          className="text-xs border border-slate-600 rounded px-2 py-1.5 bg-slate-800 text-white disabled:opacity-50"
        >
          <option value="">Select project…</option>
          {projects.map(project => (
            <option key={project.projectId} value={project.projectId}>
              {project.projectDisplayName}
            </option>
          ))}
        </select>

        {/* Object type filter */}
        <select
          value={filters.objectType}
          onChange={e => dispatch(setObjectType(e.target.value as 'all' | 'pipeline' | 'orchestrator'))}
          className="text-xs border border-slate-600 rounded px-2 py-1.5 bg-slate-800 text-white"
        >
          <option value="all">All types</option>
          <option value="pipeline">Pipelines only</option>
          <option value="orchestrator">Orchestrators only</option>
        </select>

        {/* Status filter */}
        <select
          value={filters.status ?? ''}
          onChange={e => dispatch(setStatusFilter((e.target.value || null) as RunStatus | null))}
          className="text-xs border border-slate-600 rounded px-2 py-1.5 bg-slate-800 text-white"
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
          className="text-xs border border-slate-600 rounded px-2 py-1.5 bg-slate-800 text-white"
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
          className="text-xs border border-slate-600 rounded px-2 py-1.5 bg-slate-800 text-white"
          title="From date"
        />
        <span className="text-xs text-slate-400">to</span>
        <input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={e => dispatch(setDateRange({ from: filters.dateFrom, to: e.target.value || null }))}
          className="text-xs border border-slate-600 rounded px-2 py-1.5 bg-slate-800 text-white"
          title="To date"
        />

        {/* My jobs toggle */}
        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
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
          placeholder="Search run / job…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="text-xs border border-slate-600 rounded px-3 py-1.5 bg-slate-800 text-white placeholder-slate-500 w-48"
        />

        <input
          type="search"
          placeholder="Filter by user…"
          value={submittedByInput}
          onChange={e => setSubmittedByInput(e.target.value)}
          className="text-xs border border-slate-600 rounded px-3 py-1.5 bg-slate-800 text-white placeholder-slate-500 w-40"
          title="Filters visible runs by submitted user"
        />

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as MonitorSortKey)}
          className="text-xs border border-slate-600 rounded px-2 py-1.5 bg-slate-800 text-white"
        >
          <option value="start_desc">Start Date ↓</option>
          <option value="start_asc">Start Date ↑</option>
          <option value="job_asc">Job Name A-Z</option>
          <option value="job_desc">Job Name Z-A</option>
          <option value="user_asc">User A-Z</option>
          <option value="user_desc">User Z-A</option>
          <option value="run_desc">Run ID ↓</option>
          <option value="run_asc">Run ID ↑</option>
        </select>

        {/* Reset */}
        <button
          onClick={() => { dispatch(resetFilters()); setSearchInput(''); setSubmittedByInput(''); setSortBy('start_desc'); }}
          className="text-xs text-slate-400 hover:text-white underline"
        >
          Reset
        </button>

        <div className="flex-1" />

        {/* Auto-refresh */}
        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
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
            className="text-xs border border-slate-600 rounded px-2 py-1 bg-slate-800 text-white"
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
          <span className="text-xs text-slate-400">Last: {lastRefreshed}</span>
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
          <KpiCard label={activeObjectLabel} value={kpis.activePipelines} color="default" />
        </div>
      )}

      {/* ── Bulk action bar ───────────────────────────────────────────────────── */}
      {selectedRunIds.length > 0 && (
        <div className="mx-4 mb-2 px-3 py-2 bg-blue-900/20 border border-blue-700/40 rounded-md flex items-center gap-3 text-xs">
          <span className="font-medium text-blue-400">{selectedRunIds.length} selected</span>
          <button className="text-blue-400 hover:underline" onClick={async () => {
            const pipelineIds = selectedRunIds.filter(id => visiblePipelineRunIdSet.has(id));
            const orchestratorIds = selectedRunIds.filter(id => visibleOrchestratorRunIdSet.has(id));
            await Promise.allSettled([
              ...pipelineIds.map(id => api.retryPipelineRun(id)),
              ...orchestratorIds.map(id => api.retryOrchestratorRun(id)),
            ]);
            dispatch(clearSelection());
            loadData();
          }}>Retry</button>
          <button className="text-blue-400 hover:underline" onClick={async () => {
            const pipelineIds = selectedRunIds.filter(id => visiblePipelineRunIdSet.has(id));
            const orchestratorIds = selectedRunIds.filter(id => visibleOrchestratorRunIdSet.has(id));
            await Promise.allSettled([
              ...pipelineIds.map(id => api.cancelPipelineRun(id)),
              ...orchestratorIds.map(id => api.cancelOrchestratorRun(id)),
            ]);
            dispatch(clearSelection());
            loadData();
          }}>Cancel</button>
          <button className="text-blue-400 hover:underline" onClick={() => {
            const csv = ['Type,Run ID,Name,Status,Trigger,Submitted By,Started,Duration',
              ...visibleOrchestratorRuns.filter(r => selectedRunIds.includes(r.orchRunId)).map(r =>
                ['orchestrator', r.orchRunId, r.orchestratorName, r.runStatus, r.triggerType, r.submittedBy ?? '', r.startDtm ?? '', r.durationMs ?? ''].join(',')
              ),
              ...visiblePipelineRuns.filter(r => selectedRunIds.includes(r.pipelineRunId)).map(r =>
                ['pipeline', r.pipelineRunId, r.pipelineName, r.runStatus, r.triggerType, r.submittedBy ?? '', r.startDtm ?? '', r.durationMs ?? ''].join(',')
              )
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'runs.csv'; a.click();
            URL.revokeObjectURL(url);
          }}>Export CSV</button>
          <button className="text-slate-400 hover:text-white ml-auto" onClick={() => dispatch(clearSelection())}>Clear</button>
        </div>
      )}

      {/* ── Execution grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {isLoading && (visibleOrchestratorRuns.length + visiblePipelineRuns.length) === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading executions…</div>
        ) : (visibleOrchestratorRuns.length + visiblePipelineRuns.length) === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No executions match the current filters.</div>
        ) : (
          <table className="w-full text-left bg-[#161b25] rounded-lg overflow-hidden border border-slate-700/50">
            <thead className="bg-slate-800/60 border-b border-slate-700/60">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    onChange={e => e.target.checked
                      ? dispatch(setSelectedRuns([
                          ...visibleOrchestratorRuns.map(run => run.orchRunId),
                          ...visiblePipelineRuns.map(run => run.pipelineRunId),
                        ]))
                      : dispatch(clearSelection())}
                    checked={selectedRunIds.length > 0 && selectedRunIds.length === (visiblePipelineRuns.length + visibleOrchestratorRuns.length)}
                  />
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Run ID</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Name</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Version</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Status</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Trigger</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Submitted By</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Started At</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Duration</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Rows</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Bytes In</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">Retries</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">SLA</th>
              </tr>
            </thead>
            <tbody>

              {/* Orchestrator runs */}
              {visibleOrchestratorRuns.map(orch => (
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
              {visiblePipelineRuns.map(run => (
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
      <div className="bg-[#161b25] border-t border-slate-700/60 px-4 py-2 flex items-center gap-3 text-xs text-slate-300">
        <span>{totalCountForPagination.toLocaleString()} total</span>
        <div className="flex-1" />
        <select
          value={pageSize}
          onChange={e => dispatch(setPageSize(Number(e.target.value)))}
          className="border border-slate-600 rounded px-2 py-1 bg-slate-800 text-white"
        >
          {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button
          onClick={() => dispatch(setPage(Math.max(1, page - 1)))}
          disabled={page <= 1}
          className="px-2 py-1 rounded border border-slate-600 text-slate-300 disabled:opacity-40 hover:bg-slate-800"
        >
          ‹ Prev
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          onClick={() => dispatch(setPage(Math.min(totalPages, page + 1)))}
          disabled={page >= totalPages}
          className="px-2 py-1 rounded border border-slate-600 text-slate-300 disabled:opacity-40 hover:bg-slate-800"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
