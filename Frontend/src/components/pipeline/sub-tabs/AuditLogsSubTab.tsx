/**
 * Pipeline > Audit Logs sub-tab — dark theme
 */
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import api from '@/services/api';

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  summary: string;
  diffJson?: unknown;
}

const ACTION_BADGE: Record<string, string> = {
  PIPELINE_SAVED:      'bg-blue-900/60 text-blue-300 border-blue-700',
  RUN_STARTED:         'bg-slate-700/60 text-slate-300 border-slate-600',
  RUN_COMPLETED:       'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  RUN_FAILED:          'bg-red-900/60 text-red-300 border-red-700',
  PERMISSIONS_CHANGED: 'bg-amber-900/60 text-amber-300 border-amber-700',
  PIPELINE_CLONED:     'bg-violet-900/60 text-violet-300 border-violet-700',
  PIPELINE_CREATED:    'bg-teal-900/60 text-teal-300 border-teal-700',
  PIPELINE_DELETED:    'bg-red-900/60 text-red-300 border-red-700',
};

interface Props { pipelineId: string; }

export function AuditLogsSubTab({ pipelineId }: Props) {
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await api.getPipelineAuditLogs(pipelineId, { limit: 100 });
      setEntries(res.data?.data ?? res.data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e =>
    !search ||
    e.user?.toLowerCase().includes(search.toLowerCase()) ||
    e.action?.toLowerCase().includes(search.toLowerCase()) ||
    e.summary?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCsv = () => {
    const rows = [['Timestamp', 'User', 'Action', 'Summary']];
    filtered.forEach(e => rows.push([e.timestamp, e.user, e.action, e.summary]));
    const blob = new Blob([rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `pipeline-audit-${pipelineId.slice(0, 8)}.csv`; a.click();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0f1a]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0 bg-[#0a0c15]">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by user, action or summary…"
          className="h-8 w-72 px-3 rounded bg-[#1e2035] border border-slate-600 text-slate-200 text-[12px]
                     placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
        />
        <button onClick={load}
          className="h-8 px-2.5 rounded border border-slate-700 bg-[#1e2035] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 text-[12px]">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <div className="flex-1" />
        <button onClick={exportCsv}
          className="h-8 px-2.5 rounded border border-slate-700 bg-[#1e2035] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 text-[12px]">
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="text-[13px] text-slate-500 py-10 text-center">Loading audit log…</div>
        )}
        {!loading && (
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-800" />
            <div className="space-y-3">
              {filtered.length === 0 && (
                <div className="pl-12 text-[13px] text-slate-600 py-10 text-center">
                  {entries.length === 0 ? 'No audit entries recorded yet.' : 'No entries match filter.'}
                </div>
              )}
              {filtered.map(entry => (
                <div key={entry.id} className="relative pl-12">
                  <div className="absolute left-[9px] top-3 w-2.5 h-2.5 rounded-full bg-[#0d0f1a] border-2 border-slate-700" />
                  <div className="bg-[#13152a] border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold tracking-wide ${ACTION_BADGE[entry.action] ?? 'bg-slate-800/60 text-slate-400 border-slate-700'}`}>
                            {(entry.action ?? '').replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-slate-400">{entry.user}</span>
                          <span className="text-[11px] text-slate-600 font-mono">
                            {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-300 mt-1.5">{entry.summary}</p>
                      </div>
                      {entry.diffJson && (
                        <button
                          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 flex-shrink-0 transition-colors">
                          {expanded === entry.id ? 'Hide diff' : 'View diff'}
                        </button>
                      )}
                    </div>
                    {expanded === entry.id && entry.diffJson && (
                      <pre className="mt-2.5 p-3 bg-[#0a0c15] rounded border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre overflow-x-auto">
                        {JSON.stringify(entry.diffJson, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
