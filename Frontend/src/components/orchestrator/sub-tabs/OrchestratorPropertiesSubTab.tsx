/**
 * Orchestrator > Properties sub-tab
 * Loads real orchestrator data from the API and persists changes via PUT.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import api from '@/services/api';

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

type FD = Record<string, string>;

function mapApiToForm(prev: FD, d: any): FD {
  return {
    ...prev,
    orchId:          d.orch_id          ?? d.orchId          ?? prev.orchId,
    name:            d.orch_display_name ?? d.orchDisplayName ?? prev.name,
    description:     d.orch_desc_text   ?? d.orchDescText    ?? prev.description,
    status:          d.run_status_code  ?? 'draft',
    createdOn:       d.created_dtm      ?? d.createdDtm      ?? prev.createdOn,
    updatedOn:       d.updated_dtm      ?? d.updatedDtm      ?? prev.updatedOn,
  };
}

export function OrchestratorPropertiesSubTab({ orchId, onDirty }: { orchId: string; onDirty?: () => void }) {
  const [data, setData] = useState<FD>({
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
  const [isDirty, setIsDirty]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!orchId) return;
    setLoadError(null);
    api.getOrchestrator(orchId)
      .then(res => {
        const d = res.data?.data ?? res.data;
        if (!d) return;
        setData(prev => mapApiToForm(prev, d));
        setIsDirty(false);
      })
      .catch((err: unknown) => {
        setLoadError(
          (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage
          ?? 'Failed to load orchestrator details',
        );
      });
  }, [orchId]);

  const update = useCallback((field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveError(null);
    onDirty?.();
  }, [onDirty]);

  const handleSave = async () => {
    if (!orchId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.saveOrchestrator(orchId, {
        orchDisplayName: data.name?.trim() || undefined,
        orchDescText: data.description || undefined,
      });
      setIsDirty(false);
    } catch (err: unknown) {
      setSaveError(
        (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage
        ?? 'Failed to save orchestrator',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const F = (p: { label: string; field: string; ro?: boolean }) => (
    <Field label={p.label} value={data[p.field] ?? ''} onChange={v => update(p.field, v)} ro={p.ro} />
  );

  return (
    <div className="flex-1 overflow-auto p-5">
      {loadError && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">{loadError}</div>
      )}
      {saveError && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">{saveError}</div>
      )}

      <div className="max-w-2xl space-y-4">
        {isDirty && (
          <div className="flex justify-end">
            <button
              onClick={() => { void handleSave(); }}
              disabled={isSaving}
              className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        <F label="Orchestrator ID" field="orchId" ro />
        <F label="Orchestrator Name *" field="name" />
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Description</label>
          <textarea rows={3} value={data.description ?? ''} onChange={e => update('description', e.target.value)}
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
          <F label="Created On" field="createdOn" ro />
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
