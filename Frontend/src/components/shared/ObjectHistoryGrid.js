import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ObjectHistoryGrid — reusable history/audit grid component.
 * Shows field-level change history for any auditable object.
 */
import { useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
const ACTION_COLORS = {
    CREATED: 'text-emerald-400',
    UPDATED: 'text-blue-400',
    RENAMED: 'text-sky-400',
    DELETED: 'text-red-400',
    MOVED: 'text-amber-400',
    SAVED: 'text-emerald-400',
    VALIDATED: 'text-violet-400',
    EXECUTION_STARTED: 'text-blue-400',
    EXECUTION_SUCCEEDED: 'text-emerald-400',
    EXECUTION_FAILED: 'text-red-400',
    EXECUTION_CANCELLED: 'text-orange-400',
    PUBLISHED: 'text-emerald-400',
    PERMISSION_GRANTED: 'text-teal-400',
    PERMISSION_REVOKED: 'text-orange-400',
    ROLE_ASSIGNED: 'text-violet-400',
    CONNECTION_TESTED: 'text-sky-400',
};
function ActionBadge({ action }) {
    const color = ACTION_COLORS[action] ?? 'text-slate-400';
    return _jsx("span", { className: `font-medium text-[11px] ${color}`, children: action });
}
export function ObjectHistoryGrid({ rows, loading, emptyMessage = 'No history records' }) {
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const filtered = rows.filter(r => {
        const s = search.toLowerCase();
        const matchSearch = !s || r.actor.toLowerCase().includes(s) || r.action.toLowerCase().includes(s)
            || (r.fieldChanged ?? '').toLowerCase().includes(s) || (r.comment ?? '').toLowerCase().includes(s);
        const matchAction = !actionFilter || r.action === actionFilter;
        return matchSearch && matchAction;
    });
    const uniqueActions = [...new Set(rows.map(r => r.action))].sort();
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0", children: [_jsxs("div", { className: "relative flex-1 max-w-xs", children: [_jsx(Search, { className: "absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" }), _jsx("input", { type: "text", value: search, onChange: e => setSearch(e.target.value), placeholder: "Search history\u2026", className: "w-full h-7 pl-7 pr-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-600 focus:ring-0" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Filter, { className: "w-3.5 h-3.5 text-slate-500" }), _jsxs("select", { value: actionFilter, onChange: e => setActionFilter(e.target.value), className: "h-7 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 outline-none focus:border-blue-600 px-1.5", children: [_jsx("option", { value: "", children: "All Actions" }), uniqueActions.map(a => _jsx("option", { value: a, children: a }, a))] })] }), _jsxs("button", { title: "Export history", className: "h-7 px-2 flex items-center gap-1 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", children: [_jsx(Download, { className: "w-3 h-3" }), " Export"] }), _jsxs("span", { className: "text-[11px] text-slate-600 ml-auto", children: [filtered.length, " records"] })] }), _jsx("div", { className: "flex-1 overflow-auto min-h-0", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-32 text-sm text-slate-500", children: "Loading history\u2026" })) : filtered.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-32 text-sm text-slate-600", children: emptyMessage })) : (_jsxs("table", { className: "w-full border-collapse text-[12px]", children: [_jsx("thead", { className: "sticky top-0 bg-[#0a0c15] z-10", children: _jsxs("tr", { className: "text-left text-[11px] text-slate-500 border-b border-slate-800", children: [_jsx("th", { className: "px-3 py-2 font-medium", children: "Timestamp" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Action" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Actor" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Area / Field" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Old Value" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "New Value" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Version" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Comment" })] }) }), _jsx("tbody", { children: filtered.map((row, i) => (_jsxs("tr", { className: `border-b border-slate-800/50 hover:bg-slate-800/30 ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`, children: [_jsx("td", { className: "px-3 py-1.5 text-slate-400 whitespace-nowrap", children: row.timestamp }), _jsx("td", { className: "px-3 py-1.5 whitespace-nowrap", children: _jsx(ActionBadge, { action: row.action }) }), _jsx("td", { className: "px-3 py-1.5 text-slate-300", children: row.actor }), _jsx("td", { className: "px-3 py-1.5 text-slate-400", children: row.objectArea ?? row.fieldChanged ?? '—' }), _jsx("td", { className: "px-3 py-1.5 text-red-400/80 max-w-[150px] truncate", title: row.oldValue, children: row.oldValue ?? '—' }), _jsx("td", { className: "px-3 py-1.5 text-emerald-400/80 max-w-[150px] truncate", title: row.newValue, children: row.newValue ?? '—' }), _jsx("td", { className: "px-3 py-1.5 text-slate-500", children: row.version ?? '—' }), _jsx("td", { className: "px-3 py-1.5 text-slate-500 max-w-[200px] truncate", title: row.comment, children: row.comment ?? '—' })] }, row.id))) })] })) })] }));
}
