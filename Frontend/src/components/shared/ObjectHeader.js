import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ObjectHeader — reusable tab content header with hierarchy breadcrumb,
 * status badge, and action buttons. Used by all object workspace tabs.
 */
import React from 'react';
import { Workflow, GitMerge, FolderOpen, Folder, Plug2, Database, Users, Shield, Activity, Play, GitBranch, Settings, ChevronRight, Lock, Edit3, AlertCircle, CheckCircle2, Clock, PauseCircle, XCircle, Archive, FileWarning, } from 'lucide-react';
// ─── Object icon ──────────────────────────────────────────────────────────
export function ObjectTypeIcon({ type, size = 18 }) {
    const s = { width: size, height: size };
    switch (type) {
        case 'pipeline': return _jsx(Workflow, { style: s, className: "text-sky-400" });
        case 'orchestrator': return _jsx(GitMerge, { style: s, className: "text-purple-400" });
        case 'project': return _jsx(FolderOpen, { style: s, className: "text-amber-400" });
        case 'folder': return _jsx(Folder, { style: s, className: "text-amber-300" });
        case 'connection':
        case 'connections': return _jsx(Plug2, { style: s, className: "text-emerald-400" });
        case 'metadata': return _jsx(Database, { style: s, className: "text-violet-400" });
        case 'user': return _jsx(Users, { style: s, className: "text-rose-400" });
        case 'role': return _jsx(Shield, { style: s, className: "text-orange-400" });
        case 'monitor': return _jsx(Activity, { style: s, className: "text-sky-500" });
        case 'execution': return _jsx(Play, { style: s, className: "text-green-400" });
        case 'lineage': return _jsx(GitBranch, { style: s, className: "text-teal-400" });
        case 'governance': return _jsx(Users, { style: s, className: "text-rose-400" });
        case 'settings': return _jsx(Settings, { style: s, className: "text-slate-400" });
        default: return _jsx(Database, { style: s, className: "text-slate-400" });
    }
}
// ─── Status badge ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    draft: { label: 'Draft', className: 'bg-slate-700 text-slate-300 border-slate-600', Icon: Edit3 },
    published: { label: 'Published', className: 'bg-emerald-900/50 text-emerald-300 border-emerald-700', Icon: CheckCircle2 },
    running: { label: 'Running', className: 'bg-blue-900/50 text-blue-300 border-blue-700', Icon: Activity },
    failed: { label: 'Failed', className: 'bg-red-900/50 text-red-300 border-red-700', Icon: XCircle },
    success: { label: 'Success', className: 'bg-emerald-900/50 text-emerald-300 border-emerald-700', Icon: CheckCircle2 },
    warning: { label: 'Warning', className: 'bg-amber-900/50 text-amber-300 border-amber-700', Icon: FileWarning },
    disabled: { label: 'Disabled', className: 'bg-slate-800 text-slate-500 border-slate-700', Icon: PauseCircle },
    locked: { label: 'Locked', className: 'bg-slate-700 text-slate-400 border-slate-600', Icon: Lock },
    archived: { label: 'Archived', className: 'bg-slate-800 text-slate-500 border-slate-700', Icon: Archive },
};
export function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
    const Icon = cfg.Icon;
    return (_jsxs("span", { className: `inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border ${cfg.className}`, children: [_jsx(Icon, { className: "w-2.5 h-2.5" }), cfg.label] }));
}
// ─── Hierarchy breadcrumb ─────────────────────────────────────────────────
function HierarchyBreadcrumb({ path }) {
    const parts = path.split('→').map(p => p.trim()).filter(Boolean);
    return (_jsx("div", { className: "flex items-center gap-0.5 text-[11px] text-slate-500 flex-wrap min-w-0", children: parts.map((part, i) => (_jsxs(React.Fragment, { children: [i > 0 && _jsx(ChevronRight, { className: "w-3 h-3 text-slate-700 flex-shrink-0" }), _jsx("span", { className: `truncate ${i < parts.length - 1 ? 'hover:text-slate-300 cursor-pointer transition-colors' : 'text-slate-400'}`, title: part, children: part })] }, i))) }));
}
export function ObjectHeader({ type, name, hierarchyPath, status, isDirty, isReadOnly, isLocked, actions, }) {
    return (_jsx("div", { className: "flex-shrink-0 px-5 pt-4 pb-3 border-b border-slate-800 bg-[#0d0f1a]", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "mt-0.5 flex-shrink-0", children: _jsx(ObjectTypeIcon, { type: type, size: 20 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h1", { className: `text-[18px] font-semibold text-slate-100 leading-tight ${isDirty ? 'italic' : ''}`, children: isDirty ? `*${name}` : name }), status && _jsx(StatusBadge, { status: status }), isLocked && (_jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border bg-slate-700 text-slate-400 border-slate-600", children: [_jsx(Lock, { className: "w-2.5 h-2.5" }), " Locked"] })), isReadOnly && (_jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border bg-slate-800 text-slate-500 border-slate-700", children: [_jsx(AlertCircle, { className: "w-2.5 h-2.5" }), " Read-only"] })), isDirty && (_jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border bg-amber-900/40 text-amber-300 border-amber-700", children: [_jsx(Clock, { className: "w-2.5 h-2.5" }), " Unsaved"] }))] }), hierarchyPath && (_jsx("div", { className: "mt-1", children: _jsx(HierarchyBreadcrumb, { path: hierarchyPath }) }))] }), actions && (_jsx("div", { className: "flex items-center gap-1.5 flex-shrink-0 mt-0.5", children: actions }))] }) }));
}
