import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
const MOCK_ENTRIES = [
    { id: 'a1', timestamp: '2026-03-02 14:10:01', user: 'alice@acme.com', action: 'ORCHESTRATOR_SAVED', summary: 'Saved orchestrator — added load-data-warehouse pipeline to DAG.', hasDiff: true },
    { id: 'a2', timestamp: '2026-03-02 14:20:05', user: 'schedule-runner', action: 'RUN_STARTED', summary: 'Scheduled run started (orch-run-001).', hasDiff: false },
    { id: 'a3', timestamp: '2026-03-02 14:33:17', user: 'schedule-runner', action: 'RUN_COMPLETED', summary: 'Run orch-run-001 completed successfully in 12m 34s (4 pipelines).', hasDiff: false },
    { id: 'a4', timestamp: '2026-03-02 10:03:44', user: 'bob@acme.com', action: 'PERMISSIONS_CHANGED', summary: 'Added etl-service-account as Editor.', hasDiff: true },
    { id: 'a5', timestamp: '2026-03-01 17:55:12', user: 'alice@acme.com', action: 'ORCHESTRATOR_SAVED', summary: 'Saved orchestrator — updated retry policy on transform-orders.', hasDiff: true },
    { id: 'a6', timestamp: '2026-03-01 09:14:08', user: 'bob@acme.com', action: 'ORCHESTRATOR_CREATED', summary: 'Orchestrator created from scratch.', hasDiff: false },
];
const ACTION_STYLE = {
    ORCHESTRATOR_SAVED: 'bg-primary-100 text-primary-800',
    ORCHESTRATOR_CREATED: 'bg-purple-100  text-purple-800',
    RUN_STARTED: 'bg-neutral-100 text-neutral-600',
    RUN_COMPLETED: 'bg-success-100 text-success-800',
    PERMISSIONS_CHANGED: 'bg-warning-100 text-warning-800',
};
export function OrchestratorAuditLogsSubTab() {
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);
    const filtered = MOCK_ENTRIES.filter(e => !search || e.user.includes(search) || e.action.includes(search) || e.summary.toLowerCase().includes(search.toLowerCase()));
    return (_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-white flex-shrink-0", children: [_jsx(Input, { placeholder: "Search by user, action, or summary\u2026", value: search, onChange: e => setSearch(e.target.value), className: "w-72" }), _jsx("div", { className: "flex-1" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Export audit slice" })] }), _jsx("div", { className: "flex-1 overflow-y-auto px-6 py-4", children: _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute left-4 top-2 bottom-2 w-px bg-neutral-200" }), _jsxs("div", { className: "space-y-4", children: [filtered.map(entry => (_jsxs("div", { className: "relative pl-12", children: [_jsx("div", { className: "absolute left-2.5 top-2 w-3 h-3 rounded-full bg-white border-2 border-neutral-300" }), _jsxs("div", { className: "bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLE[entry.action] ?? 'bg-neutral-100 text-neutral-600'}`, children: entry.action.replace(/_/g, ' ') }), _jsx("span", { className: "text-xs text-neutral-500", children: entry.user }), _jsx("span", { className: "text-xs text-neutral-400", children: entry.timestamp })] }), _jsx("p", { className: "text-sm text-neutral-700 mt-2", children: entry.summary })] }), _jsx("div", { className: "flex items-center gap-2 flex-shrink-0", children: entry.hasDiff && (_jsx("button", { onClick: () => setExpanded(expanded === entry.id ? null : entry.id), className: "text-xs text-primary-600 hover:underline", children: expanded === entry.id ? 'Hide diff' : 'View diff' })) })] }), expanded === entry.id && (_jsxs("div", { className: "mt-3 p-3 bg-neutral-900 rounded text-xs font-mono text-neutral-200 whitespace-pre overflow-x-auto", children: [_jsx("span", { className: "text-success-400", children: "+ pipelines: [ingest, transform, aggregate, load]" }), '\n', _jsx("span", { className: "text-danger-400", children: "- pipelines: [ingest, transform, aggregate]" }), '\n', _jsx("span", { className: "text-neutral-400", children: "  schedule: \"0 22 * * *\"" })] }))] })] }, entry.id))), filtered.length === 0 && (_jsx("div", { className: "pl-12 text-sm text-neutral-400 py-8 text-center", children: "No audit entries match the current filter." }))] })] }) })] }));
}
