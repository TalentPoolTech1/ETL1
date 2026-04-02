/**
 * PipelineWorkspace
 * Active sub-tabs: Designer | Properties | Parameters | Validation |
 *                  Executions | Metrics | Permissions | Code | Alerts |
 *                  Audit Logs | Dependencies | Activity | Lineage
 *
 * Executions slot contains two inner views:
 *   "Run"     — live trigger panel (ExecutionSubTab)
 *   "History" — historical run list (ExecutionHistorySubTab)
 */
import React, { useEffect, useCallback, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setPipeline, markSaved } from '@/store/slices/pipelineSlice';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { PipelineCanvas }             from '@/components/canvas/PipelineCanvas';
import { NodeConfigPanel }           from '@/components/canvas/NodeConfigPanel';
import { DataPreviewPanel }          from '@/components/preview/DataPreviewPanel';
import { PipelinePropertiesSubTab }   from './sub-tabs/PipelinePropertiesSubTab';
import { PipelineParametersSubTab }   from './sub-tabs/PipelineParametersSubTab';
import { PipelineValidationSubTab }   from './sub-tabs/PipelineValidationSubTab';
import { PipelineCodeSubTab }         from './sub-tabs/PipelineCodeSubTab';
import { PipelineMetricsSubTab }      from './sub-tabs/PipelineMetricsSubTab';
import { PermissionsSubTab }          from './sub-tabs/PermissionsSubTab';
import { ExecutionHistorySubTab }     from './sub-tabs/ExecutionHistorySubTab';
import { ExecutionSubTab }            from './sub-tabs/ExecutionSubTab';
import { PipelineAlertsSubTab }       from './sub-tabs/PipelineAlertsSubTab';
import { AuditLogsSubTab }            from './sub-tabs/AuditLogsSubTab';
import { PipelineActivitySubTab }     from './sub-tabs/PipelineActivitySubTab';
import { PipelineDependenciesSubTab } from './sub-tabs/PipelineDependenciesSubTab';
import { LineageSubTab }              from './sub-tabs/LineageSubTab';
import { OverviewSubTab }             from './sub-tabs/OverviewSubTab';
import { OptimizeSubTab }             from './sub-tabs/OptimizeSubTab';
import type { PipelineSubTab } from '@/types';
import api from '@/services/api';

const PIPELINE_SUB_TABS = [
  { id: 'overview',     label: 'Overview',     shortcut: '' },
  { id: 'editor',       label: 'Designer',     shortcut: '1' },
  { id: 'optimize',     label: 'Optimize',     shortcut: '' },
  { id: 'properties',   label: 'Properties',   shortcut: '2' },
  { id: 'parameters',   label: 'Parameters',   shortcut: '3' },
  { id: 'validation',   label: 'Validation',   shortcut: '4' },
  { id: 'executions',   label: 'Executions',   shortcut: '5' },
  { id: 'metrics',      label: 'Metrics',      shortcut: '6' },
  { id: 'permissions',  label: 'Permissions',  shortcut: '7' },
  { id: 'code',         label: 'Code',         shortcut: '8' },
  { id: 'alerts',       label: 'Alerts',       shortcut: '9' },
  { id: 'logs',         label: 'Audit Logs',   shortcut: '' },
  { id: 'dependencies', label: 'Dependencies', shortcut: '' },
  { id: 'activity',     label: 'Activity',     shortcut: '' },
  { id: 'lineage',      label: 'Lineage',      shortcut: '' },
] as { id: PipelineSubTab; label: string; shortcut: string }[];

// ─── Inner view switcher for Executions slot ──────────────────────────────────
type ExecView = 'run' | 'history';

