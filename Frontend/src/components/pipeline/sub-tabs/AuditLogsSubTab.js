import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import api from '@/services/api';
const ACTION_STYLE = {
    PIPELINE_SAVED: 'bg-primary-100 text-primary-800',
    RUN_STARTED: 'bg-neutral-100 text-neutral-600',
    RUN_COMPLETED: 'bg-success-100 text-success-800',
    RUN_FAILED: 'bg-danger-100 text-danger-800',
    PERMISSIONS_CHANGED: 'bg-warning-100 text-warning-800',
    PIPELINE_CLONED: 'bg-purple-100  text-purple-800',
};
export function AuditLogsSubTab({ pipelineId }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);
    const load = useCallback(async () => {
        if (!pipelineId)
            return;
        setLoading(true);
        try {
            const res = await api.getPipelineAuditLogs(pipelineId);
            const data = res.data.data ?? res.data;
            setEntries(data ?? []);
        }
        catch {
            setEntries([]);
        }
        finally {
            setLoading(false);
        }
    }, [pipelineId]);
    useEffect(() => { load(); }, [load]);
    const filtered = entries.filter(e => !search || e.user?.includes(search) || e.action?.includes(search) ||
        e.summary?.toLowerCase().includes(search.toLowerCase()));
    return (_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-white flex-shrink-0", children: [_jsx(Input, { placeholder: "Search by user, action, or summary\u2026", value: search, onChange: e => setSearch(e.target.value), className: "w-72" }), _jsx("button", { onClick: load, className: "text-xs text-neutral-500 hover:text-neutral-700 border border-neutral-300 px-2 py-1.5 rounded", children: "\u27F3 Refresh" }), _jsx("div", { className: "flex-1" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Export audit slice" })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-6 py-4", children: [loading && _jsx("div", { className: "text-sm text-neutral-400 py-8 text-center", children: "Loading audit log\u2026" }), !loading && (_jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute left-4 top-2 bottom-2 w-px bg-neutral-200" }), _jsxs("div", { className: "space-y-4", children: [filtered.length === 0 && (_jsx("div", { className: "pl-12 text-sm text-neutral-400 py-8 text-center", children: entries.length === 0 ? 'No audit entries recorded yet.' : 'No entries match the current filter.' })), filtered.map(entry => (_jsxs("div", { className: "relative pl-12", children: [_jsx("div", { className: "absolute left-2.5 top-2 w-3 h-3 rounded-full bg-white border-2 border-neutral-300" }), _jsxs("div", { className: "bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLE[entry.action] ?? 'bg-neutral-100 text-neutral-600'}`, children: (entry.action ?? '').replace(/_/g, ' ') }), _jsx("span", { className: "text-xs text-neutral-500", children: entry.user }), _jsx("span", { className: "text-xs text-neutral-400", children: entry.timestamp })] }), _jsx("p", { className: "text-sm text-neutral-700 mt-2", children: entry.summary })] }), entry.diffJson && (_jsx("button", { onClick: () => setExpanded(expanded === entry.id ? null : entry.id), className: "text-xs text-primary-600 hover:underline flex-shrink-0", children: expanded === entry.id ? 'Hide diff' : 'View diff' }))] }), expanded === entry.id && entry.diffJson && (_jsx("pre", { className: "mt-3 p-3 bg-neutral-900 rounded text-xs font-mono text-neutral-200 whitespace-pre overflow-x-auto", children: JSON.stringify(entry.diffJson, null, 2) }))] })] }, entry.id)))] })] }))] })] }));
}
