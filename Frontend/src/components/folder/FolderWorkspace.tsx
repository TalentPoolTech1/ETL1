/**
 * FolderWorkspace — tab content for a Folder/Directory object.
 * Sub-tabs: Overview | Properties | Contents | History | Permissions
 */
import React, { useState } from 'react';
import { FolderPlus, Workflow, GitMerge, Save, Plus } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved, openTab } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
import type { FolderSubTab } from '@/types';

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
      <span className="text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-slate-300">{value || '—'}</span>
    </div>
  );
}

function OverviewTab({ data }: { data: FormData }) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 max-w-lg space-y-2">
        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Folder Details</div>
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
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {ro ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono">{String(data[field] ?? '—')}</div>
      ) : (
        <input type="text" value={String(data[field] ?? '')} onChange={e => onChange(field, e.target.value)}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
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

function ContentsTab({ tabId }: { tabId: string }) {
  const dispatch = useAppDispatch();
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <button className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors">
          <FolderPlus className="w-3.5 h-3.5" /> New Sub-folder
        </button>
        <button className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors">
          <Workflow className="w-3.5 h-3.5 text-sky-400" /> New Pipeline
        </button>
        <button className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[12px] text-slate-300 transition-colors">
          <GitMerge className="w-3.5 h-3.5 text-purple-400" /> New Orchestrator
        </button>
      </div>
      <div className="flex flex-col items-center justify-center h-40 text-slate-600">
        <Plus className="w-8 h-8 mb-2" />
        <p className="text-sm">Folder contents will appear here once loaded.</p>
      </div>
    </div>
  );
}

export function FolderWorkspace({ tabId }: { tabId: string }) {
  const dispatch   = useAppDispatch();
  const tab        = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab     = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'overview') as FolderSubTab;
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

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 300));
    setIsDirty(false);
    dispatch(markTabSaved(tabId));
    setIsSaving(false);
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
      {subTab === 'overview'    && <OverviewTab data={formData} />}
      {subTab === 'properties'  && <PropertiesTab data={formData} onChange={handleChange} />}
      {subTab === 'contents'    && <ContentsTab tabId={tabId} />}
      {subTab === 'history'     && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} /></div>}
      {subTab === 'permissions' && <div className="flex-1 overflow-hidden"><ObjectPermissionsGrid rows={[]} /></div>}
    </div>
  );
}
