import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * FolderWorkspace — tab content for a Folder/Directory object.
 * Sub-tabs: Overview | Properties | Contents | History | Permissions
 */
import { useState } from 'react';
import { FolderPlus, Workflow, GitMerge, Save, Plus } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
const SUB_TABS = [
    { id: 'overview', label: 'Overview', shortcut: '1' },
    { id: 'properties', label: 'Properties', shortcut: '2' },
    { id: 'contents', label: 'Contents', shortcut: '3' },
    { id: 'history', label: 'History', shortcut: '4' },
    { id: 'permissions', label: 'Permissions', shortcut: '5' },
];
function InfoRow({ label, value }) {
    return (_jsxs("div", { className: "flex items-start gap-2 text-[12px]", children: [_jsx("span", { className: "text-slate-500 w-32 flex-shrink-0", children: label }), _jsx("span", { className: "text-slate-300", children: value || '—' })] }));
}
function OverviewTab({ data }) {
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4 max-w-lg space-y-2", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Folder Details" }), _jsx(InfoRow, { label: "Folder ID", value: String(data.folderId ?? '') }), _jsx(InfoRow, { label: "Name", value: String(data.name ?? '') }), _jsx(InfoRow, { label: "Parent Path", value: String(data.parentPath ?? '') }), _jsx(InfoRow, { label: "Status", value: String(data.status ?? 'active') }), _jsx(InfoRow, { label: "Created By", value: String(data.createdBy ?? '') }), _jsx(InfoRow, { label: "Created On", value: String(data.createdOn ?? '') }), _jsx(InfoRow, { label: "Updated By", value: String(data.updatedBy ?? '') }), _jsx(InfoRow, { label: "Updated On", value: String(data.updatedOn ?? '') })] }) }));
}
function PropertiesTab({ data, onChange }) {
    const F = ({ label, field, ro }) => (_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: label }), ro ? (_jsx("div", { className: "h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono", children: String(data[field] ?? '—') })) : (_jsx("input", { type: "text", value: String(data[field] ?? ''), onChange: e => onChange(field, e.target.value), className: "w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" }))] }));
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(F, { label: "Folder ID", field: "folderId", ro: true }), _jsx(F, { label: "Folder Name *", field: "name" }), _jsx(F, { label: "Description", field: "description" }), _jsx(F, { label: "Tags", field: "tags" }), _jsxs("div", { className: "grid grid-cols-2 gap-4 border-t border-slate-800 pt-4", children: [_jsx(F, { label: "Created By", field: "createdBy", ro: true }), _jsx(F, { label: "Created On", field: "createdOn", ro: true }), _jsx(F, { label: "Updated By", field: "updatedBy", ro: true }), _jsx(F, { label: "Updated On", field: "updatedOn", ro: true }), _jsx(F, { label: "Last Opened By", field: "lastOpenedBy", ro: true }), _jsx(F, { label: "Last Opened On", field: "lastOpenedOn", ro: true }), _jsx(F, { label: "Lock State", field: "lockState", ro: true })] })] }) }));
}
function ContentsTab({ tabId }) {
    const dispatch = useAppDispatch();
    return (_jsxs("div", { className: "flex-1 overflow-auto p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsxs("button", { className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors", children: [_jsx(FolderPlus, { className: "w-3.5 h-3.5" }), " New Sub-folder"] }), _jsxs("button", { className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors", children: [_jsx(Workflow, { className: "w-3.5 h-3.5 text-sky-400" }), " New Pipeline"] }), _jsxs("button", { className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors", children: [_jsx(GitMerge, { className: "w-3.5 h-3.5 text-purple-400" }), " New Orchestrator"] })] }), _jsxs("div", { className: "flex flex-col items-center justify-center h-40 text-slate-600", children: [_jsx(Plus, { className: "w-8 h-8 mb-2" }), _jsx("p", { className: "text-sm", children: "Folder contents will appear here once loaded." })] })] }));
}
export function FolderWorkspace({ tabId }) {
    const dispatch = useAppDispatch();
    const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
    const subTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'overview');
    const folderName = tab?.objectName ?? 'Folder';
    const [formData, setFormData] = useState({
        folderId: tab?.objectId ?? '',
        name: folderName,
        description: '',
        status: 'active',
        lockState: 'Unlocked',
        createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
        lastOpenedBy: '—', lastOpenedOn: '—',
    });
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        dispatch(markTabUnsaved(tabId));
    };
    const handleSave = async () => {
        setIsSaving(true);
        await new Promise(r => setTimeout(r, 300));
        setIsDirty(false);
        dispatch(markTabSaved(tabId));
        setIsSaving(false);
    };
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden bg-[#0d0f1a]", children: [_jsx(ObjectHeader, { type: "folder", name: String(formData.name ?? folderName), hierarchyPath: tab?.hierarchyPath, status: "draft", isDirty: isDirty, actions: isDirty ? (_jsxs("button", { onClick: handleSave, disabled: isSaving, className: "flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50", children: [_jsx(Save, { className: "w-3.5 h-3.5" }), isSaving ? 'Saving…' : 'Save'] })) : undefined }), _jsx(SubTabBar, { tabId: tabId, tabs: SUB_TABS, defaultTab: "overview" }), subTab === 'overview' && _jsx(OverviewTab, { data: formData }), subTab === 'properties' && _jsx(PropertiesTab, { data: formData, onChange: handleChange }), subTab === 'contents' && _jsx(ContentsTab, { tabId: tabId }), subTab === 'history' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [] }) }), subTab === 'permissions' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectPermissionsGrid, { rows: [] }) })] }));
}
