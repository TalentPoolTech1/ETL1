/**
 * FolderWorkspace — tab content for a Folder/Directory object.
 * Sub-tabs: Overview | Properties | Contents | History | Permissions
 */
import React, { useEffect, useState } from 'react';
import { FolderPlus, Workflow, GitMerge, Save, Plus } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved, openTab } from '@/store/slices/tabsSlice';
import { openCreateFolder, openCreatePipeline, openCreateOrchestrator } from '@/store/slices/projectsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
import type { FolderSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'overview',    label: 'Overview',    shortcut: '1' },
  { id: 'properties',  label: 'Properties',  shortcut: '2' },
  { id: 'contents',    label: 'Contents',    shortcut: '3' },
  { id: 'history',     label: 'History',     shortcut: '4' },
  { id: 'permissions', label: 'Permissions', shortcut: '5' },
] satisfies { id: FolderSubTab; label: string; shortcut: string }[];

type FormData = Record<string, unknown>;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="text-slate-300 w-32 flex-shrink-0">{label}</span>
      <span className="text-slate-300">{value || '—'}</span>
    </div>
  );
}

function OverviewTab({ data }: { data: FormData }) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 max-w-lg space-y-2">
        <div className="text-[12px] text-slate-300 font-semibold uppercase tracking-wide mb-3">Folder Details</div>
        <InfoRow label="Folder ID" value={String(data.folderId ?? '')} />
        <InfoRow label="Name" value={String(data.name ?? '')} />
        <InfoRow label="Parent Path" value={String(data.parentPath ?? '')} />
        <InfoRow label="Status" value={String(data.status ?? 'active')} />
        <InfoRow label="Created By" value={String(data.createdBy ?? '')} />
        <InfoRow label="Created On" value={String(data.createdOn ?? '')} />
        <InfoRow label="Updated By" value={String(data.updatedBy ?? '')} />
        <InfoRow label="Updated On" value={String(data.updatedOn ?? '')} />
      </div>
    </div>
  );
}

function PropertiesTab({ data, onChange }: { data: FormData; onChange: (f: string, v: string) => void }) {
  const F = ({ label, field, ro }: { label: string; field: string; ro?: boolean }) => (
    <div>
      <label className="field-label">{label}</label>
      {ro ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-300 font-mono">{String(data[field] ?? '—')}</div>
      ) : (
        <input type="text" value={String(data[field] ?? '')} onChange={e => onChange(field, e.target.value)}
          className="field-input" />
      )}
    </div>
  );
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <F label="Folder ID" field="folderId" ro />
        <F label="Folder Name *" field="name" />
        <F label="Description" field="description" />
        <F label="Tags" field="tags" />
        <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
          <F label="Created By" field="createdBy" ro />
          <F label="Created On" field="createdOn" ro />
          <F label="Updated By" field="updatedBy" ro />
          <F label="Updated On" field="updatedOn" ro />
          <F label="Last Opened By" field="lastOpenedBy" ro />
          <F label="Last Opened On" field="lastOpenedOn" ro />
          <F label="Lock State" field="lockState" ro />
        </div>
      </div>
    </div>
  );
}

