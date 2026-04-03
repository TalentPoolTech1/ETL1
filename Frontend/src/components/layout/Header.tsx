import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Bell, HelpCircle, Search, Zap, ChevronDown,
  Save, Play, CheckCircle2, Undo2, Redo2,
  Loader2, AlertTriangle, Upload, Layers,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { markTabSaved } from '@/store/slices/tabsSlice';
import { markSaved } from '@/store/slices/pipelineSlice';
import api from '@/services/api';

// ─── Environment selector ─────────────────────────────────────────────────────

function EnvironmentSelector() {
  const [env, setEnv]   = useState<string>('');
  const [open, setOpen] = useState(false);
  const [envs, setEnvs] = useState<Array<{ env_id: string; env_display_name: string; is_prod_env_flag: boolean }>>([]);

  useEffect(() => {
    let mounted = true;
    api.getEnvironments()
      .then(res => {
        const rows = (res.data as Record<string, unknown>)?.data ?? [];
        const normalized = Array.isArray(rows) ? rows : [];
        if (!mounted) return;
        setEnvs(normalized);
        if (!env && normalized.length > 0) setEnv(String(normalized[0].env_display_name ?? ''));
      })
      .catch(() => {
        if (!mounted) return;
        setEnvs([]);
        if (!env) setEnv('Default');
      });
    return () => { mounted = false; };
  }, [env]);

  const isProdEnv = useMemo(() => {
    const match = envs.find(e => String(e.env_display_name) === env);
    return match?.is_prod_env_flag ?? false;
  }, [env, envs]);

  // Use design-system status vars — no raw hex
  const envStyle: React.CSSProperties = isProdEnv
    ? { background: 'var(--err-bg)', color: 'var(--err)', borderColor: 'rgba(248,113,113,0.30)' }
    : { background: 'var(--ok-bg)',  color: 'var(--ok)',  borderColor: 'rgba(52,211,153,0.30)' };

  if (!env) {
    Object.assign(envStyle, { background: 'var(--bg-5)', color: 'var(--tx2)', borderColor: 'var(--bd-2)' });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 rounded border transition-colors flex-shrink-0"
        style={{ height: 22, fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', ...envStyle }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        {env || 'Environment'}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 shadow-xl py-1 min-w-[140px] rounded-lg"
            style={{ background: 'var(--bg-4)', border: '1px solid var(--bd-2)' }}
          >
            {(envs.length > 0 ? envs : [{ env_id: 'default', env_display_name: env || 'Default', is_prod_env_flag: false }]).map(e => {
              const name   = String((e as Record<string, unknown>).env_display_name ?? 'Default');
              const isProd = Boolean((e as Record<string, unknown>).is_prod_env_flag);
              return (
                <button
                  key={String((e as Record<string, unknown>).env_id ?? name)}
                  onClick={() => { setEnv(name); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                  style={{
                    fontSize: 'var(--fs-sm)',
                    color: name === env ? 'var(--ac-lt)' : 'var(--tx2)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-5)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isProd ? 'bg-err' : 'bg-ok'}`} />
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
  return (
    <button
      title={title ?? label}
      onClick={onClick}
      disabled={disabled || loading}
      className={`thm-header-btn ${
        variant === 'primary' ? 'thm-header-btn--primary' :
        variant === 'success' ? 'thm-header-btn--success' :
        variant === 'warning' ? 'thm-header-btn--warning' : ''
      }`}
    >
      {loading
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <Icon className="w-3 h-3" strokeWidth={1.5} />}
      {label && <span className="hidden lg:inline ml-0.5">{label}</span>}
    </button>
  );
}

// ─── Context-aware toolbar ────────────────────────────────────────────────────

function ToolbarActions() {
  const dispatch       = useAppDispatch();
  const activeTabId    = useAppSelector(s => s.tabs.activeTabId);
  const activeTab      = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));
  const allTabs        = useAppSelector(s => s.tabs.allTabs);
  const activePipeline = useAppSelector(s => s.pipeline.activePipeline);
  const canvasNodes    = useAppSelector(s => Object.values(s.pipeline.nodes));
  const canvasEdges    = useAppSelector(s => Object.values(s.pipeline.edges));
  const unsaved        = useAppSelector(s => s.pipeline.unsavedChanges);

  const [isSaving,    setIsSaving]    = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isPublishing,setPublishing]  = useState(false);
  const [isRunning,   setIsRunning]   = useState(false);
  const [isValidating,setValidating]  = useState(false);

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
          nodes: canvasNodes,
          edges: canvasEdges,
          changeSummary: 'Saved from Header toolbar',
        });
        dispatch(markSaved());
      }
      dispatch(markTabSaved(activeTab.id));
    } catch (err: unknown) {
      alert((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Save failed');
    } finally { setIsSaving(false); }
  }, [activeTab, activePipeline, canvasEdges, canvasNodes, isSaving, type, dispatch]);

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
      if (type === 'pipeline' && activePipeline && activeTab) {
        await api.savePipeline(activePipeline.id, {
          pipelineDisplayName: activePipeline.name,
          pipelineDescText: activePipeline.description,
          nodes: canvasNodes,
          edges: canvasEdges,
          changeSummary: 'Saved via Save All',
        });
        dispatch(markSaved());
        dispatch(markTabSaved(activeTab.id));
      }
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
    } finally { setIsSavingAll(false); }
  }, [allTabs, activeTab, activePipeline, canvasEdges, canvasNodes, isSavingAll, type, dispatch]);

  const handleGenerateCode = useCallback(async () => {
    if (isPublishing || !objectId || type !== 'pipeline') return;
    setPublishing(true);
    try {
      await api.generateCode(objectId);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Code generation failed');
    } finally { setPublishing(false); }
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
          <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: 'var(--bd-2)' }} />
        </>
      )}

      <TBtn icon={Save} label={hasDirty ? 'Save*' : 'Save'} title="Save (Ctrl+S)"
        onClick={handleSave} loading={isSaving}
        disabled={!activeTab}
        variant={hasDirty ? 'warning' : 'ghost'} />

      <TBtn icon={Layers} label="Save All" title="Save All (Ctrl+Shift+S)"
        onClick={handleSaveAll} loading={isSavingAll}
        disabled={!allTabs.some(t => t.isDirty || t.unsaved)}
        variant="ghost" />

      <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: 'var(--bd-2)' }} />

      {canValidate && (
        <TBtn icon={CheckCircle2} label="Validate" title="Validate"
          onClick={handleValidate} loading={isValidating} variant="ghost" />
      )}

      {canRun && (
        <TBtn icon={Play} label="Run" title="Run (F5)"
          onClick={handleRun} loading={isRunning} variant="success" />
      )}

      {type === 'pipeline' && (
        <TBtn icon={Upload} label="Generate Code" title="Generate code bundle"
          onClick={handleGenerateCode} loading={isPublishing} variant="primary" />
      )}
    </div>
  );
}

