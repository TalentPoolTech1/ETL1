import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  summary: string;
  hasDiff: boolean;
}

const MOCK_ENTRIES: AuditEntry[] = [
  { id: 'a1', timestamp: '2026-03-02 14:20:01', user: 'alice@acme.com',   action: 'PIPELINE_SAVED',       summary: 'Saved pipeline v12 — added trim step to customer_name column.',           hasDiff: true  },
  { id: 'a2', timestamp: '2026-03-02 14:22:05', user: 'schedule-runner',  action: 'RUN_STARTED',          summary: 'Scheduled run started (run-001).',                                       hasDiff: false },
  { id: 'a3', timestamp: '2026-03-02 14:25:17', user: 'schedule-runner',  action: 'RUN_COMPLETED',        summary: 'Run run-001 completed successfully in 3m 12s.',                         hasDiff: false },
  { id: 'a4', timestamp: '2026-03-02 10:03:44', user: 'bob@acme.com',     action: 'PERMISSIONS_CHANGED',  summary: 'Added etl-service-account as Editor.',                                  hasDiff: true  },
  { id: 'a5', timestamp: '2026-03-01 17:55:12', user: 'alice@acme.com',   action: 'PIPELINE_SAVED',       summary: 'Saved pipeline v11 — updated JDBC source connection.',                  hasDiff: true  },
  { id: 'a6', timestamp: '2026-03-01 09:14:08', user: 'bob@acme.com',     action: 'PIPELINE_CLONED',      summary: 'Cloned from customer-etl-v2 to create this pipeline.',                  hasDiff: false },
];

const ACTION_STYLE: Record<string, string> = {
  PIPELINE_SAVED:      'bg-primary-100 text-primary-800',
  RUN_STARTED:         'bg-neutral-100 text-neutral-600',
  RUN_COMPLETED:       'bg-success-100 text-success-800',
  PERMISSIONS_CHANGED: 'bg-warning-100 text-warning-800',
  PIPELINE_CLONED:     'bg-purple-100  text-purple-800',
};

export function AuditLogsSubTab() {
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState<string | null>(null);

  const filtered = MOCK_ENTRIES.filter(e =>
    !search || e.user.includes(search) || e.action.includes(search) || e.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-white flex-shrink-0">
        <Input
          placeholder="Search by user, action, or summary…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-72"
        />
        <div className="flex-1" />
        <Button size="sm" variant="ghost">Export audit slice</Button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-neutral-200" />

          <div className="space-y-4">
            {filtered.map(entry => (
              <div key={entry.id} className="relative pl-12">
                {/* Dot */}
                <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-white border-2 border-neutral-300" />

                <div className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors">
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
                      <span className="text-success-400">+ steps: [trim, upper]</span>{'\n'}
                      <span className="text-danger-400">- steps: [trim]</span>{'\n'}
                      <span className="text-neutral-400">  targetEngine: "spark"</span>
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
