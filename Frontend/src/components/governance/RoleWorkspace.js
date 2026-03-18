import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * RoleWorkspace — tab content for a Role object.
 * Sub-tabs: Properties | Members | Permissions | Scope | History | Audit
 */
import { useState } from 'react';
import { Save, Plus, Trash2, Shield, Users } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
const SUB_TABS = [
    { id: 'properties', label: 'Properties', shortcut: '1' },
    { id: 'members', label: 'Members', shortcut: '2' },
    { id: 'permissions', label: 'Permissions', shortcut: '3' },
    { id: 'scope', label: 'Scope', shortcut: '4' },
    { id: 'history', label: 'History', shortcut: '5' },
    { id: 'audit', label: 'Audit', shortcut: '6' },
];
// ─── Properties sub-tab ───────────────────────────────────────────────────
function PropertiesTab({ data, onChange }) {
    const F = ({ label, field, ro, ta }) => (_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: label }), ro ? (_jsx("div", { className: "h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500", children: String(data[field] ?? '—') })) : ta ? (_jsx("textarea", { rows: 3, value: String(data[field] ?? ''), onChange: e => onChange(field, e.target.value), className: "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" })) : (_jsx("input", { type: "text", value: String(data[field] ?? ''), onChange: e => onChange(field, e.target.value), className: "w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" }))] }));
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(F, { label: "Role ID", field: "roleId", ro: true }), _jsx(F, { label: "Role Name *", field: "name" }), _jsx(F, { label: "Description", field: "description", ta: true }), _jsx("div", { className: "border-t border-slate-800 pt-4 grid grid-cols-2 gap-4 text-[12px]", children: [
                        { label: 'System Role', field: 'isSystemRole' },
                        { label: 'Custom Role', field: 'isCustomRole' },
                        { label: 'Assignable', field: 'isAssignable' },
                    ].map(f => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: Boolean(data[f.field]), onChange: e => onChange(f.field, String(e.target.checked)), className: "w-3.5 h-3.5 accent-blue-500" }), _jsx("label", { className: "text-slate-300", children: f.label })] }, f.field))) }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Created By", field: "createdBy", ro: true }), _jsx(F, { label: "Created On", field: "createdOn", ro: true }), _jsx(F, { label: "Updated By", field: "updatedBy", ro: true }), _jsx(F, { label: "Updated On", field: "updatedOn", ro: true })] })] }) }));
}
// ─── Members sub-tab ──────────────────────────────────────────────────────
function MembersTab({ members }) {
    return (_jsxs("div", { className: "flex-1 overflow-auto p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx("span", { className: "text-[13px] font-medium text-slate-300", children: "Members" }), _jsxs("span", { className: "text-[11px] text-slate-600", children: ["\u00B7 ", members.length] }), _jsxs("button", { className: "ml-auto flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors", children: [_jsx(Plus, { className: "w-3 h-3" }), " Assign User"] })] }), members.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg", children: [_jsx(Users, { className: "w-6 h-6 mb-2 opacity-40" }), _jsx("p", { className: "text-sm", children: "No members assigned to this role." })] })) : (_jsx("div", { className: "space-y-1", children: members.map(m => (_jsxs("div", { className: "flex items-center gap-3 px-4 py-2.5 border border-slate-800 rounded-lg hover:bg-slate-800/40 group", children: [_jsx("div", { className: "w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0", children: _jsx("span", { className: "text-[11px] font-bold text-white", children: m.slice(0, 2).toUpperCase() }) }), _jsx("span", { className: "text-[13px] text-slate-200 flex-1", children: m }), _jsx("button", { className: "w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all", children: _jsx(Trash2, { className: "w-3 h-3" }) })] }, m))) }))] }));
}
// ─── Permissions matrix sub-tab ───────────────────────────────────────────
const RESOURCES = ['Projects', 'Folders', 'Pipelines', 'Orchestrators', 'Connections', 'Metadata', 'Users', 'Roles', 'Execution Logs', 'Admin Settings'];
const PERMS = ['View', 'Edit', 'Delete', 'Run', 'Publish', 'Manage Permissions'];
function PermissionsMatrixTab({ matrix, onChange }) {
    return (_jsxs("div", { className: "flex-1 overflow-auto p-5", children: [_jsx("div", { className: "text-[11px] text-slate-500 mb-3", children: "Click cells to toggle permissions for this role." }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "border-collapse text-[12px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] text-slate-500 border-b border-slate-800", children: [_jsx("th", { className: "px-3 py-2 font-medium w-36", children: "Resource" }), PERMS.map(p => (_jsx("th", { className: "px-3 py-2 font-medium text-center whitespace-nowrap", children: p }, p)))] }) }), _jsx("tbody", { children: RESOURCES.map(r => (_jsxs("tr", { className: "border-b border-slate-800/50 hover:bg-slate-800/20", children: [_jsx("td", { className: "px-3 py-2 text-slate-300 font-medium", children: r }), PERMS.map(p => {
                                        const checked = matrix[r]?.[p] ?? false;
                                        return (_jsx("td", { className: "px-3 py-2 text-center", children: _jsx("button", { onClick: () => onChange(r, p, !checked), className: `w-5 h-5 rounded border flex items-center justify-center mx-auto transition-colors ${checked ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-blue-600'}`, children: checked && _jsx("span", { className: "text-white text-[10px] font-bold", children: "\u2713" }) }) }, p));
                                    })] }, r))) })] }) })] }));
}
// ─── Scope sub-tab ────────────────────────────────────────────────────────
function ScopeTab() {
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-lg", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Scope Definition" }), _jsxs("div", { className: "flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg", children: [_jsx(Shield, { className: "w-6 h-6 mb-2 opacity-40" }), _jsx("p", { className: "text-sm", children: "Scope configuration is managed by the platform administrator." })] })] }) }));
}
// ─── Main workspace ───────────────────────────────────────────────────────
export function RoleWorkspace({ tabId }) {
    const dispatch = useAppDispatch();
    const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
    const subTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'properties');
    const roleName = tab?.objectName ?? 'Role';
    const [formData, setFormData] = useState({
        roleId: tab?.objectId ?? '',
        name: roleName,
        description: '',
        status: 'active',
        isSystemRole: false, isCustomRole: true, isAssignable: true,
        createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
    });
    const [matrix, setMatrix] = useState({});
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        dispatch(markTabUnsaved(tabId));
    };
    const handleMatrixChange = (resource, perm, val) => {
        setMatrix(prev => ({ ...prev, [resource]: { ...(prev[resource] ?? {}), [perm]: val } }));
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
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden bg-[#0d0f1a]", children: [_jsx(ObjectHeader, { type: "role", name: String(formData.name ?? roleName), hierarchyPath: tab?.hierarchyPath ?? `Roles → ${roleName}`, isDirty: isDirty, actions: isDirty ? (_jsxs("button", { onClick: handleSave, disabled: isSaving, className: "flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50", children: [_jsx(Save, { className: "w-3.5 h-3.5" }), isSaving ? 'Saving…' : 'Save'] })) : undefined }), _jsx(SubTabBar, { tabId: tabId, tabs: SUB_TABS, defaultTab: "properties" }), subTab === 'properties' && _jsx(PropertiesTab, { data: formData, onChange: handleChange }), subTab === 'members' && _jsx(MembersTab, { members: [] }), subTab === 'permissions' && _jsx(PermissionsMatrixTab, { matrix: matrix, onChange: handleMatrixChange }), subTab === 'scope' && _jsx(ScopeTab, {}), subTab === 'history' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [] }) }), subTab === 'audit' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [], emptyMessage: "No audit records." }) })] }));
}