function ExecutionsSlot({ pipelineId }: { pipelineId: string }) {
  const [view, setView] = useState<ExecView>('run');
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Inner view toggle */}
      <div className="flex items-center gap-0 px-4 border-b border-slate-800 flex-shrink-0 bg-[#0a0c15]">
        {(['run', 'history'] as ExecView[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`h-8 px-4 text-[12px] font-medium border-b-2 transition-colors capitalize ${
              view === v
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {v === 'run' ? 'Run Pipeline' : 'History'}
          </button>
        ))}
      </div>
      {view === 'run'     && <ExecutionSubTab        pipelineId={pipelineId} />}
      {view === 'history' && <ExecutionHistorySubTab pipelineId={pipelineId} />}
    </div>
  );
}

// ─── F-17 Export / F-18 Import buttons ───────────────────────────────────────
function ExportImportButtons({ pipelineId }: { pipelineId: string }) {
  const [importing, setImporting] = React.useState(false);
  const [importErr, setImportErr] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const res = await api.exportPipeline(pipelineId, 'json');
      const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `pipeline_${pipelineId}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent — export is best-effort */ }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportErr(null);
    try {
      const text = await file.text();
      const parsedPayload = JSON.parse(text);
      await api.importPipeline({ payload: parsedPayload });
    } catch (err: unknown) {
      setImportErr((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <button onClick={handleExport}
        title="Export pipeline to JSON"
        className="h-7 px-2.5 rounded bg-[#1e2035] border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white text-[11px] font-medium transition-colors">
        ↓ Export
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={importing}
        title="Import pipeline from JSON"
        className="h-7 px-2.5 rounded bg-[#1e2035] border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white text-[11px] font-medium transition-colors disabled:opacity-50">
        {importing ? 'Importing…' : '↑ Import'}
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      {importErr && <span className="text-[10px] text-red-400">{importErr}</span>}
    </>
  );
}

interface PipelineWorkspaceProps { tabId: string; }

export function PipelineWorkspace({ tabId }: PipelineWorkspaceProps) {
  const dispatch       = useAppDispatch();
  const selectedSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'editor') as PipelineSubTab;
  const activeSubTab = PIPELINE_SUB_TABS.some(t => t.id === selectedSubTab) ? selectedSubTab : 'editor';
  const unsavedChanges = useAppSelector(s => s.pipeline.unsavedChanges);
  const activePipeline = useAppSelector(s => s.pipeline.activePipeline);
  const canvasNodes    = useAppSelector(s => Object.values(s.pipeline.nodes));
  const canvasEdges    = useAppSelector(s => Object.values(s.pipeline.edges));
  const hasSelectedNode = useAppSelector(s => s.pipeline.selectedNodeIds.length > 0);
  const tab            = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const pipelineId     = tab?.objectId ?? '';

  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [configOpenSignal, setConfigOpenSignal] = useState(0);

  useEffect(() => {
    if (!pipelineId) return;
    setIsLoading(true);
    setLoadError(null);
    api.getPipeline(pipelineId)
      .then(res => {
        const data = res.data.data ?? res.data;
        dispatch(setPipeline({
          id: data.pipelineId ?? data.id ?? pipelineId,
          projectId: data.projectId ?? '',
          name: data.pipelineDisplayName ?? data.name ?? '',
          description: data.pipelineDescText ?? data.description ?? '',
          nodes: data.nodes ?? [],
          edges: data.edges ?? [],
          version: data.version ?? 1,
          createdAt: data.createdDtm ?? data.createdAt ?? '',
          updatedAt: data.updatedDtm ?? data.updatedAt ?? '',
          unsavedChanges: false,
        }));
      })
      .catch(err => setLoadError(err?.response?.data?.userMessage ?? err.message ?? 'Failed to load pipeline'))
      .finally(() => setIsLoading(false));
  }, [pipelineId, dispatch]);

  useEffect(() => {
    if (unsavedChanges) dispatch(markTabUnsaved(tabId));
    else dispatch(markTabSaved(tabId));
  }, [unsavedChanges, tabId, dispatch]);

  const handleSave = useCallback(async () => {
    if (!activePipeline || isSaving) return;
    setIsSaving(true);
    try {
      await api.savePipeline(activePipeline.id, {
        pipelineDisplayName: activePipeline.name,
        pipelineDescText: activePipeline.description,
        nodes: canvasNodes,
        edges: canvasEdges,
        changeSummary: 'Saved from Pipeline workspace',
      });
      dispatch(markSaved());
      dispatch(markTabSaved(tabId));
    } catch (err: unknown) {
      alert((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Save failed');
    } finally { setIsSaving(false); }
  }, [activePipeline, canvasNodes, canvasEdges, isSaving, tabId, dispatch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm bg-[#0d0f1a]">Loading pipeline…</div>;

  if (loadError) return (
    <div className="flex-1 flex items-center justify-center bg-[#0d0f1a]">
      <div className="bg-red-950/50 border border-red-800 rounded-lg p-6 max-w-sm text-center">
        <div className="text-red-400 font-medium mb-1">Failed to load pipeline</div>
        <div className="text-sm text-red-500/80">{loadError}</div>
        <button onClick={() => { setLoadError(null); setIsLoading(true); }}
          className="mt-4 px-4 py-1.5 bg-red-700 text-white text-sm rounded hover:bg-red-600 transition-colors">
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="pipeline"
        name={activePipeline?.name ?? tab?.objectName ?? ''}
        hierarchyPath={tab?.hierarchyPath}
        status="draft"
        isDirty={unsavedChanges}
        actions={
          <div className="flex items-center gap-1.5">
            <ExportImportButtons pipelineId={pipelineId} />
            {unsavedChanges && (
              <button onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50">
                {isSaving ? 'Saving…' : 'Save (⌘S)'}
              </button>
            )}
          </div>
        }
      />

      <SubTabBar tabId={tabId} tabs={PIPELINE_SUB_TABS} defaultTab="editor" />

      {/* Designer: always mounted, hidden when not active */}
      <div className={`flex-1 overflow-hidden ${activeSubTab === 'editor' ? 'flex' : 'hidden'}`}>
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <PipelineCanvas
            onNodeDoubleClick={(nodeId) => {
              setConfigNodeId(nodeId);
              setConfigOpenSignal(prev => prev + 1);
            }}
            pipelineId={pipelineId}
          />
          {hasSelectedNode && (
            <div className="h-64 shrink-0 border-t border-slate-800/80 bg-[#0a0c15]">
              <DataPreviewPanel embedded />
            </div>
          )}
        </div>
        <NodeConfigPanel nodeId={configNodeId} openSignal={configOpenSignal} onClose={() => setConfigNodeId(null)} />
      </div>

      {activeSubTab === 'properties'   && <PipelinePropertiesSubTab   pipelineId={pipelineId} onDirty={() => dispatch(markTabUnsaved(tabId))} />}
      {activeSubTab === 'parameters'   && <PipelineParametersSubTab   pipelineId={pipelineId} onDirty={() => dispatch(markTabUnsaved(tabId))} />}
      {activeSubTab === 'validation'   && <PipelineValidationSubTab   pipelineId={pipelineId} />}
      {activeSubTab === 'executions'   && <ExecutionsSlot              pipelineId={pipelineId} />}
      {activeSubTab === 'metrics'      && <PipelineMetricsSubTab       pipelineId={pipelineId} />}
      {activeSubTab === 'permissions'  && <PermissionsSubTab           pipelineId={pipelineId} />}
      {activeSubTab === 'code'         && <PipelineCodeSubTab          pipelineId={pipelineId} />}
      {activeSubTab === 'alerts'       && <PipelineAlertsSubTab        pipelineId={pipelineId} />}
      {activeSubTab === 'logs'         && <AuditLogsSubTab             pipelineId={pipelineId} />}
      {activeSubTab === 'dependencies' && <PipelineDependenciesSubTab  pipelineId={pipelineId} />}
      {activeSubTab === 'activity'     && <PipelineActivitySubTab      pipelineId={pipelineId} />}
      {activeSubTab === 'lineage'      && <LineageSubTab               pipelineId={pipelineId} />}
      {activeSubTab === 'overview'     && <OverviewSubTab              pipelineId={pipelineId} />}
      {activeSubTab === 'optimize'     && <OptimizeSubTab />}
    </div>
  );
}
