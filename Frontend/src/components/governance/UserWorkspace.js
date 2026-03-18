import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * UserWorkspace — tab content for a User object.
 * Sub-tabs: Profile | Access | Activity | Audit | Sessions | Preferences
 */
import { useState, useEffect } from 'react';
import { Shield, UserCheck, Ban, Key, Save, Monitor } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import api from '@/services/api';
const SUB_TABS = [
    { id: 'profile', label: 'Profile', shortcut: '1' },
    { id: 'access', label: 'Access', shortcut: '2' },
    { id: 'activity', label: 'Activity', shortcut: '3' },
    { id: 'audit', label: 'Audit', shortcut: '4' },
    { id: 'sessions', label: 'Sessions', shortcut: '5' },
    { id: 'preferences', label: 'Preferences', shortcut: '6' },
];
function InfoRow({ label, value, mono }) {
    return (_jsxs("div", { className: "flex items-start gap-2 text-[12px]", children: [_jsx("span", { className: "text-slate-500 w-36 flex-shrink-0", children: label }), _jsx("span", { className: `text-slate-300 ${mono ? 'font-mono text-[11px]' : ''}`, children: value || '—' })] }));
}
// ─── Status badge ─────────────────────────────────────────────────────────
function UserStatusBadge({ status }) {
    const cfg = status === 'active'
        ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
        : status === 'inactive'
            ? 'bg-slate-700 text-slate-400 border-slate-600'
            : 'bg-red-900/40 text-red-300 border-red-700';
    return (_jsx("span", { className: `px-2 py-0.5 text-[11px] font-medium rounded border ${cfg}`, children: status }));
}
// ─── Profile sub-tab ──────────────────────────────────────────────────────
function ProfileTab({ data, onChange }) {
    const F = ({ label, field, ro }) => (_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: label }), ro ? (_jsx("div", { className: "h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500", children: String(data[field] ?? '—') })) : (_jsx("input", { type: "text", value: String(data[field] ?? ''), onChange: e => onChange(field, e.target.value), className: "w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" }))] }));
    return (_jsxs("div", { className: "flex-1 overflow-auto p-5", children: [_jsxs("div", { className: "flex items-start gap-6 mb-6", children: [_jsx("div", { className: "w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0", children: _jsx("span", { className: "text-xl font-bold text-white", children: String(data.displayName ?? data.username ?? 'U').slice(0, 2).toUpperCase() }) }), _jsxs("div", { children: [_jsx("div", { className: "text-[18px] font-semibold text-slate-100", children: String(data.displayName ?? '—') }), _jsx("div", { className: "text-[13px] text-slate-500 mt-0.5", children: String(data.email ?? '—') }), _jsx("div", { className: "mt-1", children: _jsx(UserStatusBadge, { status: String(data.status ?? 'active') }) })] })] }), _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(F, { label: "User ID", field: "userId", ro: true }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Username", field: "username", ro: true }), _jsx(F, { label: "Display Name", field: "displayName" })] }), _jsx(F, { label: "Email", field: "email" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "User Type", field: "userType", ro: true }), _jsx(F, { label: "Default Role", field: "defaultRole" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Locale", field: "locale" }), _jsx(F, { label: "Time Zone", field: "timezone" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "MFA Status", field: "mfaStatus", ro: true }), _jsx(F, { label: "Default Project", field: "defaultProject" })] }), _jsxs("div", { className: "border-t border-slate-800 pt-4 grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Created By", field: "createdBy", ro: true }), _jsx(F, { label: "Created On", field: "createdOn", ro: true }), _jsx(F, { label: "Last Login", field: "lastLogin", ro: true }), _jsx(F, { label: "Updated On", field: "updatedOn", ro: true })] })] })] }));
}
// ─── Access sub-tab ───────────────────────────────────────────────────────
function AccessTab({ data }) {
    const roles = data.roles ?? [];
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Assigned Roles" }), roles.length === 0 ? (_jsx("p", { className: "text-[12px] text-slate-600", children: "No roles assigned." })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: roles.map(r => (_jsxs("span", { className: "flex items-center gap-1.5 px-3 py-1 bg-orange-900/30 border border-orange-700/50 rounded text-[12px] text-orange-300", children: [_jsx(Shield, { className: "w-3 h-3" }), r] }, r))) }))] }), _jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Admin Flags" }), [
                            { label: 'Platform Admin', flag: data.isPlatformAdmin },
                            { label: 'User Admin', flag: data.isUserAdmin },
                            { label: 'Audit Access', flag: data.hasAuditAccess },
                        ].map(f => (_jsxs("div", { className: "flex items-center gap-2 text-[12px] py-1", children: [_jsx(UserCheck, { className: `w-3.5 h-3.5 ${f.flag ? 'text-emerald-400' : 'text-slate-600'}` }), _jsx("span", { className: f.flag ? 'text-slate-300' : 'text-slate-600', children: f.label })] }, f.label)))] })] }) }));
}
// ─── Sessions sub-tab ─────────────────────────────────────────────────────
function SessionsTab() {
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Active Sessions" }), _jsxs("div", { className: "flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg", children: [_jsx(Monitor, { className: "w-6 h-6 mb-2 opacity-40" }), _jsx("p", { className: "text-sm", children: "No active sessions to display." })] })] }) }));
}
// ─── Preferences sub-tab ─────────────────────────────────────────────────
function PreferencesTab({ data, onChange }) {
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-lg space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: "Theme" }), _jsxs("select", { value: String(data.theme ?? 'dark'), onChange: e => onChange('theme', e.target.value), className: "h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full", children: [_jsx("option", { value: "dark", children: "Dark" }), _jsx("option", { value: "light", children: "Light" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: "Date Format" }), _jsxs("select", { value: String(data.dateFormat ?? 'YYYY-MM-DD'), onChange: e => onChange('dateFormat', e.target.value), className: "h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full", children: [_jsx("option", { value: "YYYY-MM-DD", children: "YYYY-MM-DD" }), _jsx("option", { value: "DD/MM/YYYY", children: "DD/MM/YYYY" }), _jsx("option", { value: "MM/DD/YYYY", children: "MM/DD/YYYY" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: "Default Landing Page" }), _jsxs("select", { value: String(data.landingPage ?? 'dashboard'), onChange: e => onChange('landingPage', e.target.value), className: "h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full", children: [_jsx("option", { value: "dashboard", children: "Dashboard" }), _jsx("option", { value: "projects", children: "Projects" }), _jsx("option", { value: "monitor", children: "Monitor" })] })] })] }) }));
}
// ─── Main workspace ───────────────────────────────────────────────────────
export function UserWorkspace({ tabId }) {
    const dispatch = useAppDispatch();
    const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
    const subTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'profile');
    const userName = tab?.objectName ?? 'User';
    const [formData, setFormData] = useState({
        userId: tab?.objectId ?? '',
        username: userName,
        displayName: userName,
        email: '',
        status: 'active',
        userType: 'standard',
        defaultRole: '',
        locale: 'en-US',
        timezone: 'UTC',
        mfaStatus: 'Disabled',
        defaultProject: '',
        createdBy: '—', createdOn: '—', lastLogin: '—', updatedOn: '—',
        roles: [],
        isPlatformAdmin: false, isUserAdmin: false, hasAuditAccess: false,
        theme: 'dark', dateFormat: 'YYYY-MM-DD', landingPage: 'dashboard',
    });
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Load real user data on mount
    useEffect(() => {
        const userId = tab?.objectId;
        if (!userId)
            return;
        api.getUser(userId)
            .then(res => {
            const d = res.data?.data ?? res.data;
            if (!d)
                return;
            setFormData(prev => ({
                ...prev,
                userId: d.user_id ?? d.userId ?? prev.userId,
                username: d.user_login_name ?? d.username ?? prev.username,
                displayName: d.user_full_name ?? d.displayName ?? prev.displayName,
                email: d.user_email ?? d.email ?? prev.email,
                status: d.is_active_flag === false ? 'inactive' : 'active',
                userType: d.user_type_code ?? d.userType ?? prev.userType,
                defaultRole: d.default_role_name ?? d.defaultRole ?? prev.defaultRole,
                locale: d.locale_code ?? d.locale ?? prev.locale,
                timezone: d.timezone_code ?? d.timezone ?? prev.timezone,
                mfaStatus: d.mfa_enabled_flag ? 'Enabled' : 'Disabled',
                createdBy: d.created_by_name ?? '—',
                createdOn: d.created_dtm ?? '—',
                lastLogin: d.last_login_dtm ?? '—',
                updatedOn: d.updated_dtm ?? '—',
                roles: d.roles ?? prev.roles,
                isPlatformAdmin: d.is_platform_admin ?? false,
                isUserAdmin: d.is_user_admin ?? false,
                hasAuditAccess: d.has_audit_access ?? false,
            }));
        })
            .catch(() => { });
    }, [tab?.objectId]);
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        dispatch(markTabUnsaved(tabId));
    };
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const userId = tab?.objectId;
            if (userId) {
                await api.updateUser(userId, {
                    displayName: formData.displayName,
                    email: formData.email,
                    locale: formData.locale,
                    timezone: formData.timezone,
                    defaultRole: formData.defaultRole,
                    theme: formData.theme,
                    dateFormat: formData.dateFormat,
                    landingPage: formData.landingPage,
                });
            }
            setIsDirty(false);
            dispatch(markTabSaved(tabId));
        }
        catch (err) {
            alert(err?.response?.data?.userMessage ?? 'Failed to save user profile');
        }
        finally {
            setIsSaving(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden bg-[#0d0f1a]", children: [_jsx(ObjectHeader, { type: "user", name: String(formData.displayName ?? userName), hierarchyPath: tab?.hierarchyPath ?? `Users → ${userName}`, isDirty: isDirty, actions: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs("button", { className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors", children: [_jsx(Key, { className: "w-3.5 h-3.5" }), " Reset Password"] }), _jsxs("button", { className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors", children: [_jsx(Ban, { className: "w-3.5 h-3.5 text-orange-400" }), " Deactivate"] }), isDirty && (_jsxs("button", { onClick: handleSave, disabled: isSaving, className: "flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50", children: [_jsx(Save, { className: "w-3.5 h-3.5" }), isSaving ? 'Saving…' : 'Save'] }))] }) }), _jsx(SubTabBar, { tabId: tabId, tabs: SUB_TABS, defaultTab: "profile" }), subTab === 'profile' && _jsx(ProfileTab, { data: formData, onChange: handleChange }), subTab === 'access' && _jsx(AccessTab, { data: formData }), subTab === 'activity' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [], emptyMessage: "No activity records." }) }), subTab === 'audit' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [], emptyMessage: "No audit records." }) }), subTab === 'sessions' && _jsx(SessionsTab, {}), subTab === 'preferences' && _jsx(PreferencesTab, { data: formData, onChange: handleChange })] }));
}
