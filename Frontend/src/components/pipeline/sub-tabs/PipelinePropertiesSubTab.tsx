/**
 * Pipeline > Properties sub-tab
 */
import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { updateActivePipeline } from '@/store/slices/pipelineSlice';

function Field({ label, value, onChange, ro, ta, placeholder }: {
  label: string; value: string; onChange?: (v: string) => void; ro?: boolean; ta?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {ro ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono">{value || '—'}</div>
      ) : ta ? (
        <textarea rows={3} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" />
      ) : (
        <input type="text" value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      )}
    </div>
  );
}

interface Props { pipelineId: string; onDirty?: () => void; }

export function PipelinePropertiesSubTab({ pipelineId, onDirty }: Props) {
  const dispatch = useAppDispatch();
  const activePipeline = useAppSelector(s => s.pipeline.activePipeline);
  const projects = useAppSelector(s => s.projects.projects);
  const foldersByProject = useAppSelector(s => s.projects.foldersByProject);

  const project = projects.find(p => p.projectId === activePipeline?.projectId)?.projectDisplayName ?? 'Global / None';
  let folder = 'Root';
  if (activePipeline?.projectId) {
    const pFolders = foldersByProject[activePipeline.projectId] ?? [];
    const fNode = pFolders.find(f => f.folderId === (activePipeline as any).folderId); // activePipeline doesn't have folderId typed in frontend Pipeline? We don't have it typed on Pipeline interface but it exists from API.
    if (fNode) folder = fNode.folderDisplayName;
  }

  const [data, setData] = useState<Record<string, string>>({
    pipelineId,
    name: activePipeline?.name ?? '',
    description: activePipeline?.description ?? '',
    project, folder,
    status: (activePipeline as any)?.statusCode ?? '—',
    owner: (activePipeline as any)?.ownerUserName ?? '—',
    tags: ((activePipeline as any)?.tags ?? []).join(', '),
    labels: ((activePipeline as any)?.labels ?? []).join(', '),
    version: String(activePipeline?.version ?? '1'),
    createdBy: (activePipeline as any)?.createdByName ?? '—',
    createdOn: activePipeline?.createdAt ?? '—',
    updatedBy: (activePipeline as any)?.updatedByName ?? '—',
    updatedOn: activePipeline?.updatedAt ?? '—',
    lastOpenedBy: (activePipeline as any)?.lastOpenedByName ?? '—',
    lastOpenedOn: (activePipeline as any)?.lastOpenedDtm ?? '—',
    lastExecutedBy: (activePipeline as any)?.lastExecutedByName ?? '—',
    lastExecutedOn: (activePipeline as any)?.lastExecutedDtm ?? '—',
    lastSuccessOn: (activePipeline as any)?.lastSuccessDtm ?? '—',
    lastFailedOn: (activePipeline as any)?.lastFailedDtm ?? '—',
    runtimeEngine: (activePipeline as any)?.runtimeEngineCode ?? '—',
    executionMode: (activePipeline as any)?.executionModeCode ?? '—',
    retryPolicy: (activePipeline as any)?.retryPolicyText ?? '—',
    timeout: (activePipeline as any)?.timeoutText ?? '—',
    loggingLevel: (activePipeline as any)?.loggingLevelCode ?? '—',
    publishedState: (activePipeline as any)?.publishedStateCode ?? '—',
    lockState: (activePipeline as any)?.lockStateCode ?? '—',
  });

  useEffect(() => {
    setData(prev => ({
      ...prev,
      name: activePipeline?.name ?? '',
      description: activePipeline?.description ?? '',
      version: String(activePipeline?.version ?? '1'),
      createdOn: activePipeline?.createdAt ?? '—',
      updatedOn: activePipeline?.updatedAt ?? '—',
      project,
      folder,
    }));
  }, [activePipeline, project, folder]);

  const handleChange = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (field === 'name' || field === 'description') {
      dispatch(updateActivePipeline({ [field]: value }));
    }
    onDirty?.();
  };

  const F = (p: { label: string; field: string; ro?: boolean; ta?: boolean }) => (
    <Field label={p.label} value={data[p.field] ?? ''} onChange={v => handleChange(p.field, v)} ro={p.ro} ta={p.ta} />
  );

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <F label="Pipeline ID" field="pipelineId" ro />
        <F label="Pipeline Name *" field="name" />
        <F label="Description" field="description" ta />
        <div className="grid grid-cols-2 gap-4">
          <F label="Project" field="project" ro />
          <F label="Folder" field="folder" ro />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Status" field="status" ro />
          <F label="Owner" field="owner" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Tags" field="tags" />
          <F label="Labels" field="labels" />
        </div>
        <div className="border-t border-slate-800 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="Runtime Engine" field="runtimeEngine" ro />
            <F label="Execution Mode" field="executionMode" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Retry Policy" field="retryPolicy" />
            <F label="Timeout" field="timeout" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Logging Level" field="loggingLevel" />
            <F label="Published State" field="publishedState" ro />
          </div>
        </div>
        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4">
          <F label="Created By" field="createdBy" ro />
          <F label="Created On" field="createdOn" ro />
          <F label="Updated By" field="updatedBy" ro />
          <F label="Updated On" field="updatedOn" ro />
          <F label="Last Opened By" field="lastOpenedBy" ro />
          <F label="Last Opened On" field="lastOpenedOn" ro />
          <F label="Last Executed By" field="lastExecutedBy" ro />
          <F label="Last Executed On" field="lastExecutedOn" ro />
          <F label="Last Success On" field="lastSuccessOn" ro />
          <F label="Last Failed On" field="lastFailedOn" ro />
          <F label="Version" field="version" ro />
          <F label="Lock State" field="lockState" ro />
        </div>
      </div>
    </div>
  );
}
