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
import { useAppDispatch } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';
import api from '@/services/api';
import type { PipelineRunSummary, RunStatus } from '@/types';

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
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium ${cfg.text} ${cfg.bg}`}>
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
      <label className="block text-[10px] text-slate-500 mb-1">{label}</label>
      {options ? (
        <select value={filters[field]} onChange={e => onChange({ [field]: e.target.value })}
          className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200 outline-none focus:border-blue-500">
          <option value="">All</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={filters[field]} onChange={e => onChange({ [field]: e.target.value })}
          className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200 outline-none focus:border-blue-500" />
      )}
    </div>
  );

  return (
    <div className="absolute top-full left-0 z-50 mt-1 w-80 bg-[#1a1d2e] border border-slate-700 rounded-lg shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold text-slate-300">Filters</span>
        <button onClick={() => onChange(INIT_FILTERS)} className="text-[11px] text-slate-500 hover:text-slate-300">Reset all</button>
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
  const [runs, setRuns]           = useState<PipelineRunSummary[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const [filters, setFilters]     = useState<Filters>(INIT_FILTERS);
  const [showFilters, setShow]    = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const filterRef                 = useRef<HTMLDivElement>(null);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPipelineRuns({
        pipelineId,
        status:      filters.status || undefined,
        search:      filters.search || undefined,
        triggerType: filters.triggerType || undefined,
        dateFrom:    filters.dateFrom || undefined,
        dateTo:      filters.dateTo || undefined,
        runBy:       filters.runBy || undefined,
        minDurationMs: filters.minDurationS ? String(Number(filters.minDurationS) * 1000) : undefined,
        maxDurationMs: filters.maxDurationS ? String(Number(filters.maxDurationS) * 1000) : undefined,
        minRows:     filters.minRows || undefined,
        page,
        pageSize,
      });
      const d = res.data.data ?? res.data;
      setRuns(Array.isArray(d) ? d : (d.items ?? []));
      setTotal(d.total ?? (Array.isArray(d) ? d.length : 0));
    } catch { setRuns([]); }
    finally { setLoading(false); }
  }, [pipelineId, filters, page]);

  useEffect(() => { load(); }, [load]);

  const openRun = (run: PipelineRunSummary) => dispatch(openTab({
    id: `execution-${run.pipelineRunId}`, type: 'execution',
    objectId: run.pipelineRunId,
    objectName: `${run.pipelineName} / ${run.pipelineRunId.slice(0, 8)}`,
    hierarchyPath: `Executions → ${run.pipelineName} → ${run.pipelineRunId.slice(0, 8)}`,
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
          <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Search run ID…"
            className="h-7 pl-7 pr-3 w-44 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-600" />
        </div>

        {/* Filter button */}
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
              <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{activeFilterCount}</span>
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

        <button onClick={load} className="flex items-center gap-1 h-7 px-2.5 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>

        <div className="flex-1" />

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-slate-500">{selected.size} selected</span>
            <button onClick={async () => {
              await Promise.allSettled([...selected].map(id => api.retryPipelineRun(id)));
              setSelected(new Set()); setTimeout(load, 800);
            }} className="flex items-center gap-1 h-6 px-2 bg-amber-700 hover:bg-amber-600 text-white rounded transition-colors">
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        <span className="text-[11px] text-slate-600">{total} total</span>

        <button onClick={handleExport}
          className="flex items-center gap-1 h-7 px-2.5 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[#0a0c15] z-10">
            <tr className="text-left text-[11px] text-slate-500 border-b border-slate-800">
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
              <tr><td colSpan={16} className="px-4 py-12 text-center text-slate-500 text-sm">Loading executions…</td></tr>
            )}
            {!loading && runs.length === 0 && (
              <tr><td colSpan={16} className="px-4 py-12 text-center text-slate-600 text-sm">No execution records match the current filters.</td></tr>
            )}
            {!loading && runs.map((row, i) => (
              <tr key={row.pipelineRunId}
                className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}
                onDoubleClick={() => openRun(row)}>
                <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(row.pipelineRunId)}
                    onChange={() => toggleSel(row.pipelineRunId)} className="accent-blue-500 w-3 h-3" />
                </td>
                <td className="px-3 py-1.5">
                  <button onClick={() => openRun(row)}
                    className="font-mono text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                    {row.pipelineRunId.slice(0, 12)}… <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </td>
                <td className="px-3 py-1.5"><StatusBadge status={row.runStatus} /></td>
                <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{fmtDt(row.startDtm)}</td>
                <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{fmtDt(row.endDtm)}</td>
                <td className="px-3 py-1.5 text-slate-300 font-mono">{fmtDur(row.durationMs)}</td>
                <td className="px-3 py-1.5 text-slate-400">{row.submittedBy ?? '—'}</td>
                <td className="px-3 py-1.5">
                  <span className="text-[11px] text-slate-500 capitalize">{row.triggerType.toLowerCase()}</span>
                </td>
                <td className="px-3 py-1.5 text-right text-slate-300 font-mono">{fmtNum(row.rowsProcessed)}</td>
                <td className="px-3 py-1.5 text-right text-emerald-400 font-mono">{row.runStatus === 'SUCCESS' ? fmtNum(row.rowsProcessed) : '—'}</td>
                <td className="px-3 py-1.5 text-right text-red-400 font-mono">{row.runStatus === 'FAILED' && row.rowsProcessed ? fmtNum(row.rowsProcessed) : '—'}</td>
                <td className="px-3 py-1.5 text-right text-slate-400 font-mono">{fmtBytes(row.bytesRead)}</td>
                <td className="px-3 py-1.5 text-slate-500 text-[11px]">—</td>
                <td className="px-3 py-1.5 text-slate-500 text-[11px] font-mono">{row.versionLabel}</td>
                <td className="px-3 py-1.5 text-center text-slate-400">{row.retryCount}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openRun(row)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">Details</button>
                    {(row.runStatus === 'FAILED' || row.runStatus === 'TIMED_OUT') && (
                      <button onClick={() => api.retryPipelineRun(row.pipelineRunId).then(() => setTimeout(load, 600))}
                        className="flex items-center gap-0.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors">
                        <RotateCcw className="w-2.5 h-2.5" /> Retry
                      </button>
                    )}
                    {row.runStatus === 'RUNNING' && (
                      <button onClick={() => api.cancelPipelineRun(row.pipelineRunId).then(() => setTimeout(load, 500))}
                        className="flex items-center gap-0.5 text-[11px] text-red-400 hover:text-red-300 transition-colors">
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

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-800 text-[11px] text-slate-500 flex-shrink-0 bg-[#0a0c15]">
        <span>{total.toLocaleString()} records</span>
        <div className="flex-1" />
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
          className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40 hover:bg-slate-800 transition-colors">‹</button>
        <span>Page {page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
          className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40 hover:bg-slate-800 transition-colors">›</button>
      </div>
    </div>
  );
}
