/**
 * PipelineWorkspace
 * Active sub-tabs: Designer | Properties | Parameters | Validation |
 *                  Executions | Metrics | Permissions | Code
 */
import React, { useEffect, useCallback, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setPipeline, markSaved } from '@/store/slices/pipelineSlice';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { PipelineCanvas }             from '@/components/canvas/PipelineCanvas';
import { NodeConfigPanel }           from '@/components/canvas/NodeConfigPanel';
import { PipelinePropertiesSubTab }   from './sub-tabs/PipelinePropertiesSubTab';
import { PipelineParametersSubTab }   from './sub-tabs/PipelineParametersSubTab';
import { PipelineValidationSubTab }   from './sub-tabs/PipelineValidationSubTab';
import { PipelineCodeSubTab }         from './sub-tabs/PipelineCodeSubTab';
import { PipelineMetricsSubTab }      from './sub-tabs/PipelineMetricsSubTab';
import { PermissionsSubTab }          from './sub-tabs/PermissionsSubTab';
import { ExecutionHistorySubTab }     from './sub-tabs/ExecutionHistorySubTab';
import type { PipelineSubTab } from '@/types';
import api from '@/services/api';

const PIPELINE_SUB_TABS = [
  { id: 'editor',       label: 'Designer',     shortcut: '1' },
  { id: 'properties',   label: 'Properties',   shortcut: '2' },
  { id: 'parameters',   label: 'Parameters',   shortcut: '3' },
  { id: 'validation',   label: 'Validation',   shortcut: '4' },
  { id: 'executions',   label: 'Executions',   shortcut: '5' },
  { id: 'metrics',      label: 'Metrics',      shortcut: '6' },
  { id: 'permissions',  label: 'Permissions',  shortcut: '7' },
  { id: 'code',         label: 'Code',         shortcut: '8' },
] as { id: PipelineSubTab; label: string; shortcut: string }[];

interface PipelineWorkspaceProps { tabId: string; }

export function PipelineWorkspace({ tabId }: PipelineWorkspaceProps) {
  const dispatch       = useAppDispatch();
  const selectedSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'editor') as PipelineSubTab;
  const activeSubTab = PIPELINE_SUB_TABS.some(t => t.id === selectedSubTab) ? selectedSubTab : 'editor';
  const unsavedChanges = useAppSelector(s => s.pipeline.unsavedChanges);
  const activePipeline = useAppSelector(s => s.pipeline.activePipeline);
  const canvasNodes    = useAppSelector(s => Object.values(s.pipeline.nodes));
  const canvasEdges    = useAppSelector(s => Object.values(s.pipeline.edges));
  const tab            = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const pipelineId     = tab?.objectId ?? '';

  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);

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
        actions={unsavedChanges ? (
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50">
            {isSaving ? 'Saving…' : 'Save (⌘S)'}
          </button>
        ) : undefined}
      />

      <SubTabBar tabId={tabId} tabs={PIPELINE_SUB_TABS} defaultTab="editor" />

      {/* Designer: always mounted, hidden when not active */}
      <div className={`flex-1 overflow-hidden ${activeSubTab === 'editor' ? 'flex' : 'hidden'}`}>
        <PipelineCanvas onNodeDoubleClick={setConfigNodeId} pipelineId={pipelineId} />
        <NodeConfigPanel nodeId={configNodeId} onClose={() => setConfigNodeId(null)} />
      </div>

      {activeSubTab === 'properties'   && <PipelinePropertiesSubTab pipelineId={pipelineId} onDirty={() => dispatch(markTabUnsaved(tabId))} />}
      {activeSubTab === 'parameters'   && <PipelineParametersSubTab pipelineId={pipelineId} onDirty={() => dispatch(markTabUnsaved(tabId))} />}
      {activeSubTab === 'validation'   && <PipelineValidationSubTab pipelineId={pipelineId} />}
      {activeSubTab === 'executions'   && <ExecutionHistorySubTab pipelineId={pipelineId} />}
      {activeSubTab === 'metrics'       && <PipelineMetricsSubTab pipelineId={pipelineId} />}
      {activeSubTab === 'permissions'   && <PermissionsSubTab pipelineId={pipelineId} />}
      {activeSubTab === 'code'          && <PipelineCodeSubTab pipelineId={pipelineId} />}
    </div>
  );
}
