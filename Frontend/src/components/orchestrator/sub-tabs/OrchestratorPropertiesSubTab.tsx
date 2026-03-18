/**
 * Orchestrator > Properties sub-tab
 */
import React, { useState } from 'react';
import { useAppSelector } from '@/store/hooks';

function Field({ label, value, onChange, ro }: { label: string; value: string; onChange?: (v: string) => void; ro?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {ro ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono">{value || '—'}</div>
      ) : (
        <input type="text" value={value} onChange={e => onChange?.(e.target.value)}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      )}
    </div>
  );
}

export function OrchestratorPropertiesSubTab({ orchId, onDirty }: { orchId: string; onDirty?: () => void }) {
  const [data, setData] = useState<Record<string, string>>({
    orchId,
    name: '',
    description: '',
    status: 'draft',
    owner: '',
    tags: '',
    version: '1',
    publishedState: 'draft',
    lockState: 'Unlocked',
    timeoutPolicy: '4 hours',
    retryPolicy: '3 retries, 60s delay',
    concurrencyRule: 'allow_parallel',
    createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
    lastOpenedBy: '—', lastOpenedOn: '—',
    lastExecutedBy: '—', lastExecutedOn: '—',
    lastSuccessOn: '—', lastFailedOn: '—',
  });

  const update = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    onDirty?.();
  };

  const F = (p: { label: string; field: string; ro?: boolean }) => (
    <Field label={p.label} value={data[p.field] ?? ''} onChange={v => update(p.field, v)} ro={p.ro} />
  );

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <F label="Orchestrator ID" field="orchId" ro />
        <F label="Orchestrator Name *" field="name" />
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Description</label>
          <textarea rows={3} value={data.description} onChange={e => update('description', e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Status" field="status" ro />
          <F label="Owner" field="owner" />
        </div>
        <F label="Tags" field="tags" />
        <div className="border-t border-slate-800 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="Timeout Policy" field="timeoutPolicy" />
            <F label="Retry Policy" field="retryPolicy" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Concurrency Rule" field="concurrencyRule" />
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
