import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { Bell, HelpCircle, Search, Zap, ChevronDown, Save, Play, CheckCircle2, Upload, Undo2, Redo2, Loader2, AlertTriangle, } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { markTabSaved } from '@/store/slices/tabsSlice';
import api from '@/services/api';
// ─── Environment selector ─────────────────────────────────────────────────────
const ENVIRONMENTS = ['Development', 'QA', 'Staging', 'Production'];
const ENV_COLORS = {
    Development: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
    QA: 'bg-blue-900/40 text-blue-300 border-blue-700',
    Staging: 'bg-amber-900/40 text-amber-300 border-amber-700',
    Production: 'bg-red-900/40 text-red-300 border-red-700',
};
function EnvironmentSelector() {
    const [env, setEnv] = useState('Development');
    const [open, setOpen] = useState(false);
    const colorClass = ENV_COLORS[env] ?? ENV_COLORS['Development'];
    return (_jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setOpen(v => !v), className: `flex items-center gap-1.5 h-7 px-2.5 rounded border text-[12px] font-medium transition-colors ${colorClass}`, children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-current opacity-80" }), env, _jsx(ChevronDown, { className: "w-3 h-3 opacity-60" })] }), open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40", onClick: () => setOpen(false) }), _jsx("div", { className: "absolute right-0 top-full mt-1 z-50 bg-[#1a1d2e] border border-slate-700 rounded-lg shadow-xl py-1 min-w-[140px]", children: ENVIRONMENTS.map(e => (_jsxs("button", { onClick: () => { setEnv(e); setOpen(false); }, className: `w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-slate-700 ${e === env ? 'text-blue-300' : 'text-slate-300'}`, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${e === 'Production' ? 'bg-red-400' : e === 'Staging' ? 'bg-amber-400' : e === 'QA' ? 'bg-blue-400' : 'bg-emerald-400'}` }), e] }, e))) })] }))] }));
}
// ─── Toolbar button ───────────────────────────────────────────────────────────
function TBtn({ icon: Icon, label, onClick, disabled, variant = 'ghost', title, loading }) {
    const base = 'flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';
    const colors = {
        ghost: 'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
        primary: 'text-blue-300 hover:text-blue-100 hover:bg-blue-900/40',
        success: 'bg-emerald-700 hover:bg-emerald-600 text-white',
        warning: 'bg-amber-700 hover:bg-amber-600 text-white',
    };
    return (_jsxs("button", { title: title ?? label, onClick: onClick, disabled: disabled || loading, className: `${base} ${colors[variant]}`, children: [loading ? _jsx(Loader2, { className: "w-3 h-3 animate-spin" }) : _jsx(Icon, { className: "w-3 h-3" }), label && _jsx("span", { className: "hidden md:inline", children: label })] }));
}
// ─── Context-aware toolbar ────────────────────────────────────────────────────
// All useAppSelector calls return primitives to avoid new-reference re-render warnings.
function ToolbarActions() {
    const dispatch = useAppDispatch();
    const activeTabId = useAppSelector(s => s.tabs.activeTabId);
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));
    const activePipeline = useAppSelector(s => s.pipeline.activePipeline);
    const unsaved = useAppSelector(s => s.pipeline.unsavedChanges);
    // ↓ count (number) — stable reference, no memoization needed
    const dirtyTabCount = useAppSelector(s => s.tabs.allTabs.filter(t => t.isDirty || t.unsaved).length);
    const [isSaving, setIsSaving] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isValidating, setValidating] = useState(false);
    const type = activeTab?.type;
    const objectId = activeTab?.objectId ?? '';
    const handleSave = useCallback(async () => {
        if (!activeTab || isSaving)
            return;
        setIsSaving(true);
        try {
            if (type === 'pipeline' && activePipeline) {
                await api.savePipeline(activePipeline.id, activePipeline);
            }
            dispatch(markTabSaved(activeTab.id));
        }
        catch { /* workspace handles its own errors */ }
        finally {
            setIsSaving(false);
        }
    }, [activeTab, activePipeline, isSaving, type, dispatch]);
    const handleRun = useCallback(async () => {
        if (isRunning || !objectId)
            return;
        setIsRunning(true);
        try {
            if (type === 'pipeline')
                await api.runPipeline(objectId);
            else if (type === 'orchestrator')
                await api.runOrchestrator(objectId);
        }
        catch { /* handled in execution tab */ }
        finally {
            setIsRunning(false);
        }
    }, [type, objectId, isRunning]);
    const handleValidate = useCallback(async () => {
        if (isValidating || !objectId)
            return;
        setValidating(true);
        try {
            if (type === 'pipeline')
                await api.validatePipeline(objectId);
        }
        catch { /* noop */ }
        finally {
            setValidating(false);
        }
    }, [type, objectId, isValidating]);
    const canRun = type === 'pipeline' || type === 'orchestrator';
    const canValidate = type === 'pipeline' || type === 'orchestrator';
    const canPublish = type === 'pipeline' || type === 'orchestrator';
    const hasDirty = !!(unsaved || activeTab?.isDirty || activeTab?.unsaved);
    return (_jsxs("div", { className: "flex items-center gap-0.5", children: [type === 'pipeline' && (_jsxs(_Fragment, { children: [_jsx(TBtn, { icon: Undo2, title: "Undo (Ctrl+Z)", disabled: true }), _jsx(TBtn, { icon: Redo2, title: "Redo (Ctrl+Y)", disabled: true }), _jsx("div", { className: "w-px h-5 bg-slate-700 mx-1 flex-shrink-0" })] })), _jsx(TBtn, { icon: Save, label: hasDirty ? 'Save*' : 'Save', title: "Save (Ctrl+S)", onClick: handleSave, loading: isSaving, disabled: !activeTab, variant: hasDirty ? 'warning' : 'ghost' }), dirtyTabCount > 1 && (_jsx(TBtn, { icon: Save, label: `Save All (${dirtyTabCount})`, title: "Save all dirty tabs", onClick: handleSave, variant: "warning" })), _jsx("div", { className: "w-px h-5 bg-slate-700 mx-1 flex-shrink-0" }), canValidate && (_jsx(TBtn, { icon: CheckCircle2, label: "Validate", title: "Validate", onClick: handleValidate, loading: isValidating, variant: "ghost" })), canRun && (_jsx(TBtn, { icon: Play, label: "Run", title: "Run (F5)", onClick: handleRun, loading: isRunning, variant: "success" })), canPublish && (_jsx(TBtn, { icon: Upload, label: "Publish", title: "Publish / Promote", variant: "primary" }))] }));
}
// ─── Main Header ──────────────────────────────────────────────────────────────
export function Header() {
    const dispatch = useAppDispatch();
    const user = useAppSelector(s => s.auth.user);
    // Primitive count — stable reference, no memoization warning
    const dirtyCount = useAppSelector(s => s.tabs.allTabs.filter(t => t.isDirty || t.unsaved).length);
    const displayName = user?.fullName ?? user?.email ?? 'User';
    const initials = displayName.split(' ').map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
    return (_jsxs("header", { className: "h-9 bg-[#0a0c15] border-b border-slate-800 flex items-center px-3 gap-2 flex-shrink-0 z-20", children: [_jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [_jsx("div", { className: "w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shadow-md shadow-blue-900/50", children: _jsx(Zap, { className: "w-3.5 h-3.5 text-white", fill: "currentColor" }) }), _jsx("span", { className: "text-sm font-bold text-slate-100 tracking-tight hidden sm:block", children: "ETL1" })] }), _jsx("div", { className: "w-px h-5 bg-slate-800 flex-shrink-0" }), _jsx(ToolbarActions, {}), _jsx("div", { className: "w-px h-5 bg-slate-800 flex-shrink-0 mx-1" }), dirtyCount > 0 && (_jsxs("div", { className: "flex items-center gap-1 px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded text-[11px] text-amber-300 flex-shrink-0", children: [_jsx(AlertTriangle, { className: "w-3 h-3" }), dirtyCount, " unsaved"] })), _jsxs("div", { className: "flex-1 max-w-[220px] min-w-0 relative mx-1", children: [_jsx(Search, { className: "absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" }), _jsx("input", { type: "search", placeholder: "Search objects\u2026", className: "w-full h-6 pl-6 pr-10 bg-slate-800/60 border border-slate-700/60 rounded text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 focus:bg-slate-800 transition-all" }), _jsx("kbd", { className: "absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-600 font-mono bg-slate-800 border border-slate-700 rounded px-1 pointer-events-none", children: "\u2318K" })] }), _jsx("div", { className: "flex-1" }), _jsx(EnvironmentSelector, {}), _jsxs("button", { title: "Notifications", className: "relative w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors flex-shrink-0", children: [_jsx(Bell, { className: "w-3.5 h-3.5" }), _jsx("span", { className: "absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-[#0a0c15]" })] }), _jsx("button", { title: "Help & documentation", className: "w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors flex-shrink-0", children: _jsx(HelpCircle, { className: "w-3.5 h-3.5" }) }), _jsx("div", { className: "w-px h-5 bg-slate-800 mx-1 flex-shrink-0" }), _jsxs("button", { title: `Signed in as ${displayName} — click to sign out`, onClick: () => dispatch(logout()), className: "flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-700 transition-colors flex-shrink-0", children: [_jsx("div", { className: "w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0", children: _jsx("span", { className: "text-white text-[11px] font-bold leading-none select-none", children: initials || 'U' }) }), _jsx("span", { className: "hidden lg:inline text-[12px] text-slate-400 max-w-[100px] truncate", children: displayName }), _jsx(ChevronDown, { className: "w-3 h-3 text-slate-600" })] })] }));
}
