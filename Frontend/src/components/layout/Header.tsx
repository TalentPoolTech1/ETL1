import React, { useState, useCallback } from 'react';
import {
  Bell, HelpCircle, Search, Zap, ChevronDown,
  Save, Play, CheckCircle2, Undo2, Redo2,
  Loader2, AlertTriangle,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { markTabSaved } from '@/store/slices/tabsSlice';
import api from '@/services/api';

// ─── Environment selector ─────────────────────────────────────────────────────

const ENVIRONMENTS = ['Development', 'QA', 'Staging', 'Production'];
const ENV_COLORS: Record<string, string> = {
  Development: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
  QA:          'bg-blue-900/40 text-blue-300 border-blue-700',
  Staging:     'bg-amber-900/40 text-amber-300 border-amber-700',
  Production:  'bg-red-900/40 text-red-300 border-red-700',
};

function EnvironmentSelector() {
  const [env, setEnv]   = useState('Development');
  const [open, setOpen] = useState(false);
  const colorClass = ENV_COLORS[env] ?? ENV_COLORS['Development']!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded border text-[12px] font-medium transition-colors ${colorClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        {env}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1d2e] border border-slate-700 rounded-lg shadow-xl py-1 min-w-[140px]">
            {ENVIRONMENTS.map(e => (
              <button key={e} onClick={() => { setEnv(e); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-slate-700 ${e === env ? 'text-blue-300' : 'text-slate-300'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  e === 'Production' ? 'bg-red-400' : e === 'Staging' ? 'bg-amber-400' : e === 'QA' ? 'bg-blue-400' : 'bg-emerald-400'
                }`} />
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function TBtn({ icon: Icon, label, onClick, disabled, variant = 'ghost', title, loading }: {
  icon: React.ElementType; label?: string; onClick?: () => void; disabled?: boolean;
  variant?: 'ghost' | 'primary' | 'success' | 'warning'; title?: string; loading?: boolean;
}) {
  const base = 'flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';
  const colors = {
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
    primary: 'text-blue-300 hover:text-blue-100 hover:bg-blue-900/40',
    success: 'bg-emerald-700 hover:bg-emerald-600 text-white',
    warning: 'bg-amber-700 hover:bg-amber-600 text-white',
  };
  return (
    <button title={title ?? label} onClick={onClick} disabled={disabled || loading} className={`${base} ${colors[variant]}`}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label && <span className="hidden md:inline">{label}</span>}
    </button>
  );
}

// ─── Context-aware toolbar ────────────────────────────────────────────────────
// All useAppSelector calls return primitives to avoid new-reference re-render warnings.

function ToolbarActions() {
  const dispatch       = useAppDispatch();
  const activeTabId    = useAppSelector(s => s.tabs.activeTabId);
  const activeTab      = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));
  const activePipeline = useAppSelector(s => s.pipeline.activePipeline);
  const unsaved        = useAppSelector(s => s.pipeline.unsavedChanges);
  // ↓ count (number) — stable reference, no memoization needed

  const [isSaving, setIsSaving]       = useState(false);
  const [isRunning, setIsRunning]     = useState(false);
  const [isValidating, setValidating] = useState(false);

  const type     = activeTab?.type;
  const objectId = activeTab?.objectId ?? '';

  const handleSave = useCallback(async () => {
    if (!activeTab || isSaving) return;
    setIsSaving(true);
    try {
      if (type === 'pipeline' && activePipeline) {
        await api.savePipeline(activePipeline.id, {
          pipelineDisplayName: activePipeline.name,
          pipelineDescText: activePipeline.description,
          nodes: activePipeline.nodes,
          edges: activePipeline.edges,
          changeSummary: 'Saved from Header toolbar',
        });
      }
      dispatch(markTabSaved(activeTab.id));
    } catch (err: unknown) {
      alert((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Save failed');
    }
    finally { setIsSaving(false); }
  }, [activeTab, activePipeline, isSaving, type, dispatch]);

  const handleRun = useCallback(async () => {
    if (isRunning || !objectId) return;
    setIsRunning(true);
    try {
      if (type === 'pipeline')          await api.runPipeline(objectId);
      else if (type === 'orchestrator') await api.runOrchestrator(objectId);
    } catch { /* handled in execution tab */ }
    finally { setIsRunning(false); }
  }, [type, objectId, isRunning]);

  const handleValidate = useCallback(async () => {
    if (isValidating || !objectId) return;
    setValidating(true);
    try {
      if (type === 'pipeline') await api.validatePipeline(objectId);
    } catch { /* noop */ }
    finally { setValidating(false); }
  }, [type, objectId, isValidating]);

  const canRun      = type === 'pipeline' || type === 'orchestrator';
  const canValidate = type === 'pipeline' || type === 'orchestrator';
  const hasDirty    = !!(unsaved || activeTab?.isDirty || activeTab?.unsaved);

  return (
    <div className="flex items-center gap-0.5">
      {type === 'pipeline' && (
        <>
          <TBtn icon={Undo2} title="Undo (Ctrl+Z)" disabled />
          <TBtn icon={Redo2} title="Redo (Ctrl+Y)" disabled />
          <div className="w-px h-5 bg-slate-700 mx-1 flex-shrink-0" />
        </>
      )}

      <TBtn icon={Save} label={hasDirty ? 'Save*' : 'Save'} title="Save (Ctrl+S)"
        onClick={handleSave} loading={isSaving}
        disabled={!activeTab}
        variant={hasDirty ? 'warning' : 'ghost'} />

      <div className="w-px h-5 bg-slate-700 mx-1 flex-shrink-0" />

      {canValidate && (
        <TBtn icon={CheckCircle2} label="Validate" title="Validate"
          onClick={handleValidate} loading={isValidating} variant="ghost" />
      )}

      {canRun && (
        <TBtn icon={Play} label="Run" title="Run (F5)"
          onClick={handleRun} loading={isRunning} variant="success" />
      )}

    </div>
  );
}

// ─── Main Header ──────────────────────────────────────────────────────────────

export function Header() {
  const dispatch = useAppDispatch();
  const user     = useAppSelector(s => s.auth.user);
  // Primitive count — stable reference, no memoization warning
  const dirtyCount = useAppSelector(s => s.tabs.allTabs.filter(t => t.isDirty || t.unsaved).length);

  const displayName = user?.fullName ?? user?.email ?? 'User';
  const initials    = displayName.split(' ').map((w: string) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');

  return (
    <header className="h-9 bg-[#0a0c15] border-b border-slate-800 flex items-center px-3 gap-2 flex-shrink-0 z-20">

      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shadow-md shadow-blue-900/50">
          <Zap className="w-3.5 h-3.5 text-white" fill="currentColor" />
        </div>
        <span className="text-sm font-bold text-slate-100 tracking-tight hidden sm:block">ETL1</span>
      </div>

      <div className="w-px h-5 bg-slate-800 flex-shrink-0" />

      <ToolbarActions />

      <div className="w-px h-5 bg-slate-800 flex-shrink-0 mx-1" />

      {dirtyCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded text-[11px] text-amber-300 flex-shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {dirtyCount} unsaved
        </div>
      )}

      {/* Global search placeholder */}
      <div className="flex-1 max-w-[220px] min-w-0 relative mx-1">
        <button
          type="button"
          className="w-full h-6 pl-6 pr-2 bg-slate-800/60 border border-slate-700/60 rounded text-[11px] text-left text-slate-500 hover:text-slate-300 transition-colors"
          title="Global search is not yet available. Use Command Palette (Ctrl/Cmd+K)."
        >
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
          Global search coming soon (use Ctrl/Cmd+K)
        </button>
      </div>

      <div className="flex-1" />

      <EnvironmentSelector />

      <button title="Notifications"
        className="relative w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors flex-shrink-0">
        <Bell className="w-3.5 h-3.5" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-[#0a0c15]" />
      </button>

      <button title="Help & documentation"
        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors flex-shrink-0">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-5 bg-slate-800 mx-1 flex-shrink-0" />

      <button
        title={`Signed in as ${displayName} — click to sign out`}
        onClick={() => dispatch(logout())}
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-700 transition-colors flex-shrink-0"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[11px] font-bold leading-none select-none">{initials || 'U'}</span>
        </div>
        <span className="hidden lg:inline text-[12px] text-slate-400 max-w-[100px] truncate">{displayName}</span>
        <ChevronDown className="w-3 h-3 text-slate-600" />
      </button>
    </header>
  );
}
