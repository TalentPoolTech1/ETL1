import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ProjectWorkspace — tab content for a Project object.
 * Sub-tabs: Overview | Properties | Contents | History | Permissions | Activity
 */
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
import api from '@/services/api';
const SUB_TABS = [
    { id: 'overview', label: 'Overview', shortcut: '1' },
    { id: 'properties', label: 'Properties', shortcut: '2' },
    { id: 'history', label: 'History', shortcut: '3' },
    { id: 'permissions', label: 'Permissions', shortcut: '4' },
    { id: 'activity', label: 'Activity', shortcut: '5' },
];
function InfoRow({ label, value, mono }) {
    return (_jsxs("div", { className: "flex items-start gap-2 text-[12px]", children: [_jsx("span", { className: "text-slate-500 w-32 flex-shrink-0", children: label }), _jsx("span", { className: `text-slate-300 break-all ${mono ? 'font-mono text-[11px]' : ''}`, children: value || '—' })] }));
}
// ─── Overview ─────────────────────────────────────────────────────────────
function OverviewTab({ data }) {
    const stats = [
        { label: 'Directories', value: data.folderCount ?? 0 },
        { label: 'Pipelines', value: data.pipelineCount ?? 0 },
        { label: 'Orchestrators', value: data.orchestratorCount ?? 0 },
        { label: 'Connections', value: data.connectionCount ?? 0 },
        { label: 'Members', value: data.memberCount ?? 0 },
    ];
    return (_jsxs("div", { className: "flex-1 overflow-auto p-5", children: [_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6", children: stats.map(s => (_jsxs("div", { className: "bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-slate-100", children: String(s.value) }), _jsx("div", { className: "text-[11px] text-slate-500 mt-0.5", children: s.label })] }, s.label))) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Details" }), _jsx(InfoRow, { label: "Project ID", value: String(data.projectId ?? ''), mono: true }), _jsx(InfoRow, { label: "Status", value: String(data.status ?? 'draft') }), _jsx(InfoRow, { label: "Created By", value: String(data.createdBy ?? '') }), _jsx(InfoRow, { label: "Created On", value: String(data.createdOn ?? '') }), _jsx(InfoRow, { label: "Updated By", value: String(data.updatedBy ?? '') }), _jsx(InfoRow, { label: "Updated On", value: String(data.updatedOn ?? '') }), _jsx(InfoRow, { label: "Version", value: String(data.version ?? '1') })] }), _jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Description" }), _jsx("p", { className: "text-[13px] text-slate-300 leading-relaxed", children: String(data.description || 'No description provided.') }), Array.isArray(data.tags) && data.tags.length > 0 && (_jsx("div", { className: "mt-3 flex flex-wrap gap-1", children: data.tags.map(t => (_jsx("span", { className: "px-2 py-0.5 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-[11px] rounded", children: t }, t))) }))] })] })] }));
}
// ─── Properties ───────────────────────────────────────────────────────────
function PropertiesTab({ data, onChange }) {
    const Field = ({ label, field, ro, ta }) => (_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: label }), ro ? (_jsx("div", { className: "h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono", children: String(data[field] ?? '—') })) : ta ? (_jsx("textarea", { rows: 3, value: String(data[field] ?? ''), onChange: e => onChange(field, e.target.value), className: "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" })) : (_jsx("input", { type: "text", value: String(data[field] ?? ''), onChange: e => onChange(field, e.target.value), className: "w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" }))] }));
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(Field, { label: "Project ID", field: "projectId", ro: true }), _jsx(Field, { label: "Project Name *", field: "name" }), _jsx(Field, { label: "Description", field: "description", ta: true }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(Field, { label: "Default Environment", field: "defaultEnvironment" }), _jsx(Field, { label: "Owner", field: "owner" })] }), _jsx(Field, { label: "Tags (comma separated)", field: "tags" }), _jsx(Field, { label: "Labels", field: "labels" }), _jsxs("div", { className: "border-t border-slate-800 pt-4 grid grid-cols-2 gap-4", children: [_jsx(Field, { label: "Created By", field: "createdBy", ro: true }), _jsx(Field, { label: "Created On", field: "createdOn", ro: true }), _jsx(Field, { label: "Updated By", field: "updatedBy", ro: true }), _jsx(Field, { label: "Updated On", field: "updatedOn", ro: true }), _jsx(Field, { label: "Last Opened By", field: "lastOpenedBy", ro: true }), _jsx(Field, { label: "Last Opened On", field: "lastOpenedOn", ro: true }), _jsx(Field, { label: "Version", field: "version", ro: true }), _jsx(Field, { label: "Lock State", field: "lockState", ro: true })] })] }) }));
}
// ─── Activity ─────────────────────────────────────────────────────────────
function ActivityTab() {
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsx("div", { className: "flex flex-col items-center justify-center h-40 text-slate-600", children: _jsx("p", { className: "text-sm", children: "Activity log is not yet available for this project." }) }) }));
}
// ─── Main workspace ───────────────────────────────────────────────────────
export function ProjectWorkspace({ tabId }) {
    const dispatch = useAppDispatch();
    const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
    const subTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'overview');
    const projectId = tab?.objectId ?? '';
    const projectName = tab?.objectName ?? 'Project';
    const [formData, setFormData] = useState({
        projectId,
        name: projectName,
        description: '',
        status: 'draft',
        version: '1',
        lockState: 'Unlocked',
        defaultEnvironment: 'Development',
        tags: [],
        createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
        lastOpenedBy: '—', lastOpenedOn: '—',
        folderCount: 0, pipelineCount: 0, orchestratorCount: 0, connectionCount: 0, memberCount: 0,
    });
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => {
        if (!projectId)
            return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.getProject?.(projectId)?.then((res) => {
            const d = res.data?.data ?? res.data;
            if (d)
                setFormData(prev => ({ ...prev, ...d }));
        }).catch(() => { });
    }, [projectId]);
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        dispatch(markTabUnsaved(tabId));
    };
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await api.updateProject?.(projectId, formData);
            setIsDirty(false);
            dispatch(markTabSaved(tabId));
        }
        catch { /* noop */ }
        finally {
            setIsSaving(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden bg-[#0d0f1a]", children: [_jsx(ObjectHeader, { type: "project", name: String(formData.name ?? projectName), hierarchyPath: tab?.hierarchyPath ?? `Projects → ${projectName}`, status: formData.status ?? 'draft', isDirty: isDirty, actions: isDirty ? (_jsxs("button", { onClick: handleSave, disabled: isSaving, className: "flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50", children: [_jsx(Save, { className: "w-3.5 h-3.5" }), isSaving ? 'Saving…' : 'Save'] })) : undefined }), _jsx(SubTabBar, { tabId: tabId, tabs: SUB_TABS, defaultTab: "overview" }), subTab === 'overview' && _jsx(OverviewTab, { data: formData }), subTab === 'properties' && _jsx(PropertiesTab, { data: formData, onChange: handleChange }), subTab === 'history' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [] }) }), subTab === 'permissions' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectPermissionsGrid, { rows: [] }) }), subTab === 'activity' && _jsx(ActivityTab, {})] }));
}