function ContentsTab({ folderId, projectId }: { folderId: string; projectId: string | null }) {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<Array<{ folderId: string; folderDisplayName: string }>>([]);
  const [pipelines, setPipelines] = useState<Array<{ pipelineId: string; pipelineDisplayName: string }>>([]);
  const [orchestrators, setOrchestrators] = useState<Array<{ orchId: string; orchDisplayName: string }>>([]);

  useEffect(() => {
    if (!folderId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getFolderChildren(folderId),
      api.getFolderPipelines(folderId),
      api.getFolderOrchestrators(folderId),
    ])
      .then(([childRes, pipelineRes, orchRes]) => {
        const childRows = ((childRes.data?.data ?? childRes.data) as any[]) ?? [];
        const pipelineRows = ((pipelineRes.data?.data ?? pipelineRes.data) as any[]) ?? [];
        const orchRows = ((orchRes.data?.data ?? orchRes.data) as any[]) ?? [];

        setChildren(childRows.map(r => ({
          folderId: r.folder_id ?? r.folderId,
          folderDisplayName: r.folder_display_name ?? r.folderDisplayName ?? 'Unnamed Folder',
        })));
        setPipelines(pipelineRows.map(r => ({
          pipelineId: r.pipeline_id ?? r.pipelineId,
          pipelineDisplayName: r.pipeline_display_name ?? r.pipelineDisplayName ?? 'Unnamed Pipeline',
        })));
        setOrchestrators(orchRows.map(r => ({
          orchId: r.orch_id ?? r.orchId,
          orchDisplayName: r.orch_display_name ?? r.orchDisplayName ?? 'Unnamed Orchestrator',
        })));
      })
      .catch(() => {
        setError('Failed to load folder contents.');
      })
      .finally(() => setLoading(false));
  }, [folderId]);

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => {
            if (!projectId) return;
            dispatch(openCreateFolder({ projectId, parentFolderId: folderId }));
          }}
          disabled={!projectId}
          className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FolderPlus className="w-3.5 h-3.5" /> New Sub-folder
        </button>
        <button
          onClick={() => dispatch(openCreatePipeline({ projectId, folderId }))}
          className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors"
        >
          <Workflow className="w-3.5 h-3.5 text-sky-400" /> New Pipeline
        </button>
        <button
          onClick={() => dispatch(openCreateOrchestrator({ projectId, folderId }))}
          className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors"
        >
          <GitMerge className="w-3.5 h-3.5 text-purple-400" /> New Orchestrator
        </button>
      </div>
      {loading && <div className="text-[12px] text-slate-300">Loading folder contents…</div>}
      {error && <div className="text-[12px] text-red-400 mb-3">{error}</div>}
      {!loading && !error && children.length === 0 && pipelines.length === 0 && orchestrators.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
          <Plus className="w-8 h-8 mb-2" />
          <p className="text-sm">This folder is empty.</p>
        </div>
      )}
      {!loading && !error && (children.length > 0 || pipelines.length > 0 || orchestrators.length > 0) && (
        <div className="space-y-2">
          {children.map(c => (
            <button
              key={c.folderId}
              onClick={() => dispatch(openTab({ id: `folder-${c.folderId}`, type: 'folder', objectId: c.folderId, objectName: c.folderDisplayName, unsaved: false, isDirty: false }))}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded border border-slate-800 bg-slate-900/40 hover:bg-slate-800/70 text-left text-[12px] text-slate-300"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              {c.folderDisplayName}
            </button>
          ))}
          {pipelines.map(p => (
            <button
              key={p.pipelineId}
              onClick={() => dispatch(openTab({ id: `pipeline-${p.pipelineId}`, type: 'pipeline', objectId: p.pipelineId, objectName: p.pipelineDisplayName, unsaved: false, isDirty: false }))}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded border border-slate-800 bg-slate-900/40 hover:bg-slate-800/70 text-left text-[12px] text-slate-300"
            >
              <Workflow className="w-3.5 h-3.5 text-sky-400" />
              {p.pipelineDisplayName}
            </button>
          ))}
          {orchestrators.map(o => (
            <button
              key={o.orchId}
              onClick={() => dispatch(openTab({ id: `orchestrator-${o.orchId}`, type: 'orchestrator', objectId: o.orchId, objectName: o.orchDisplayName, unsaved: false, isDirty: false }))}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded border border-slate-800 bg-slate-900/40 hover:bg-slate-800/70 text-left text-[12px] text-slate-300"
            >
              <GitMerge className="w-3.5 h-3.5 text-purple-400" />
              {o.orchDisplayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderWorkspace({ tabId }: { tabId: string }) {
  const dispatch   = useAppDispatch();
  const tab        = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab     = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'overview') as FolderSubTab;
  const folderId   = tab?.objectId ?? '';
  const folderName = tab?.objectName ?? 'Folder';

  const [formData, setFormData] = useState<FormData>({
    folderId: tab?.objectId ?? '',
    name: folderName,
    description: '',
    status: 'active',
    lockState: 'Unlocked',
    createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
    lastOpenedBy: '—', lastOpenedOn: '—',
  });
  const [isDirty, setIsDirty]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!folderId) return;
    api.getFolder(folderId)
      .then(res => {
        const row = (res.data?.data ?? res.data) as any;
        if (!row) return;
        setFormData(prev => ({
          ...prev,
          folderId: row.folder_id ?? row.folderId ?? folderId,
          projectId: row.project_id ?? row.projectId ?? prev.projectId ?? null,
          parentFolderId: row.parent_folder_id ?? row.parentFolderId ?? null,
          name: row.folder_display_name ?? row.folderDisplayName ?? prev.name,
          createdOn: row.created_dtm ?? row.createdDtm ?? prev.createdOn,
          updatedOn: row.updated_dtm ?? row.updatedDtm ?? prev.updatedOn,
        }));
      })
      .catch(() => {
        setSaveError('Failed to load folder details.');
      });
  }, [folderId]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
  };

  const handleSave = async () => {
    const newName = String(formData.name ?? '').trim();
    if (!folderId || !newName) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.renameFolder(folderId, newName);
      setIsDirty(false);
      dispatch(markTabSaved(tabId));
    } catch {
      setSaveError('Failed to save folder changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="folder"
        name={String(formData.name ?? folderName)}
        hierarchyPath={tab?.hierarchyPath}
        status="draft"
        isDirty={isDirty}
        actions={isDirty ? (
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving…' : 'Save'}
          </button>
        ) : undefined}
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="overview" />
      {saveError && <div className="px-5 py-2 text-[12px] text-red-400 border-b border-red-900/30 bg-red-950/20">{saveError}</div>}
      {subTab === 'overview'    && <OverviewTab data={formData} />}
      {subTab === 'properties'  && <PropertiesTab data={formData} onChange={handleChange} />}
      {subTab === 'contents'    && <ContentsTab folderId={folderId} projectId={(formData.projectId as string | null) ?? null} />}
      {subTab === 'history'     && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} /></div>}
      {subTab === 'permissions' && <div className="flex-1 overflow-hidden"><ObjectPermissionsGrid rows={[]} /></div>}
    </div>
  );
}
