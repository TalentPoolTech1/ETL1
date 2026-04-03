import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';
import api from '@/services/api';

function fmtDur(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m/60)}h ${m%60}m`;
}

function fmtDt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const STATUS_STYLE: Record<string, string> = {
  SUCCESS:   'bg-emerald-900/30 text-emerald-300 border-emerald-800',
  FAILED:    'bg-red-900/30 text-red-300 border-red-800',
  RUNNING:   'bg-blue-900/30 text-blue-300 border-blue-800',
  CANCELLED: 'bg-orange-900/30 text-orange-300 border-orange-800',
  PENDING:   'bg-slate-800 text-slate-400 border-slate-700',
  QUEUED:    'bg-blue-900/20 text-blue-400 border-blue-800',
};

export function OrchestratorExecutionHistorySubTab({ orchId }: { orchId?: string }) {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
  const resolvedOrchId = orchId ?? activeTab?.objectId ?? '';

  const [runs, setRuns]         = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [page, setPage]         = useState(1);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getOrchestratorRuns({
        ...(resolvedOrchId ? { orchestratorId: resolvedOrchId } : {}),
        ...(status ? { status } : {}),
        page, pageSize,
      });
      const d = res.data?.data ?? res.data;
      setRuns(Array.isArray(d) ? d : (d.items ?? []));
      setTotal(d.total ?? (Array.isArray(d) ? d.length : 0));
    } catch { setRuns([]); }
    finally { setLoading(false); }
  }, [resolvedOrchId, status, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? runs.filter(r => r.orchRunId?.includes(search) || r.triggerType?.toLowerCase().includes(search.toLowerCase()))
    : runs;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const openRun = (runId: string, name: string) => dispatch(openTab({
    id: `execution-orch-${runId}`, type: 'execution',
    objectId: runId, objectName: `Orch Run: ${name}`,
    hierarchyPath: `Executions → ${name} → ${runId.slice(0,8)}`,
    unsaved: false, isDirty: false, executionKind: 'orchestrator',
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search run ID…"
            className="h-7 pl-7 pr-3 w-44 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 placeholder-slate-500 outline-none focus:border-blue-600" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 outline-none">
          <option value="">All statuses</option>
          {['SUCCESS','FAILED','RUNNING','CANCELLED','PENDING'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-1 h-7 px-2.5 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
        <div className="flex-1" />
        <span className="text-[12px] text-slate-400">{total} total</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[#0a0c15] z-10">
            <tr className="text-left text-[12px] text-slate-300 border-b border-slate-800">
              <th className="w-8 px-3 py-2" />
              {['Run ID','Status','Started','Ended','Duration','Trigger','Error'].map(h => (
                <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-300 text-sm">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No runs found.</td></tr>}
            {!loading && filtered.map((row, i) => (
              <tr key={row.orchRunId}
                className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}
                onDoubleClick={() => openRun(row.orchRunId, row.orchestratorName ?? 'Orchestrator')}>
                <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(row.orchRunId)} onChange={() => toggleSelect(row.orchRunId)} className="accent-blue-500 w-3 h-3" />
                </td>
                <td className="px-3 py-1.5">
                  <button onClick={() => openRun(row.orchRunId, row.orchestratorName ?? 'Orchestrator')}
                    className="font-mono text-[12px] text-blue-400 hover:underline">{row.orchRunId?.slice(0,12)}…</button>
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[12px] font-medium ${STATUS_STYLE[row.runStatus] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {row.runStatus}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-slate-400 text-[12px] whitespace-nowrap">{fmtDt(row.startDtm)}</td>
                <td className="px-3 py-1.5 text-slate-400 text-[12px] whitespace-nowrap">{fmtDt(row.endDtm)}</td>
                <td className="px-3 py-1.5 text-slate-300 font-mono">{fmtDur(row.durationMs)}</td>
                <td className="px-3 py-1.5 text-slate-300 text-[12px] capitalize">{row.triggerType?.toLowerCase()}</td>
                <td className="px-3 py-1.5 text-red-400 text-[12px] truncate max-w-[200px]" title={row.errorMessage ?? ''}>
                  {row.errorMessage ? row.errorMessage.slice(0,60) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-800 text-[12px] text-slate-300 flex-shrink-0 bg-[#0a0c15]">
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
          className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40 hover:bg-slate-800">‹</button>
        <span>Page {page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
          className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40 hover:bg-slate-800">›</button>
      </div>
    </div>
  );
}