// ─── Main Header ──────────────────────────────────────────────────────────────

export function Header() {
  const dispatch = useAppDispatch();
  const user     = useAppSelector(s => s.auth.user);
  const dirtyCount = useAppSelector(s => s.tabs.allTabs.filter(t => t.isDirty || t.unsaved).length);

  const displayName = user?.fullName ?? user?.email ?? 'User';
  const initials    = displayName.split(' ').map((w: string) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');

  return (
    <header className="thm-header">

      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--ac)', boxShadow: '0 0 8px var(--ac-bg)' }}>
          <Zap className="w-3 h-3 text-white" fill="currentColor" />
        </div>
        <span
          className="hidden sm:block tracking-tight font-bold flex-shrink-0 text-base text-tx1"
        >ETL1</span>
      </div>

      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--bd-2)' }} />

      <ToolbarActions />

      <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: 'var(--bd-2)' }} />

      {dirtyCount > 0 && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded flex-shrink-0"
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid rgba(251,191,36,0.25)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--warn)',
          }}
        >
          <AlertTriangle className="w-3 h-3" />
          {dirtyCount} unsaved
        </div>
      )}

      <div className="flex-1" />

      {/* Global search */}
      <div className="w-[280px] relative flex-shrink-0">
        <button
          type="button"
          title="Global search is not yet available. Use Command Palette (Ctrl/Cmd+K)."
          className="w-full pl-7 pr-2 rounded text-left transition-all"
          style={{
            height: 22,
            background: 'var(--bg-5)',
            border: '1px solid var(--bd)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--tx3)',
          }}
        >
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
            style={{ color: 'var(--tx3)' }}
          />
          Search pipelines, orchestrators… (Ctrl+K)
        </button>
      </div>

      <div className="flex-1" />

      <EnvironmentSelector />

      {/* Notifications */}
      <button
        title="Notifications"
        className="relative w-6 h-6 flex items-center justify-center rounded flex-shrink-0 transition-colors"
        style={{ color: 'var(--tx2)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-5)', e.currentTarget.style.color = 'var(--tx1)')}
        onMouseLeave={e => (e.currentTarget.style.background = '', e.currentTarget.style.color = 'var(--tx2)')}
      >
        <Bell className="w-3.5 h-3.5" />
        {/* Notification dot — uses design system error color */}
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-err rounded-full"
          style={{ boxShadow: '0 0 0 1px var(--bg-2)' }} />
      </button>

      {/* Help */}
      <button
        title="Help & documentation"
        className="w-6 h-6 flex items-center justify-center rounded flex-shrink-0 transition-colors"
        style={{ color: 'var(--tx2)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-5)', e.currentTarget.style.color = 'var(--tx1)')}
        onMouseLeave={e => (e.currentTarget.style.background = '', e.currentTarget.style.color = 'var(--tx2)')}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: 'var(--bd-2)' }} />

      {/* User */}
      <button
        title={`Signed in as ${displayName} — click to sign out`}
        onClick={() => dispatch(logout())}
        className="flex items-center gap-1.5 px-2 py-1 rounded flex-shrink-0 transition-colors"
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-5)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        {/* Avatar — gradient uses ac + a purple complement, both on-brand */}
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--ac), var(--ic-orch))' }}>
          <span className="text-white font-bold leading-none select-none" style={{ fontSize: 'var(--fs-micro)' }}>
            {initials || 'U'}
          </span>
        </div>
        <span className="hidden lg:inline max-w-[100px] truncate" style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)' }}>
          {displayName}
        </span>
        <ChevronDown className="w-3 h-3" style={{ color: 'var(--tx3)' }} />
      </button>
    </header>
  );
}
