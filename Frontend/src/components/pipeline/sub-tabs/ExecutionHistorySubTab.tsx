/**
 * ExecutionHistorySubTab — v2 spec compliant
 * Columns: ID, Name, Status, Start, End, Duration, Run By, Trigger,
 *          Rows Processed, Rows Output, Rows Failed, Data Volume,
 *          Environment, Version, Retry Count
 * Filters: date range, status, user, trigger type, duration, rows
 * Actions: open Execution tab (metalink), retry, cancel
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  RefreshCw, Filter, Download, Calendar, Search,
  Play, XCircle, RotateCcw, ExternalLink, ChevronDown,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';
import api from '@/services/api';
import type { PipelineRunSummary, RunStatus } from '@/types';
import { ExecutionDetailTab } from '@/components/monitor/ExecutionDetailTab';
import { formatExecutionHierarchyPath, formatExecutionTabName } from '@/utils/executionLabels';

// ─── Status icon + badge ──────────────────────────────────────────────────

export type ExecStatus = RunStatus;

const STATUS_CFG: Record<ExecStatus, { label: string; dot: string; text: string; bg: string }> = {
  PENDING:             { label: 'Pending',           dot: 'bg-slate-500',   text: 'text-slate-300',  bg: 'bg-slate-800/60 border-slate-700' },
  QUEUED:              { label: 'Queued',             dot: 'bg-blue-400',    text: 'text-blue-300',   bg: 'bg-blue-900/30 border-blue-800' },
  RUNNING:             { label: 'Running',            dot: 'bg-blue-400 animate-pulse', text: 'text-blue-300',   bg: 'bg-blue-900/30 border-blue-800' },
  SUCCESS:             { label: 'Success',            dot: 'bg-emerald-400', text: 'text-emerald-300',bg: 'bg-emerald-900/30 border-emerald-800' },
  FAILED:              { label: 'Failed',             dot: 'bg-red-400',     text: 'text-red-300',    bg: 'bg-red-900/30 border-red-800' },
  CANCELLED:           { label: 'Cancelled',          dot: 'bg-orange-400',  text: 'text-orange-300', bg: 'bg-orange-900/30 border-orange-800' },
  SKIPPED:             { label: 'Skipped',            dot: 'bg-slate-500',   text: 'text-slate-400',  bg: 'bg-slate-800/40 border-slate-700' },
  RETRYING:            { label: 'Retrying',           dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300',  bg: 'bg-amber-900/30 border-amber-800' },
  TIMED_OUT:           { label: 'Timed Out',          dot: 'bg-red-500',     text: 'text-red-300',    bg: 'bg-red-900/40 border-red-800' },
  PARTIALLY_COMPLETED: { label: 'Partial',            dot: 'bg-amber-400',   text: 'text-amber-300',  bg: 'bg-amber-900/30 border-amber-800' },
};

function StatusBadge({ status }: { status: ExecStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[12px] font-medium ${cfg.text} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmtDur(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtNum(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtBytes(b: number | null): string {
  if (b === null) return '—';
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtDt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function normalizePipelineExecutionFallbackRow(
  row: Record<string, unknown>,
  pipelineNameFallback: string,
  pipelineIdFallback: string,
): PipelineRunSummary {
  const startDtm = typeof row['start_dtm'] === 'string'
    ? row['start_dtm']
    : (typeof row['created_dtm'] === 'string' ? row['created_dtm'] : null);
  const endDtm = typeof row['end_dtm'] === 'string' ? row['end_dtm'] : null;
  const durationMs = startDtm && endDtm
    ? Math.max(0, new Date(endDtm).getTime() - new Date(startDtm).getTime())
    : null;

  return {
    pipelineRunId: String(row['pipeline_run_id'] ?? ''),
    pipelineName: String(row['pipeline_name'] ?? pipelineNameFallback ?? '').trim(),
    pipelineId: String(row['pipeline_id'] ?? pipelineIdFallback ?? '').trim(),
    projectId: null,
    projectName: null,
    versionLabel: '',
    runStatus: (row['run_status_code'] as RunStatus) ?? 'PENDING',
    triggerType: (row['trigger_type_code'] as PipelineRunSummary['triggerType']) ?? 'MANUAL',
    submittedBy: null,
    startDtm,
    endDtm,
    durationMs,
    rowsProcessed: null,
    bytesRead: null,
    bytesWritten: null,
    errorCategory: null,
    retryCount: 0,
    slaStatus: 'N_A',
    tags: [],
  };
}

function matchesFilters(run: PipelineRunSummary, filters: Filters): boolean {
  if (filters.status && run.runStatus !== filters.status) return false;
  if (filters.triggerType && run.triggerType !== filters.triggerType) return false;

  const searchable = [
    run.pipelineRunId,
    run.pipelineName,
    run.submittedBy ?? '',
  ].join(' ').toLowerCase();

  if (filters.search && !searchable.includes(filters.search.toLowerCase())) return false;
  if (filters.runBy && !(run.submittedBy ?? '').toLowerCase().includes(filters.runBy.toLowerCase())) return false;

  const startedAt = run.startDtm ? new Date(run.startDtm) : null;
  if (filters.dateFrom && startedAt) {
    const dateFrom = new Date(`${filters.dateFrom}T00:00:00`);
    if (startedAt < dateFrom) return false;
  }
  if (filters.dateTo && startedAt) {
    const dateTo = new Date(`${filters.dateTo}T23:59:59.999`);
    if (startedAt > dateTo) return false;
  }

  if (filters.minDurationS) {
    const minDurationMs = Number(filters.minDurationS) * 1000;
    if ((run.durationMs ?? 0) < minDurationMs) return false;
  }
  if (filters.maxDurationS) {
    const maxDurationMs = Number(filters.maxDurationS) * 1000;
    if ((run.durationMs ?? 0) > maxDurationMs) return false;
  }
  if (filters.minRows) {
    const minRows = Number(filters.minRows);
    if ((run.rowsProcessed ?? 0) < minRows) return false;
  }

  return true;
}

// ─── Filter panel ─────────────────────────────────────────────────────────

interface Filters {
  search: string;
  status: RunStatus | '';
  triggerType: string;
  dateFrom: string;
  dateTo: string;
  runBy: string;
  minDurationS: string;
  maxDurationS: string;
  minRows: string;
}

const INIT_FILTERS: Filters = {
  search: '', status: '', triggerType: '', dateFrom: '', dateTo: '',
  runBy: '', minDurationS: '', maxDurationS: '', minRows: '',
};

function FilterPanel({ filters, onChange, onClose }: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  onClose: () => void;
}) {
  const F = ({ label, field, type = 'text', options }: {
    label: string; field: keyof Filters; type?: string; options?: string[];
  }) => (
    <div>
      <label className="block text-[12px] text-slate-300 mb-1">{label}</label>
      {options ? (
        <select value={filters[field]} onChange={e => onChange({ [field]: e.target.value })}
          className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500">
          <option value="">All</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={filters[field]} onChange={e => onChange({ [field]: e.target.value })}
          className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      )}
    </div>
  );

  return (
    <div className="absolute top-full left-0 z-50 mt-1 w-80 bg-[#1a1d2e] border border-slate-700 rounded-lg shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold text-slate-300">Filters</span>
        <button onClick={() => onChange(INIT_FILTERS)} className="text-[12px] text-slate-300 hover:text-slate-300">Reset all</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F label="Status" field="status"
          options={['SUCCESS','FAILED','RUNNING','CANCELLED','PENDING','TIMED_OUT','RETRYING','PARTIALLY_COMPLETED']} />
        <F label="Trigger Type" field="triggerType" options={['MANUAL','SCHEDULED','API','ORCHESTRATOR']} />
        <F label="Date From" field="dateFrom" type="date" />
        <F label="Date To" field="dateTo" type="date" />
        <F label="Run By" field="runBy" />
        <F label="Min Rows" field="minRows" type="number" />
        <F label="Min Duration (s)" field="minDurationS" type="number" />
        <F label="Max Duration (s)" field="maxDurationS" type="number" />
      </div>
      <button onClick={onClose}
        className="mt-3 w-full h-7 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors">
        Apply
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

interface Props { pipelineId: string; }

export function ExecutionHistorySubTab({ pipelineId }: Props) {
  const dispatch = useAppDispatch();
  const activePipelineName = useAppSelector(state => state.pipeline.activePipeline?.name ?? '');
  const [runs, setRuns]           = useState<PipelineRunSummary[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage]           = useState(1);
  const [filters, setFilters]     = useState<Filters>(INIT_FILTERS);
  const [showFilters, setShow]    = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [leftPaneWidth, setLeftPaneWidth] = useState(680);
  const [isResizing, setIsResizing] = useState(false);
  const filterRef                 = useRef<HTMLDivElement>(null);
  const containerRef              = useRef<HTMLDivElement>(null);
  const resizeStartXRef           = useRef(0);
  const resizeStartWidthRef       = useRef(680);
  const pageSize = 50;
  const isDev = import.meta.env.DEV;

  const clampLeftPaneWidth = useCallback((nextWidth: number) => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const minLeftWidth = 460;
    const minRightWidth = 460;

    if (containerWidth <= 0) {
      return Math.max(minLeftWidth, nextWidth);
    }

    const maxLeftWidth = Math.max(minLeftWidth, containerWidth - minRightWidth);
    return Math.min(Math.max(nextWidth, minLeftWidth), maxLeftWidth);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    if (isDev) {
      console.debug('[Pipeline Executions] load:start', {
        pipelineId,
        page,
        pageSize,
        filters,
      });
    }
    try {
      const res = await api.getPipelineExecutions(pipelineId, { limit: 200 });
      const executionRows = Array.isArray(res.data?.executions) ? res.data.executions : [];
      const normalizedRows = executionRows
        .map((row: Record<string, unknown>) => normalizePipelineExecutionFallbackRow(row, activePipelineName, pipelineId))
        .filter((run: PipelineRunSummary) => matchesFilters(run, filters));
      const offset = (page - 1) * pageSize;
      const pagedRuns = normalizedRows.slice(offset, offset + pageSize);

      setRuns(pagedRuns);
      setTotal(normalizedRows.length);
      if (isDev) {
        console.debug('[Pipeline Executions] load:success', {
          pipelineId,
          count: pagedRuns.length,
          total: normalizedRows.length,
        });
      }
      setSelectedRunId(prev => (
        prev && pagedRuns.some((run: PipelineRunSummary) => run.pipelineRunId === prev)
          ? prev
          : null
      ));
    } catch (error) {
      if (isDev) {
        console.error('[Pipeline Executions] load:error', {
          pipelineId,
          error,
        });
      }
      setLoadError((error as { response?: { data?: { userMessage?: string; error?: string } }; message?: string })?.response?.data?.userMessage
        ?? (error as { response?: { data?: { userMessage?: string; error?: string } }; message?: string })?.response?.data?.error
        ?? (error as { message?: string })?.message
        ?? 'Failed to load execution history.');
      setRuns([]);
      setTotal(0);
    }
    finally { setLoading(false); }
  }, [activePipelineName, filters, isDev, page, pipelineId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleWindowResize = () => {
      setLeftPaneWidth(prev => clampLeftPaneWidth(prev));
    };

    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [clampLeftPaneWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - resizeStartXRef.current;
      setLeftPaneWidth(clampLeftPaneWidth(resizeStartWidthRef.current + delta));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, clampLeftPaneWidth]);

  const openRun = (run: PipelineRunSummary) => dispatch(openTab({
    id: `execution-${run.pipelineRunId}`, type: 'execution',
    objectId: run.pipelineRunId,
    objectName: formatExecutionTabName(run.pipelineName, run.pipelineRunId),
    hierarchyPath: formatExecutionHierarchyPath(run.pipelineName, run.pipelineRunId),
    unsaved: false, isDirty: false, executionKind: 'pipeline',
  }));

  const toggleSel = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Active filter count
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && v !== '').length;

  const handleExport = () => {
    const csv = [
      ['Run ID','Status','Start','End','Duration','Trigger','Run By','Rows In','Rows Out','Data Volume','Env','Version','Retries'].join(','),
      ...runs.map(r => [
        r.pipelineRunId, r.runStatus,
        r.startDtm ?? '', r.endDtm ?? '',
        r.durationMs ? String(Math.floor(r.durationMs / 1000)) + 's' : '',
        r.triggerType, r.submittedBy ?? '',
        r.rowsProcessed ?? '', '', // rows out not in type
        r.bytesRead ? fmtBytes(r.bytesRead) : '',
        '', r.versionLabel, String(r.retryCount),
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `executions_${pipelineId}.csv`; a.click();
  };

  const handleRefresh = async () => {
    if (isDev) {
      console.debug('[Pipeline Executions] refresh:click', { pipelineId });
    }
    await load();
    setRefreshToken(prev => prev + 1);
    setLastRefreshedAt(new Date());
    if (isDev) {
      console.debug('[Pipeline Executions] refresh:done', { pipelineId });
    }
  };

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = leftPaneWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setIsResizing(true);
  };

  const lastRefreshLabel = lastRefreshedAt
    ? lastRefreshedAt.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <div className="flex-1 min-h-0 flex">
        <div
          style={{ width: `${leftPaneWidth}px` }}
          className="min-w-0 shrink-0 flex flex-col overflow-hidden"
        >
          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder="Search run ID…"
                className="h-7 pl-7 pr-3 w-44 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 placeholder-slate-500 outline-none focus:border-blue-600" />
            </div>

            <div className="relative" ref={filterRef}>
              <button onClick={() => setShow(v => !v)}
                className={`flex items-center gap-1.5 h-7 px-3 rounded border text-[12px] transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-blue-900/40 border-blue-700 text-blue-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}>
                <Filter className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[12px] font-bold">{activeFilterCount}</span>
                )}
              </button>
              {showFilters && (
                <FilterPanel
                  filters={filters}
                  onChange={patch => setFilters(f => ({ ...f, ...patch }))}
                  onClose={() => setShow(false)}
                />
              )}
            </div>

            <button onClick={handleRefresh} className="flex items-center gap-1 h-7 px-2.5 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing…' : 'Refresh'}
            </button>

            <div className="flex-1" />

            {selected.size > 0 && (
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-slate-300">{selected.size} selected</span>
                <button onClick={async () => {
                  await Promise.allSettled([...selected].map(id => api.retryPipelineRun(id)));
                  setSelected(new Set()); setTimeout(load, 800);
                }} className="flex items-center gap-1 h-6 px-2 bg-amber-700 hover:bg-amber-600 text-white rounded transition-colors">
                  <RotateCcw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}

            {lastRefreshLabel && (
              <span className="text-[12px] text-slate-400">Updated {lastRefreshLabel}</span>
            )}

            <span className="text-[12px] text-slate-400">{total} total</span>

            <button onClick={handleExport}
              className="flex items-center gap-1 h-7 px-2.5 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>

          {/* ── Table ───────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto min-h-0">
            <table className="min-w-[1180px] w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[#0a0c15] z-10">
            <tr className="text-left text-[12px] text-slate-300 border-b border-slate-800">
              <th className="w-8 px-3 py-2"><input type="checkbox" className="accent-blue-500 w-3 h-3"
                onChange={e => setSelected(e.target.checked ? new Set(runs.map(r => r.pipelineRunId)) : new Set())} /></th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Execution ID</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Start Time</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">End Time</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Duration</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Run By</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Trigger</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Rows In</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Rows Out</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Rows Failed</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-right">Data Vol</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Env</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Version</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap text-center">Retries</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={16} className="px-4 py-12 text-center text-slate-300 text-sm">Loading executions…</td></tr>
            )}
            {!loading && loadError && (
              <tr><td colSpan={16} className="px-4 py-12 text-center text-red-300 text-sm">Failed to load executions: {loadError}</td></tr>
            )}
            {!loading && !loadError && runs.length === 0 && (
              <tr><td colSpan={16} className="px-4 py-12 text-center text-slate-400 text-sm">No execution records match the current filters.</td></tr>
            )}
            {!loading && runs.map((row, i) => (
              <tr key={row.pipelineRunId}
                className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer ${selectedRunId === row.pipelineRunId ? 'bg-blue-950/20' : i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}
                onClick={() => setSelectedRunId(row.pipelineRunId)}
                onDoubleClick={() => openRun(row)}>
                <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(row.pipelineRunId)}
                    onChange={() => toggleSel(row.pipelineRunId)} className="accent-blue-500 w-3 h-3" />
                </td>
                <td className="px-3 py-1.5">
                  <button onClick={() => openRun(row)}
                    className="font-mono text-[12px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                    {row.pipelineRunId.slice(0, 12)}… <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </td>
                <td className="px-3 py-1.5"><StatusBadge status={row.runStatus} /></td>
                <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{fmtDt(row.startDtm)}</td>
                <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{fmtDt(row.endDtm)}</td>
                <td className="px-3 py-1.5 text-slate-300 font-mono">{fmtDur(row.durationMs)}</td>
                <td className="px-3 py-1.5 text-slate-400">{row.submittedBy ?? '—'}</td>
                <td className="px-3 py-1.5">
                  <span className="text-[12px] text-slate-300 capitalize">{row.triggerType.toLowerCase()}</span>
                </td>
                <td className="px-3 py-1.5 text-right text-slate-300 font-mono">{fmtNum(row.rowsProcessed)}</td>
                <td className="px-3 py-1.5 text-right text-emerald-400 font-mono">{row.runStatus === 'SUCCESS' ? fmtNum(row.rowsProcessed) : '—'}</td>
                <td className="px-3 py-1.5 text-right text-red-400 font-mono">{row.runStatus === 'FAILED' && row.rowsProcessed ? fmtNum(row.rowsProcessed) : '—'}</td>
                <td className="px-3 py-1.5 text-right text-slate-300 font-mono">{fmtBytes(row.bytesRead)}</td>
                <td className="px-3 py-1.5 text-slate-400 text-[12px]">—</td>
                <td className="px-3 py-1.5 text-slate-300 text-[12px] font-mono">{row.versionLabel}</td>
                <td className="px-3 py-1.5 text-center text-slate-300">{row.retryCount}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openRun(row)}
                      className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors">Open Tab</button>
                    {(row.runStatus === 'FAILED' || row.runStatus === 'TIMED_OUT') && (
                      <button onClick={() => api.retryPipelineRun(row.pipelineRunId).then(() => setTimeout(load, 600))}
                        className="flex items-center gap-0.5 text-[12px] text-amber-400 hover:text-amber-300 transition-colors">
                        <RotateCcw className="w-2.5 h-2.5" /> Retry
                      </button>
                    )}
                    {row.runStatus === 'RUNNING' && (
                      <button onClick={() => api.cancelPipelineRun(row.pipelineRunId).then(() => setTimeout(load, 500))}
                        className="flex items-center gap-0.5 text-[12px] text-red-400 hover:text-red-300 transition-colors">
                        <XCircle className="w-2.5 h-2.5" /> Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-800 text-[12px] text-slate-400 flex-shrink-0 bg-[#0a0c15]">
            <span>{total.toLocaleString()} records</span>
            <div className="flex-1" />
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40 hover:bg-slate-800 transition-colors">‹</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40 hover:bg-slate-800 transition-colors">›</button>
          </div>
        </div>

        <div
          onMouseDown={handleResizeStart}
          className={`w-1.5 flex-shrink-0 cursor-col-resize transition-colors ${
            isResizing ? 'bg-blue-500' : 'bg-slate-800 hover:bg-blue-600'
          }`}
        />

        <div className="flex-1 min-w-[460px] min-h-0 flex overflow-hidden">
          {selectedRunId ? (
            <ExecutionDetailTab
              runId={selectedRunId}
              executionKind="pipeline"
              initialSubTab="logs"
              refreshToken={refreshToken}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-sm text-slate-300 bg-[#0d0f1a]">
              Select an execution to inspect logs, code, and run details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
