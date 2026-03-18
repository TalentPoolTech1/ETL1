import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MetadataBrowserWorkspace — tab content for Metadata objects.
 * Sub-tabs: Overview | Structure | Profiling | Lineage | History | Permissions
 */
import { useState } from 'react';
import { RefreshCw, Database, Table2, Columns } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
const SUB_TABS = [
    { id: 'overview', label: 'Overview', shortcut: '1' },
    { id: 'structure', label: 'Structure', shortcut: '2' },
    { id: 'profiling', label: 'Profiling', shortcut: '3' },
    { id: 'lineage', label: 'Lineage', shortcut: '4' },
    { id: 'history', label: 'History', shortcut: '5' },
    { id: 'permissions', label: 'Permissions', shortcut: '6' },
];
function InfoRow({ label, value }) {
    return (_jsxs("div", { className: "flex items-start gap-2 text-[12px]", children: [_jsx("span", { className: "text-slate-500 w-36 flex-shrink-0", children: label }), _jsx("span", { className: "text-slate-300 break-all", children: value || '—' })] }));
}
// ─── Column type badge ────────────────────────────────────────────────────
function TypeBadge({ type }) {
    const color = /^(int|bigint|numeric|float|double|decimal)/i.test(type)
        ? 'text-blue-300 bg-blue-900/30 border-blue-700/50'
        : /^(varchar|text|char|string)/i.test(type)
            ? 'text-emerald-300 bg-emerald-900/30 border-emerald-700/50'
            : /^(date|time|timestamp)/i.test(type)
                ? 'text-amber-300 bg-amber-900/30 border-amber-700/50'
                : /^(bool)/i.test(type)
                    ? 'text-purple-300 bg-purple-900/30 border-purple-700/50'
                    : 'text-slate-400 bg-slate-800 border-slate-700';
    return (_jsx("span", { className: `px-1.5 py-0.5 rounded border text-[10px] font-mono ${color}`, children: type || '?' }));
}
// ─── Overview sub-tab ─────────────────────────────────────────────────────
function OverviewTab({ data }) {
    const metaType = String(data.metaType ?? 'table');
    const Icon = metaType === 'schema' ? Database : metaType === 'table' ? Table2 : Columns;
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3 p-4 bg-slate-800/30 border border-slate-800 rounded-lg", children: [_jsx(Icon, { className: "w-8 h-8 text-violet-400 flex-shrink-0" }), _jsxs("div", { children: [_jsx("div", { className: "text-[16px] font-semibold text-slate-100", children: String(data.name ?? '—') }), _jsx("div", { className: "text-[12px] text-slate-500 mt-0.5", children: String(data.fullyQualifiedName ?? '—') })] })] }), _jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2", children: [_jsx(InfoRow, { label: "Source Connection", value: String(data.sourceConnection ?? '') }), _jsx(InfoRow, { label: "Schema", value: String(data.schema ?? '') }), _jsx(InfoRow, { label: "Object Type", value: metaType }), _jsx(InfoRow, { label: "Row Count", value: data.rowCount != null ? String(data.rowCount) : 'Not available' }), _jsx(InfoRow, { label: "Last Profiled On", value: String(data.lastProfiledOn ?? '') }), _jsx(InfoRow, { label: "Last Refreshed On", value: String(data.lastRefreshedOn ?? '') }), _jsx(InfoRow, { label: "Data Classification", value: String(data.dataClassification ?? '') }), _jsx(InfoRow, { label: "Owner", value: String(data.owner ?? '') })] }), String(data.description) && (_jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2", children: "Description" }), _jsx("p", { className: "text-[13px] text-slate-300", children: String(data.description) })] }))] }) }));
}
function StructureTab({ columns }) {
    if (columns.length === 0) {
        return (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 p-5", children: [_jsx(Columns, { className: "w-8 h-8 mb-2 opacity-40" }), _jsx("p", { className: "text-sm", children: "No column metadata available. Try refreshing metadata." })] }));
    }
    return (_jsx("div", { className: "flex-1 overflow-auto", children: _jsxs("table", { className: "w-full border-collapse text-[12px]", children: [_jsx("thead", { className: "sticky top-0 bg-[#0a0c15] z-10", children: _jsxs("tr", { className: "text-left text-[11px] text-slate-500 border-b border-slate-800", children: [_jsx("th", { className: "px-3 py-2 font-medium", children: "#" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Column Name" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Data Type" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Nullable" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "PK" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Sensitive" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Default" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Description" })] }) }), _jsx("tbody", { children: columns.map((col, i) => (_jsxs("tr", { className: "border-b border-slate-800/50 hover:bg-slate-800/30", children: [_jsx("td", { className: "px-3 py-1.5 text-slate-600", children: i + 1 }), _jsx("td", { className: "px-3 py-1.5 font-mono text-slate-200", children: col.name }), _jsx("td", { className: "px-3 py-1.5", children: _jsx(TypeBadge, { type: col.dataType }) }), _jsx("td", { className: "px-3 py-1.5 text-slate-400", children: col.nullable ? 'Yes' : 'No' }), _jsx("td", { className: "px-3 py-1.5", children: col.isPrimaryKey ? _jsx("span", { className: "text-amber-400 font-bold", children: "PK" }) : '—' }), _jsx("td", { className: "px-3 py-1.5", children: col.isSensitive ? _jsx("span", { className: "text-red-400 text-[11px]", children: "\uD83D\uDD12 Yes" }) : '—' }), _jsx("td", { className: "px-3 py-1.5 text-slate-500 font-mono text-[11px]", children: col.defaultValue ?? '—' }), _jsx("td", { className: "px-3 py-1.5 text-slate-500", children: col.description ?? '—' })] }, col.name))) })] }) }));
}
// ─── Profiling sub-tab ────────────────────────────────────────────────────
function ProfilingTab() {
    return (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 p-5", children: [_jsx(RefreshCw, { className: "w-8 h-8 mb-2 opacity-40" }), _jsx("p", { className: "text-sm mb-3", children: "No profiling data available." }), _jsxs("button", { className: "flex items-center gap-1.5 h-7 px-3 bg-violet-700 hover:bg-violet-600 text-white rounded text-[12px] font-medium transition-colors", children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5" }), " Run Profile"] })] }));
}
// ─── Lineage sub-tab ─────────────────────────────────────────────────────
function LineageTab() {
    return (_jsx("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 p-5", children: _jsx("p", { className: "text-sm", children: "Lineage visualization is not yet available for this object." }) }));
}
// ─── Main workspace ───────────────────────────────────────────────────────
export function MetadataBrowserWorkspace({ tabId }) {
    const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
    const subTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'overview');
    const objName = tab?.objectName ?? 'Metadata';
    const [data] = useState({
        name: objName,
        fullyQualifiedName: tab?.hierarchyPath ?? objName,
        metaType: 'table',
        sourceConnection: '—',
        schema: '—',
        rowCount: null,
        lastProfiledOn: '—',
        lastRefreshedOn: '—',
        dataClassification: '—',
        owner: '—',
        description: '',
    });
    const [columns] = useState([]);
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden bg-[#0d0f1a]", children: [_jsx(ObjectHeader, { type: "metadata", name: objName, hierarchyPath: tab?.hierarchyPath, status: "published", actions: _jsxs("button", { className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors", children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5" }), " Refresh Metadata"] }) }), _jsx(SubTabBar, { tabId: tabId, tabs: SUB_TABS, defaultTab: "overview" }), subTab === 'overview' && _jsx(OverviewTab, { data: data }), subTab === 'structure' && _jsx(StructureTab, { columns: columns }), subTab === 'profiling' && _jsx(ProfilingTab, {}), subTab === 'lineage' && _jsx(LineageTab, {}), subTab === 'history' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [] }) }), subTab === 'permissions' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectPermissionsGrid, { rows: [], readOnly: true }) })] }));
}
