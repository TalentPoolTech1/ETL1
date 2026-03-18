import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Bell, HelpCircle, Search, Zap, ChevronDown,
  Save, Play, CheckCircle2, Undo2, Redo2,
  Loader2, AlertTriangle, Upload, Layers,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { markTabSaved } from '@/store/slices/tabsSlice';
import api from '@/services/api';

// ─── Environment selector ─────────────────────────────────────────────────────

const FALLBACK_ENV_COLORS: Record<string, string> = {
  default: 'bg-slate-800/40 text-slate-300 border-slate-700',
  prod:    'bg-red-900/40 text-red-300 border-red-700',
  nonProd: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
};

function EnvironmentSelector() {
  const [env, setEnv]   = useState<string>('');
  const [open, setOpen] = useState(false);
  const [envs, setEnvs] = useState<Array<{ env_id: string; env_display_name: string; is_prod_env_flag: boolean }>>([]);

  useEffect(() => {
    let mounted = true;
    api.getEnvironments()
      .then(res => {
        const rows = (res.data as any)?.data ?? [];
        const normalized = Array.isArray(rows) ? rows : [];
        if (!mounted) return;
        setEnvs(normalized);
        if (!env && normalized.length > 0) setEnv(String(normalized[0].env_display_name ?? ''));
      })
      .catch(() => {
        // Keep selector usable even if environments endpoint is unavailable.
        if (!mounted) return;
        setEnvs([]);
        if (!env) setEnv('Default');
      });
    return () => { mounted = false; };
  }, [env]);

  const colorClass = useMemo(() => {
    const match = envs.find(e => String(e.env_display_name) === env);
    if (!match) return FALLBACK_ENV_COLORS.default;
    return match.is_prod_env_flag ? FALLBACK_ENV_COLORS.prod : FALLBACK_ENV_COLORS.nonProd;
  }, [env, envs]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded border text-[12px] font-medium transition-colors ${colorClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        {env || 'Environment'}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1d2e] border border-slate-700 rounded-lg shadow-xl py-1 min-w-[140px]">
            {(envs.length > 0 ? envs : [{ env_id: 'default', env_display_name: env || 'Default', is_prod_env_flag: false }]).map(e => {
              const name = String((e as any).env_display_name ?? 'Default');
              const isProd = Boolean((e as any).is_prod_env_flag);
              return (
                <button key={String((e as any).env_id ?? name)} onClick={() => { setEnv(name); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-slate-700 ${name === env ? 'text-blue-300' : 'text-slate-300'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isProd ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  {name}
                </button>
              );
            })}
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
  const base = 'flex items-center gap-1 h-[22px] px-1.5 rounded text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';
  const colors = {
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60',
    primary: 'text-blue-300 hover:text-blue-100 hover:bg-blue-900/40',
    success: 'bg-emerald-700/80 hover:bg-emerald-600 text-white',
    warning: 'bg-amber-700/80 hover:bg-amber-600 text-white',
  };
  return (
    <button title={title ?? label} onClick={onClick} disabled={disabled || loading} className={`${base} ${colors[variant]}`}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" strokeWidth={1.5} />}
      {label && <span className="hidden lg:inline ml-0.5">{label}</span>}
    </button>
  );
}

// ─── Context-aware toolbar ────────────────────────────────────────────────────
// All useAppSelector calls return primitives to avoid new-reference re-render warnings.

function ToolbarActions() {
  const dispatch       = useAppDispatch();
  const activeTabId    = useAppSelector(s => s.tabs.activeTabId);
  const activeTab      = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));
  const allTabs        = useAppSelector(s => s.tabs.allTabs);
  const activePipeline = useAppSelector(s => s.pipeline.activePipeline);
  const unsaved        = useAppSelector(s => s.pipeline.unsavedChanges);
  // ↓ count (number) — stable reference, no memoization needed

  const [isSaving, setIsSaving]       = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isPublishing, setPublishing] = useState(false);
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

  const handleSaveAll = useCallback(async () => {
    if (isSavingAll) return;
    setIsSavingAll(true);
    try {
      // Save the active pipeline (full canvas data from Redux)
      if (type === 'pipeline' && activePipeline && activeTab) {
        await api.savePipeline(activePipeline.id, {
          pipelineDisplayName: activePipeline.name,
          pipelineDescText: activePipeline.description,
          nodes: activePipeline.nodes,
          edges: activePipeline.edges,
          changeSummary: 'Saved via Save All',
        });
        dispatch(markTabSaved(activeTab.id));
      }
      // For non-active dirty pipeline tabs: save metadata only (no canvas data available without load)
      const otherDirtyPipelineTabs = allTabs.filter(
        t => t.isDirty && t.type === 'pipeline' && t.id !== activeTab?.id,
      );
      await Promise.allSettled(
        otherDirtyPipelineTabs.map(t =>
          api.savePipeline(t.objectId, { pipelineDisplayName: t.objectName })
            .then(() => dispatch(markTabSaved(t.id)))
            .catch(() => { /* tab stays dirty */ }),
        ),
      );
    } catch (err: unknown) {
      alert((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Save All failed');
    } finally {
      setIsSavingAll(false);
    }
  }, [allTabs, activeTab, activePipeline, isSavingAll, type, dispatch]);

  const handlePublish = useCallback(async () => {
    if (isPublishing || !objectId || type !== 'pipeline') return;
    setPublishing(true);
    try {
      await api.generateCode(objectId);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [type, objectId, isPublishing]);

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

      <TBtn icon={Layers} label="Save All" title="Save All dirty tabs (Ctrl+Shift+S)"
        onClick={handleSaveAll} loading={isSavingAll}
        disabled={!allTabs.some(t => t.isDirty || t.unsaved)}
        variant="ghost" />

      <div className="w-px h-5 bg-slate-700 mx-1 flex-shrink-0" />

      {canValidate && (
        <TBtn icon={CheckCircle2} label="Validate" title="Validate"
          onClick={handleValidate} loading={isValidating} variant="ghost" />
      )}

      {canRun && (
        <TBtn icon={Play} label="Run" title="Run (F5)"
          onClick={handleRun} loading={isRunning} variant="success" />
      )}

      {type === 'pipeline' && (
        <TBtn icon={Upload} label="Publish" title="Generate & publish code"
          onClick={handlePublish} loading={isPublishing} variant="primary" />
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
    <header className="h-8 bg-[#0a0c15] border-b border-slate-800 flex items-center px-3 gap-2 flex-shrink-0 z-20">

      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center shadow-md shadow-blue-900/50">
          <Zap className="w-3 h-3 text-white" fill="currentColor" />
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

      <div className="flex-1" />

      {/* Global search placeholder */}
      <div className="w-[300px] relative">
        <button
          type="button"
          className="w-full h-[22px] pl-7 pr-2 bg-slate-800/40 border border-slate-700/50 rounded text-[10px] text-left text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-all"
          title="Global search is not yet available. Use Command Palette (Ctrl/Cmd+K)."
        >
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
          Search pipelines, orchestrators... (Ctrl+K)
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
