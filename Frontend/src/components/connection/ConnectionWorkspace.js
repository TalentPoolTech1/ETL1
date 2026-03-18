import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * ConnectionWorkspace — tab content for a Connection object.
 * Sub-tabs: Properties | Authentication | Connectivity | Usage | History | Permissions | Security
 */
import { useEffect, useState, useCallback } from 'react';
import { Save, TestTube2, RefreshCw, Eye, EyeOff, CheckCircle2, XCircle, Loader2, AlertTriangle, Clock, } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
import api from '@/services/api';
const SUB_TABS = [
    { id: 'properties', label: 'Properties', shortcut: '1' },
    { id: 'authentication', label: 'Authentication', shortcut: '2' },
    { id: 'connectivity', label: 'Connectivity', shortcut: '3' },
    { id: 'usage', label: 'Usage', shortcut: '4' },
    { id: 'history', label: 'History', shortcut: '5' },
    { id: 'permissions', label: 'Permissions', shortcut: '6' },
    { id: 'security', label: 'Security', shortcut: '7' },
];
function Field({ label, field, value, onChange, ro, secret, placeholder }) {
    const [show, setShow] = useState(false);
    return (_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: label }), _jsxs("div", { className: "relative", children: [ro ? (_jsx("div", { className: "h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono", children: value || '—' })) : (_jsx("input", { type: secret && !show ? 'password' : 'text', value: value, onChange: e => onChange?.(field, e.target.value), placeholder: placeholder, className: "w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 pr-8" })), secret && !ro && (_jsx("button", { type: "button", onClick: () => setShow(v => !v), className: "absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300", children: show ? _jsx(EyeOff, { className: "w-3.5 h-3.5" }) : _jsx(Eye, { className: "w-3.5 h-3.5" }) }))] })] }));
}
// ─── Properties sub-tab ───────────────────────────────────────────────────
function PropertiesTab({ data, onChange }) {
    const F = (p) => (_jsx(Field, { label: p.label, field: p.field, value: String(data[p.field] ?? ''), onChange: onChange, ro: p.ro, placeholder: p.placeholder }));
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(F, { label: "Connection ID", field: "connectionId", ro: true }), _jsx(F, { label: "Connection Name *", field: "name" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Technology Type", field: "technologyType" }), _jsx(F, { label: "Vendor / Platform", field: "vendor" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Category", field: "category" }), _jsx(F, { label: "Environment", field: "environment" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Host / Endpoint", field: "host", placeholder: "hostname or IP" }), _jsx(F, { label: "Port", field: "port", placeholder: "5432" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Database / Bucket / Container", field: "database" }), _jsx(F, { label: "Region", field: "region" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: "Description" }), _jsx("textarea", { rows: 2, value: String(data.description ?? ''), onChange: e => onChange('description', e.target.value), className: "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" })] }), _jsx(F, { label: "Tags (comma separated)", field: "tags" }), _jsxs("div", { className: "border-t border-slate-800 pt-4 grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Owner", field: "owner" }), _jsx(F, { label: "Status", field: "status", ro: true }), _jsx(F, { label: "Created By", field: "createdBy", ro: true }), _jsx(F, { label: "Created On", field: "createdOn", ro: true }), _jsx(F, { label: "Updated By", field: "updatedBy", ro: true }), _jsx(F, { label: "Updated On", field: "updatedOn", ro: true })] })] }) }));
}
// ─── Authentication sub-tab ───────────────────────────────────────────────
function AuthenticationTab({ data, onChange }) {
    const authMode = String(data.authMode ?? 'username_password');
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: "Authentication Mode" }), _jsxs("select", { value: authMode, onChange: e => onChange('authMode', e.target.value), className: "h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full", children: [_jsx("option", { value: "username_password", children: "Username / Password" }), _jsx("option", { value: "key_file", children: "Key File" }), _jsx("option", { value: "oauth", children: "OAuth 2.0" }), _jsx("option", { value: "iam_role", children: "IAM Role" }), _jsx("option", { value: "service_account", children: "Service Account" }), _jsx("option", { value: "no_auth", children: "No Authentication" })] })] }), (authMode === 'username_password' || authMode === 'key_file') && (_jsx(Field, { label: "Username", field: "username", value: String(data.username ?? ''), onChange: onChange })), authMode === 'username_password' && (_jsx(Field, { label: "Password", field: "password", value: String(data.password ?? ''), onChange: onChange, secret: true, placeholder: "Stored securely \u2014 not displayed" })), authMode === 'key_file' && (_jsx(Field, { label: "Key File Reference", field: "keyFileRef", value: String(data.keyFileRef ?? ''), onChange: onChange, placeholder: "vault:// or secret:// reference" })), authMode === 'oauth' && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Client ID", field: "oauthClientId", value: String(data.oauthClientId ?? ''), onChange: onChange }), _jsx(Field, { label: "Client Secret", field: "oauthClientSecret", value: String(data.oauthClientSecret ?? ''), onChange: onChange, secret: true }), _jsx(Field, { label: "Token Endpoint", field: "oauthTokenEndpoint", value: String(data.oauthTokenEndpoint ?? ''), onChange: onChange }), _jsxs("div", { className: "bg-slate-800/40 border border-slate-700 rounded p-3 text-[12px]", children: [_jsx("span", { className: "text-slate-500", children: "Token Expiry: " }), _jsx("span", { className: "text-slate-300", children: String(data.tokenExpiry ?? 'Unknown') })] })] })), authMode === 'service_account' && (_jsx(Field, { label: "Service Account JSON Path", field: "serviceAccountPath", value: String(data.serviceAccountPath ?? ''), onChange: onChange })), _jsxs("div", { className: "border-t border-slate-800 pt-4 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "checkbox", id: "ssl", checked: Boolean(data.sslEnabled), onChange: e => onChange('sslEnabled', String(e.target.checked)), className: "w-3.5 h-3.5 accent-blue-500" }), _jsx("label", { htmlFor: "ssl", className: "text-[12px] text-slate-300", children: "SSL / TLS Enabled" })] }), data.sslEnabled && (_jsx(Field, { label: "Certificate Alias", field: "certAlias", value: String(data.certAlias ?? ''), onChange: onChange, placeholder: "Optional \u2014 leave blank for default" }))] }), _jsx("div", { className: "bg-amber-900/20 border border-amber-700/40 rounded p-3 text-[11px] text-amber-300/80", children: "Sensitive values are stored encrypted. Existing secrets cannot be viewed after save \u2014 only replaced." })] }) }));
}
function ConnectivityTab({ connectionId }) {
    const [status, setStatus] = useState('idle');
    const [lastResult, setResult] = useState(null);
    const runTest = useCallback(async () => {
        setStatus('testing');
        try {
            const res = await api.testConnectionById(connectionId);
            const d = res.data?.data ?? res.data;
            setStatus('success');
            setResult({ testedBy: 'You', testedOn: new Date().toLocaleString(), responseMs: d?.responseMs });
        }
        catch (err) {
            setStatus('failed');
            setResult({ testedBy: 'You', testedOn: new Date().toLocaleString(), error: err?.response?.data?.userMessage ?? 'Connection failed' });
        }
    }, [connectionId]);
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-lg space-y-4", children: [_jsxs("button", { onClick: runTest, disabled: status === 'testing', className: "flex items-center gap-2 h-9 px-5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-60", children: [status === 'testing' ? _jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : _jsx(TestTube2, { className: "w-4 h-4" }), status === 'testing' ? 'Testing…' : 'Test Connection'] }), status === 'success' && lastResult && (_jsxs("div", { className: "flex items-start gap-3 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg", children: [_jsx(CheckCircle2, { className: "w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("div", { className: "text-[13px] font-medium text-emerald-300", children: "Connection Successful" }), lastResult.responseMs !== undefined && (_jsxs("div", { className: "text-[12px] text-slate-400 mt-0.5", children: ["Response time: ", lastResult.responseMs, "ms"] })), _jsxs("div", { className: "text-[11px] text-slate-500 mt-1", children: ["Tested by ", lastResult.testedBy, " \u00B7 ", lastResult.testedOn] })] })] })), status === 'failed' && lastResult && (_jsxs("div", { className: "flex items-start gap-3 p-4 bg-red-900/30 border border-red-700/50 rounded-lg", children: [_jsx(XCircle, { className: "w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("div", { className: "text-[13px] font-medium text-red-300", children: "Connection Failed" }), _jsx("div", { className: "text-[12px] text-slate-400 mt-0.5", children: lastResult.error }), _jsxs("div", { className: "text-[11px] text-slate-500 mt-1", children: ["Tested by ", lastResult.testedBy, " \u00B7 ", lastResult.testedOn] })] })] })), status === 'idle' && (_jsxs("div", { className: "text-[12px] text-slate-600 flex items-center gap-2", children: [_jsx(Clock, { className: "w-3.5 h-3.5" }), " Click \"Test Connection\" to verify connectivity."] }))] }) }));
}
// ─── Usage sub-tab ────────────────────────────────────────────────────────
function UsageTab() {
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Used By" }), _jsxs("div", { className: "flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg", children: [_jsx(RefreshCw, { className: "w-6 h-6 mb-2 opacity-40" }), _jsx("p", { className: "text-sm", children: "Usage data will be loaded once the connection is saved and in use." })] })] }) }));
}
// ─── Security sub-tab ─────────────────────────────────────────────────────
function SecurityTab({ data }) {
    const rows = [
        { label: 'Secret Source', value: String(data.secretSource ?? 'Platform Vault') },
        { label: 'Rotation Policy', value: String(data.rotationPolicy ?? 'Manual') },
        { label: 'Last Rotated On', value: String(data.lastRotatedOn ?? '—') },
        { label: 'Rotation Owner', value: String(data.rotationOwner ?? '—') },
        { label: 'Masking Status', value: String(data.maskingStatus ?? 'Enabled') },
    ];
    return (_jsxs("div", { className: "flex-1 overflow-auto p-5", children: [_jsxs("div", { className: "max-w-lg bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-3", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2", children: "Security Configuration" }), rows.map(r => (_jsxs("div", { className: "flex items-center text-[12px]", children: [_jsx("span", { className: "text-slate-500 w-40 flex-shrink-0", children: r.label }), _jsx("span", { className: "text-slate-300", children: r.value })] }, r.label))), _jsxs("div", { className: "pt-2 border-t border-slate-700", children: [_jsx("div", { className: "text-[11px] text-slate-500 mb-1", children: "Restricted Fields" }), _jsx("div", { className: "flex flex-wrap gap-1", children: ['password', 'secret', 'token', 'key'].map(f => (_jsx("span", { className: "px-2 py-0.5 bg-red-900/30 border border-red-700/40 text-red-300 text-[11px] rounded", children: f }, f))) })] })] }), _jsxs("div", { className: "mt-4 flex items-start gap-2 text-[12px] text-amber-300/80 max-w-lg", children: [_jsx(AlertTriangle, { className: "w-4 h-4 flex-shrink-0 mt-0.5" }), "Secret fields are masked by default. Only users with Manage Secrets permission can modify secret references."] })] }));
}
// ─── Main workspace ───────────────────────────────────────────────────────
export function ConnectionWorkspace({ tabId }) {
    const dispatch = useAppDispatch();
    const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
    const subTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'properties');
    const connectionId = tab?.objectId ?? '';
    const connectionName = tab?.objectName ?? 'Connection';
    const [formData, setFormData] = useState({
        connectionId,
        name: connectionName,
        technologyType: '',
        vendor: '',
        category: '',
        environment: 'Development',
        host: '', port: '', database: '', region: '',
        description: '', tags: '', owner: '',
        authMode: 'username_password',
        username: '', password: '', sslEnabled: false, certAlias: '',
        status: 'active',
        createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
        secretSource: 'Platform Vault', rotationPolicy: 'Manual', maskingStatus: 'Enabled',
    });
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => {
        if (!connectionId)
            return;
        api.getConnection(connectionId).then(res => {
            const d = res.data?.data ?? res.data;
            if (d)
                setFormData(prev => ({ ...prev, ...d }));
        }).catch(() => { });
    }, [connectionId]);
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        dispatch(markTabUnsaved(tabId));
    };
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.updateConnection(connectionId, formData);
            setIsDirty(false);
            dispatch(markTabSaved(tabId));
        }
        catch { /* noop */ }
        finally {
            setIsSaving(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden bg-[#0d0f1a]", children: [_jsx(ObjectHeader, { type: "connection", name: String(formData.name ?? connectionName), hierarchyPath: tab?.hierarchyPath ?? `Connections → ${connectionName}`, status: "published", isDirty: isDirty, actions: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs("button", { onClick: () => api.testConnectionById(connectionId), className: "flex items-center gap-1.5 h-7 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[12px] font-medium transition-colors", children: [_jsx(TestTube2, { className: "w-3.5 h-3.5" }), " Test"] }), isDirty && (_jsxs("button", { onClick: handleSave, disabled: isSaving, className: "flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50", children: [_jsx(Save, { className: "w-3.5 h-3.5" }), isSaving ? 'Saving…' : 'Save'] }))] }) }), _jsx(SubTabBar, { tabId: tabId, tabs: SUB_TABS, defaultTab: "properties" }), subTab === 'properties' && _jsx(PropertiesTab, { data: formData, onChange: handleChange }), subTab === 'authentication' && _jsx(AuthenticationTab, { data: formData, onChange: handleChange }), subTab === 'connectivity' && _jsx(ConnectivityTab, { connectionId: connectionId }), subTab === 'usage' && _jsx(UsageTab, {}), subTab === 'history' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [] }) }), subTab === 'permissions' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectPermissionsGrid, { rows: [] }) }), subTab === 'security' && _jsx(SecurityTab, { data: formData })] }));
}
