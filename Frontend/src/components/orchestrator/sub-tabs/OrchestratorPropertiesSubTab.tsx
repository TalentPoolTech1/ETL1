/**
 * Orchestrator > Properties sub-tab
 * Loads real orchestrator data from the API and persists changes via PUT.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import api from '@/services/api';

function Field({ label, value, onChange, ro, required }: { label: string; value: string; onChange?: (v: string) => void; ro?: boolean; required?: boolean }) {
  return (
    <div>
      <label className="field-label">{label}{required && <span className="field-required">*</span>}</label>
      {ro ? (
        <div className="field-input-ro">{value || '—'}</div>
      ) : (
        <input type="text" value={value} onChange={e => onChange?.(e.target.value)} className="field-input" />
      )}
    </div>
  );
}

type FD = Record<string, string>;

function SectionCard({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-[#0f1424] shadow-[0_0_0_1px_rgba(15,23,42,0.35)] ${className}`}>
      <div className="border-b border-slate-800 px-5 py-4">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-300">{title}</div>
          {description && <p className="mt-1 text-[13px] text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function isMeaningfulValue(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  return trimmed !== '' && trimmed !== '—';
}

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

  const F = (p: { label: string; field: string; ro?: boolean; required?: boolean }) => (
    <Field label={p.label} value={data[p.field] ?? ''} onChange={v => update(p.field, v)} ro={p.ro} required={p.required} />
  );

  const auditFields = [
    { label: 'Created On', field: 'createdOn' },
    { label: 'Updated On', field: 'updatedOn' },
    { label: 'Last Executed On', field: 'lastExecutedOn' },
    { label: 'Last Success On', field: 'lastSuccessOn' },
    { label: 'Last Failed On', field: 'lastFailedOn' },
  ].filter(item => isMeaningfulValue(data[item.field]));

  return (
    <div className="panel-page px-6 py-5">
      <div className="mx-auto w-full max-w-[1680px] space-y-5">
        {loadError && <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">{loadError}</div>}
        {saveError && <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">{saveError}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-slate-800 bg-[#11182b] px-3 py-2 text-[13px] text-slate-300">
            {isDirty ? 'Unsaved orchestrator changes' : 'Properties saved'}
          </div>
          <button onClick={() => { void handleSave(); }} disabled={!isDirty || isSaving}
            className="ml-auto inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving…' : 'Save Properties'}
          </button>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Identity"
            description="Core orchestrator identity and business-facing metadata."
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="xl:col-span-2"><F label="Orchestrator ID" field="orchId" ro /></div>
              <div className="xl:col-span-2"><F label="Orchestrator Name" field="name" required /></div>
              <div className="xl:col-span-2">
                <label className="field-label">Description</label>
                <textarea rows={4} value={data.description ?? ''} onChange={e => update('description', e.target.value)} className="field-textarea" />
              </div>
              <F label="Status" field="status" ro />
              <div className="xl:col-span-2"><F label="Tags" field="tags" /></div>
            </div>
          </SectionCard>

          <SectionCard
            title="Runtime Configuration"
            description="Execution behavior and operational controls."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <F label="Timeout Policy" field="timeoutPolicy" />
              <F label="Retry Policy" field="retryPolicy" />
              <F label="Concurrency Rule" field="concurrencyRule" />
            </div>
          </SectionCard>

          <SectionCard
            title="Audit Timeline"
            description="Only the most useful lifecycle signals are shown here."
          >
            {auditFields.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {auditFields.map(item => (
                  <F key={item.field} label={item.label} field={item.field} ro />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-[#11182b] px-4 py-4 text-[13px] text-slate-400">
                No meaningful audit timestamps are available for this orchestrator yet.
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
