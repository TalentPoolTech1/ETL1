import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
const RUN_STATUS_COLOR = {
    success: 'bg-success-100 text-success-800',
    failed: 'bg-danger-100  text-danger-800',
    running: 'bg-primary-100 text-primary-800',
    pending: 'bg-warning-100 text-warning-800',
    cancelled: 'bg-neutral-100 text-neutral-600',
};
const MOCK_RUNS = [
    { id: 'orch-run-001', start: '2026-03-02 14:20', duration: '12m 34s', status: 'success', triggeredBy: 'schedule' },
    { id: 'orch-run-002', start: '2026-03-02 10:00', duration: '9m 18s', status: 'failed', triggeredBy: 'manual' },
    { id: 'orch-run-003', start: '2026-03-01 22:00', duration: '11m 52s', status: 'success', triggeredBy: 'schedule' },
    { id: 'orch-run-004', start: '2026-03-01 18:30', duration: '—', status: 'running', triggeredBy: 'api' },
    { id: 'orch-run-005', start: '2026-03-01 10:00', duration: '—', status: 'pending', triggeredBy: 'manual' },
];
const MOCK_PIPELINES = [
    { id: 'p-1', name: 'ingest-customers', status: 'active' },
    { id: 'p-2', name: 'transform-orders', status: 'active' },
    { id: 'p-3', name: 'aggregate-daily-kpis', status: 'active' },
    { id: 'p-4', name: 'load-data-warehouse', status: 'draft' },
];
export function OrchestratorOverviewSubTab() {
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState('daily-etl-orchestrator');
    const [draftDesc, setDraftDesc] = useState('Orchestrates the daily ETL batch across customer, order, and KPI pipelines.');
    const successRate = Math.round((MOCK_RUNS.filter(r => r.status === 'success').length / MOCK_RUNS.filter(r => r.status !== 'pending' && r.status !== 'running').length) * 100);
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsx("div", { className: "flex-1 min-w-0", children: editing ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Input, { value: draftName, onChange: e => setDraftName(e.target.value), placeholder: "Orchestrator name", className: "text-xl font-semibold" }), _jsx("textarea", { value: draftDesc, onChange: e => setDraftDesc(e.target.value), placeholder: "Description", rows: 2, className: "w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", onClick: () => setEditing(false), children: "Save" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setEditing(false), children: "Cancel" })] })] })) : (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h2", { className: "text-xl font-semibold text-neutral-900 truncate", children: draftName }), _jsx("button", { onClick: () => setEditing(true), className: "text-neutral-400 hover:text-neutral-600 text-xs", children: "\u270E" })] }), _jsx("p", { className: "text-sm text-neutral-500 mt-0.5", children: draftDesc || _jsx("span", { className: "italic", children: "No description" }) })] })) }), _jsxs("div", { className: "flex gap-2 flex-shrink-0", children: [_jsx(Button, { size: "sm", children: "\u25B6 Run" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Schedule" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Clone" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Export" })] })] }), _jsx("div", { className: "grid grid-cols-4 gap-4", children: [
                    { label: 'Pipelines', value: MOCK_PIPELINES.length },
                    { label: 'Success rate', value: `${successRate}%` },
                    { label: 'Last run', value: MOCK_RUNS[0]?.start ?? '—' },
                    { label: 'Schedule', value: 'Daily 22:00 UTC' },
                ].map(stat => (_jsxs("div", { className: "bg-neutral-50 border border-neutral-200 rounded-lg p-4", children: [_jsx("div", { className: "text-2xl font-bold text-neutral-900", children: stat.value }), _jsx("div", { className: "text-xs text-neutral-500 mt-1", children: stat.label })] }, stat.label))) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-700 mb-3", children: "Pipelines in this orchestrator" }), _jsx("div", { className: "border border-neutral-200 rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-neutral-50", children: _jsx("tr", { children: ['Pipeline', 'Status', ''].map(h => (_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-neutral-500", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-neutral-100", children: MOCK_PIPELINES.map(p => (_jsxs("tr", { className: "hover:bg-neutral-50 transition-colors", children: [_jsx("td", { className: "px-4 py-2 text-neutral-800 font-medium", children: p.name }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-success-100 text-success-800' : 'bg-neutral-100 text-neutral-600'}`, children: p.status }) }), _jsx("td", { className: "px-4 py-2 text-right", children: _jsx("button", { className: "text-xs text-primary-600 hover:underline", children: "Open \u2197" }) })] }, p.id))) })] }) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-700 mb-3", children: "Recent runs" }), _jsx("div", { className: "border border-neutral-200 rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-neutral-50", children: _jsx("tr", { children: ['Run ID', 'Started', 'Duration', 'Status', 'Triggered by'].map(h => (_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-neutral-500", children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-neutral-100", children: MOCK_RUNS.map(run => (_jsxs("tr", { className: "hover:bg-neutral-50 transition-colors", children: [_jsx("td", { className: "px-4 py-2 font-mono text-xs text-primary-600 cursor-pointer hover:underline", children: run.id }), _jsx("td", { className: "px-4 py-2 text-neutral-600", children: run.start }), _jsx("td", { className: "px-4 py-2 text-neutral-600", children: run.duration }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RUN_STATUS_COLOR[run.status] ?? ''}`, children: run.status }) }), _jsx("td", { className: "px-4 py-2 text-neutral-500 capitalize", children: run.triggeredBy })] }, run.id))) })] }) })] })] }));
}
