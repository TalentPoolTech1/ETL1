import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import api from '@/services/api';

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  summary: string;
  diffJson?: unknown;
}

const ACTION_STYLE: Record<string, string> = {
  PIPELINE_SAVED:      'bg-primary-100 text-primary-800',
  RUN_STARTED:         'bg-neutral-100 text-neutral-600',
  RUN_COMPLETED:       'bg-success-100 text-success-800',
  RUN_FAILED:          'bg-danger-100 text-danger-800',
  PERMISSIONS_CHANGED: 'bg-warning-100 text-warning-800',
  PIPELINE_CLONED:     'bg-purple-100  text-purple-800',
};

interface Props { pipelineId: string; }

export function AuditLogsSubTab({ pipelineId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await api.getPipelineAuditLogs(pipelineId);
      const data = res.data.data ?? res.data;
      setEntries(data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e =>
    !search || e.user?.includes(search) || e.action?.includes(search) ||
    e.summary?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-white flex-shrink-0">
        <Input placeholder="Search by user, action, or summary…" value={search}
          onChange={e => setSearch(e.target.value)} className="w-72" />
        <button onClick={load} className="text-xs text-neutral-500 hover:text-neutral-700 border border-neutral-300 px-2 py-1.5 rounded">⟳ Refresh</button>
        <div className="flex-1" />
        <Button size="sm" variant="ghost">Export audit slice</Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && <div className="text-sm text-neutral-400 py-8 text-center">Loading audit log…</div>}

        {!loading && (
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-neutral-200" />
            <div className="space-y-4">
              {filtered.length === 0 && (
                <div className="pl-12 text-sm text-neutral-400 py-8 text-center">
                  {entries.length === 0 ? 'No audit entries recorded yet.' : 'No entries match the current filter.'}
                </div>
              )}
              {filtered.map(entry => (
                <div key={entry.id} className="relative pl-12">
                  <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-white border-2 border-neutral-300" />
                  <div className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLE[entry.action] ?? 'bg-neutral-100 text-neutral-600'}`}>
                            {(entry.action ?? '').replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-neutral-500">{entry.user}</span>
                          <span className="text-xs text-neutral-400">{entry.timestamp}</span>
                        </div>
                        <p className="text-sm text-neutral-700 mt-2">{entry.summary}</p>
                      </div>
                      {entry.diffJson && (
                        <button onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                          className="text-xs text-primary-600 hover:underline flex-shrink-0">
                          {expanded === entry.id ? 'Hide diff' : 'View diff'}
                        </button>
                      )}
                    </div>
                    {expanded === entry.id && entry.diffJson && (
                      <pre className="mt-3 p-3 bg-neutral-900 rounded text-xs font-mono text-neutral-200 whitespace-pre overflow-x-auto">
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
