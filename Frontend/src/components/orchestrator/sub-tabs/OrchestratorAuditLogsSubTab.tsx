import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import api from '@/services/api';

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  summary: string;
  hasDiff: boolean;
}

const ACTION_STYLE: Record<string, string> = {
  ORCHESTRATOR_SAVED:    'bg-primary-100 text-primary-800',
  ORCHESTRATOR_CREATED:  'bg-purple-100  text-purple-800',
  RUN_STARTED:           'bg-neutral-100 text-neutral-600',
  RUN_COMPLETED:         'bg-success-100 text-success-800',
  PERMISSIONS_CHANGED:   'bg-warning-100 text-warning-800',
};

function downloadText(filename: string, content: string, contentType = 'text/plain') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function OrchestratorAuditLogsSubTab({ orchId }: { orchId: string }) {
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orchId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getOrchestratorAuditLogs(orchId, { limit: 200, offset: 0 });
      const payload = (res.data as any)?.data ?? (res.data as any)?.rows ?? [];
      setRows(Array.isArray(payload) ? payload : []);
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to load audit logs');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [orchId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(e =>
      String(e.user ?? '').toLowerCase().includes(s) ||
      String(e.action ?? '').toLowerCase().includes(s) ||
      String(e.summary ?? '').toLowerCase().includes(s)
    );
  }, [rows, search]);

  const exportSlice = () => {
    const header = ['id', 'timestamp', 'user', 'action', 'summary'].join(',');
    const csv = [header, ...filtered.map(e => [
      e.id,
      e.timestamp,
      e.user,
      e.action,
      (e.summary ?? '').replace(/"/g, '""'),
    ].map(v => `"${String(v ?? '')}"`).join(','))].join('\n');
    downloadText(`orchestrator-audit-${orchId}.csv`, csv, 'text/csv');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-[#161b25] flex-shrink-0">
        <Input
          placeholder="Search by user, action, or summary…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-72"
        />
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={load} disabled={isLoading}>
          Refresh
        </Button>
        <Button size="sm" variant="ghost" onClick={exportSlice} disabled={filtered.length === 0}>
          Export audit slice
        </Button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <div className="mb-3 p-3 rounded border border-danger-200 bg-danger-50 text-danger-700 text-sm">
            {error}
          </div>
        )}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-neutral-200" />

          <div className="space-y-4">
            {isLoading && filtered.length === 0 && (
              <div className="pl-12 text-sm text-neutral-400 py-8 text-center">
                Loading audit entries…
              </div>
            )}

            {filtered.map(entry => (
              <div key={entry.id} className="relative pl-12">
                {/* Dot */}
                <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-[#161b25] border-2 border-slate-700" />

                <div className="bg-[#161b25] border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLE[entry.action] ?? 'bg-neutral-100 text-neutral-600'}`}>
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-neutral-500">{entry.user}</span>
                        <span className="text-xs text-neutral-400">{entry.timestamp}</span>
                      </div>
                      <p className="text-sm text-neutral-700 mt-2">{entry.summary}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {entry.hasDiff && (
                        <button
                          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          {expanded === entry.id ? 'Hide diff' : 'View diff'}
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded === entry.id && (
                    <div className="mt-3 p-3 bg-neutral-900 rounded text-xs font-mono text-neutral-200 whitespace-pre overflow-x-auto">
                      No diff available.
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="pl-12 text-sm text-neutral-400 py-8 text-center">
                No audit entries match the current filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
