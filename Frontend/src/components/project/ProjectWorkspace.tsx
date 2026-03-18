/**
 * ProjectWorkspace — tab content for a Project object.
 * Sub-tabs: Overview | Properties | Contents | History | Permissions | Activity
 */
import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
import type { ProjectSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'overview',    label: 'Overview',    shortcut: '1' },
  { id: 'properties',  label: 'Properties',  shortcut: '2' },
  { id: 'history',     label: 'History',     shortcut: '3' },
  { id: 'permissions', label: 'Permissions', shortcut: '4' },
  { id: 'activity',    label: 'Activity',    shortcut: '5' },
] satisfies { id: ProjectSubTab; label: string; shortcut: string }[];

type FormData = Record<string, unknown>;
type ProjectApiDto = {
  project_id?: string;
  projectId?: string;
  project_display_name?: string;
  projectDisplayName?: string;
  project_desc_text?: string | null;
  projectDescText?: string | null;
  created_dtm?: string;
  createdOn?: string;
  updated_dtm?: string;
  updatedOn?: string;
};

function mapApiProjectToForm(prev: FormData, d: ProjectApiDto): FormData {
  return {
    ...prev,
    projectId: d.project_id ?? d.projectId ?? prev.projectId,
    name: d.project_display_name ?? d.projectDisplayName ?? prev.name,
    description: d.project_desc_text ?? d.projectDescText ?? prev.description ?? '',
    createdOn: d.created_dtm ?? d.createdOn ?? prev.createdOn,
    updatedOn: d.updated_dtm ?? d.updatedOn ?? prev.updatedOn,
  };
}

function toProjectUpdatePayload(formData: FormData): { projectDisplayName: string; projectDescText: string } {
  return {
    projectDisplayName: String(formData.name ?? '').trim(),
    projectDescText: String(formData.description ?? ''),
  };
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className={`text-slate-300 break-all ${mono ? 'font-mono text-[11px]' : ''}`}>{value || '—'}</span>
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: FormData }) {
  const stats = [
    { label: 'Directories',   value: data.folderCount ?? 0 },
    { label: 'Pipelines',     value: data.pipelineCount ?? 0 },
    { label: 'Orchestrators', value: data.orchestratorCount ?? 0 },
    { label: 'Connections',   value: data.connectionCount ?? 0 },
    { label: 'Members',       value: data.memberCount ?? 0 },
  ];
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-100">{String(s.value)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Details</div>
          <InfoRow label="Project ID" value={String(data.projectId ?? '')} mono />
          <InfoRow label="Status" value={String(data.status ?? 'draft')} />
          <InfoRow label="Created By" value={String(data.createdBy ?? '')} />
          <InfoRow label="Created On" value={String(data.createdOn ?? '')} />
          <InfoRow label="Updated By" value={String(data.updatedBy ?? '')} />
          <InfoRow label="Updated On" value={String(data.updatedOn ?? '')} />
          <InfoRow label="Version" value={String(data.version ?? '1')} />
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Description</div>
          <p className="text-[13px] text-slate-300 leading-relaxed">{String(data.description || 'No description provided.')}</p>
          {Array.isArray(data.tags) && (data.tags as string[]).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {(data.tags as string[]).map(t => (
                <span key={t} className="px-2 py-0.5 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-[11px] rounded">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Properties ───────────────────────────────────────────────────────────

function PropertiesTab({ data, onChange }: { data: FormData; onChange: (f: string, v: string) => void }) {
  const Field = ({ label, field, ro, ta }: { label: string; field: string; ro?: boolean; ta?: boolean }) => (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {ro ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono">
          {String(data[field] ?? '—')}
        </div>
      ) : ta ? (
        <textarea
          rows={3}
          value={String(data[field] ?? '')}
          onChange={e => onChange(field, e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none"
        />
      ) : (
        <input
          type="text"
          value={String(data[field] ?? '')}
          onChange={e => onChange(field, e.target.value)}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500"
        />
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <Field label="Project ID" field="projectId" ro />
        <Field label="Project Name *" field="name" />
        <Field label="Description" field="description" ta />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Default Environment" field="defaultEnvironment" ro />
          <Field label="Owner" field="owner" ro />
        </div>
        <Field label="Tags (read-only)" field="tags" ro />
        <Field label="Labels (read-only)" field="labels" ro />
        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4">
          <Field label="Created By" field="createdBy" ro />
          <Field label="Created On" field="createdOn" ro />
          <Field label="Updated By" field="updatedBy" ro />
          <Field label="Updated On" field="updatedOn" ro />
          <Field label="Last Opened By" field="lastOpenedBy" ro />
          <Field label="Last Opened On" field="lastOpenedOn" ro />
          <Field label="Version" field="version" ro />
          <Field label="Lock State" field="lockState" ro />
        </div>
      </div>
    </div>
  );
}

// ─── Activity ─────────────────────────────────────────────────────────────

function ActivityTab() {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex flex-col items-center justify-center h-40 text-slate-600">
        <p className="text-sm">Activity log is not yet available for this project.</p>
      </div>
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────

export function ProjectWorkspace({ tabId }: { tabId: string }) {
  const dispatch    = useAppDispatch();
  const tab         = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab      = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'overview') as ProjectSubTab;
  const projectId   = tab?.objectId ?? '';
  const projectName = tab?.objectName ?? 'Project';

  const [formData, setFormData] = useState<FormData>({
    projectId,
    name: projectName,
    description: '',
    status: 'draft',
    version: '1',
    lockState: 'Unlocked',
    defaultEnvironment: 'Development',
    tags: '',
    createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
    lastOpenedBy: '—', lastOpenedOn: '—',
    folderCount: 0, pipelineCount: 0, orchestratorCount: 0, connectionCount: 0, memberCount: 0,
  });
  const [isDirty, setIsDirty]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoadError(null);
    api.getProject(projectId)
      .then(res => {
        const d = (res.data?.data ?? res.data) as ProjectApiDto | undefined;
        if (!d) return;
        setFormData(prev => mapApiProjectToForm(prev, d));
      })
      .catch((err: unknown) => {
        setLoadError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load project');
      });
  }, [projectId]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = toProjectUpdatePayload(formData);
      const res = await api.updateProject(projectId, payload);
      const d = (res.data?.data ?? res.data) as ProjectApiDto | undefined;
      if (d) {
        setFormData(prev => mapApiProjectToForm(prev, d));
      }
      setIsDirty(false);
      dispatch(markTabSaved(tabId));
    } catch (err: unknown) {
      setSaveError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to save project');
    }
    finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="project"
        name={String(formData.name ?? projectName)}
        hierarchyPath={tab?.hierarchyPath ?? `Projects → ${projectName}`}
        status={(formData.status as 'draft') ?? 'draft'}
        isDirty={isDirty}
        actions={isDirty ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        ) : undefined}
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="overview" />

      {(loadError || saveError) && (
        <div className="mx-5 mt-4 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
          {saveError ?? loadError}
        </div>
      )}

      {subTab === 'overview'    && <OverviewTab data={formData} />}
      {subTab === 'properties'  && <PropertiesTab data={formData} onChange={handleChange} />}
      {subTab === 'history'     && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} /></div>}
      {subTab === 'permissions' && <div className="flex-1 overflow-hidden"><ObjectPermissionsGrid rows={[]} /></div>}
      {subTab === 'activity'    && <ActivityTab />}
    </div>
  );
}
