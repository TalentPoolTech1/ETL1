/**
 * Orchestrator > Schedule sub-tab — v2 spec
 * Types: Cron | Interval | Event | Manual
 * Fields: Name, Enabled, Timezone, Retry policy, Failure handling
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Info, Clock, Zap, Hand, RefreshCw } from 'lucide-react';
import api from '@/services/api';

type ScheduleType = 'cron' | 'interval' | 'event' | 'manual';

interface ScheduleConfig {
  name: string;
  enabled: boolean;
  type: ScheduleType;
  // Cron
  cronExpression: string;
  timezone: string;
  effectiveFrom: string;
  effectiveTo: string;
  catchUpRule: string;
  maxConcurrent: string;
  misfirePolicy: string;
  // Interval
  intervalValue: string;
  intervalUnit: string;
  // Event
  eventSource: string;
  eventFilter: string;
  // Shared
  retryPolicy: string;
  retryCount: string;
  retryDelayS: string;
  failureHandling: string;
  notifyOnFailure: boolean;
  notifyOnSuccess: boolean;
  blackoutWindows: string;
  holidayCalendar: string;
}

const DEFAULTS: ScheduleConfig = {
  name: '', enabled: false, type: 'cron',
  cronExpression: '0 2 * * *', timezone: 'UTC',
  effectiveFrom: '', effectiveTo: '',
  catchUpRule: 'no_catchup', maxConcurrent: '1', misfirePolicy: 'ignore',
  intervalValue: '1', intervalUnit: 'hours',
  eventSource: '', eventFilter: '',
  retryPolicy: 'fixed', retryCount: '3', retryDelayS: '60',
  failureHandling: 'stop', notifyOnFailure: true, notifyOnSuccess: false,
  blackoutWindows: '', holidayCalendar: '',
};

const TYPE_ICONS: Record<ScheduleType, React.ReactNode> = {
  cron:     <Calendar className="w-4 h-4" />,
  interval: <Clock className="w-4 h-4" />,
  event:    <Zap className="w-4 h-4" />,
  manual:   <Hand className="w-4 h-4" />,
};

const TYPE_LABELS: Record<ScheduleType, string> = {
  cron:     'Cron',
  interval: 'Interval',
  event:    'Event-triggered',
  manual:   'Manual Only',
};

function ZebraSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-slate-800">
      <div className="border-b border-slate-800 bg-[#0f1528] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function ZebraItem({ index, children, className = '' }: { index: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={`${index > 0 ? 'border-t border-slate-800' : ''} ${index % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-2 py-1.5 ${className}`}>
      {children}
    </div>
  );
}

export function OrchestratorScheduleSubTab({ orchId, onDirty }: { orchId: string; onDirty?: () => void }) {
  const [cfg, setCfg] = useState<ScheduleConfig>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const update = (patch: Partial<ScheduleConfig>) => {
    setCfg(prev => ({ ...prev, ...patch }));
    onDirty?.();
  };

  const isPersistable = useMemo(() => cfg.type === 'cron' || cfg.type === 'manual', [cfg.type]);

  const load = useCallback(async () => {
    if (!orchId) return;
    setIsLoading(true);
    setError(null);
    setBanner(null);
    try {
      const res = await api.getOrchestratorSchedule(orchId);
      const row = (res.data as any)?.data ?? null;
      if (!row) {
        setCfg(prev => ({ ...prev, enabled: false, type: 'cron' }));
        setBanner('No schedule configured yet.');
        return;
      }
      setCfg(prev => ({
        ...prev,
        enabled: row.is_schedule_active === true,
        type: 'cron',
        cronExpression: String(row.cron_expression_text ?? prev.cronExpression),
        timezone: String(row.timezone_name_text ?? prev.timezone),
      }));
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to load schedule');
    } finally {
      setIsLoading(false);
    }
  }, [orchId]);

  const save = useCallback(async () => {
    if (!orchId) return;
    setIsSaving(true);
    setError(null);
    setBanner(null);
    try {
      if (!isPersistable) {
        setError('Only Cron and Manual schedules are supported by the backend right now.');
        return;
      }
      await api.saveOrchestratorSchedule(orchId, {
        cronExpression: cfg.type === 'manual' ? '0 0 1 1 *' : cfg.cronExpression,
        timezone: cfg.timezone,
        isActive: cfg.enabled,
      });
      setBanner('Schedule saved.');
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  }, [orchId, cfg.type, cfg.cronExpression, cfg.timezone, cfg.enabled, isPersistable]);

  const clear = useCallback(async () => {
    if (!orchId) return;
    setIsSaving(true);
    setError(null);
    setBanner(null);
    try {
      await api.deleteOrchestratorSchedule(orchId);
      setCfg(DEFAULTS);
      setBanner('Schedule deleted.');
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to delete schedule');
    } finally {
      setIsSaving(false);
    }
  }, [orchId]);

  useEffect(() => { void load(); }, [load]);

  const F = ({ label, field, type = 'text', options, placeholder }: {
    label: string; field: keyof ScheduleConfig; type?: string;
    options?: string[]; placeholder?: string;
  }) => (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">{label}</label>
      {options ? (
        <select value={String(cfg[field])} onChange={e => update({ [field]: e.target.value } as Partial<ScheduleConfig>)}
          className="w-full h-6 px-1.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 outline-none focus:border-blue-500">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={String(cfg[field])} placeholder={placeholder}
          onChange={e => update({ [field]: e.target.value } as Partial<ScheduleConfig>)}
          className="w-full h-6 px-1.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 outline-none focus:border-blue-500" />
      )}
    </div>
  );

  const Checkbox = ({ label, field }: { label: string; field: keyof ScheduleConfig }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={Boolean(cfg[field])} onChange={e => update({ [field]: e.target.checked } as Partial<ScheduleConfig>)}
        className="w-3 h-3 accent-blue-500" />
      <span className="text-[10px] text-slate-300">{label}</span>
    </label>
  );

  return (
    <div className="flex-1 overflow-auto p-5 bg-[#0d0f1a]">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={isLoading || isSaving}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded bg-slate-800/50 border border-slate-700 text-[10px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={save}
            disabled={isLoading || isSaving}
            className="ml-auto h-7 px-2.5 rounded bg-blue-600 text-white text-[10px] font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save Schedule'}
          </button>
          <button
            onClick={clear}
            disabled={isLoading || isSaving}
            className="h-7 px-2.5 rounded bg-slate-800/50 border border-slate-700 text-[10px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
          >
            Delete
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded border border-red-900/50 bg-red-900/20 text-red-200 text-[11px]">
            {error}
          </div>
        )}
        {banner && !error && (
          <div className="p-2.5 rounded border border-slate-800 bg-slate-900/30 text-slate-300 text-[11px]">
            {banner}
          </div>
        )}

        {!isPersistable && (
          <div className="p-2.5 rounded border border-amber-900/40 bg-amber-900/10 text-amber-200 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Interval and Event schedules are not persisted yet. Select Cron or Manual to save.
          </div>
        )}

        <ZebraSection title="Basic Settings">
          <ZebraItem index={0}>
            <F label="Schedule Name" field="name" placeholder="e.g. Daily 2am Run" />
          </ZebraItem>
          <ZebraItem index={1}>
            <Checkbox label="Schedule Enabled" field="enabled" />
          </ZebraItem>
        </ZebraSection>

        <ZebraSection title="Schedule Type">
          {(['cron', 'interval', 'event', 'manual'] as ScheduleType[]).map((t, index) => (
            <ZebraItem index={index} key={t}>
              <button
                type="button"
                onClick={() => update({ type: t })}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2 text-[10px] text-slate-200">
                  {TYPE_ICONS[t]}
                  <span className="font-medium">{TYPE_LABELS[t]}</span>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${cfg.type === t ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-700/60 text-slate-400'}`}>
                  {cfg.type === t ? 'Active' : 'Use'}
                </span>
              </button>
            </ZebraItem>
          ))}
        </ZebraSection>

        {cfg.type === 'cron' && (
          <ZebraSection title="Cron Settings">
            <ZebraItem index={0}>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">Cron Expression</label>
                <input value={cfg.cronExpression} onChange={e => update({ cronExpression: e.target.value })}
                  className="w-full h-6 px-1.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 font-mono outline-none focus:border-blue-500" />
                <p className="mt-1 flex items-center gap-1 text-[9px] text-slate-600">
                  <Info className="w-3 h-3" /> 5-field cron: minute hour day-of-month month day-of-week
                </p>
              </div>
            </ZebraItem>
            <ZebraItem index={1}><F label="Timezone" field="timezone" options={['UTC','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Berlin','Europe/Paris','Asia/Kolkata','Asia/Tokyo','Asia/Singapore','Australia/Sydney']} /></ZebraItem>
            <ZebraItem index={2}><F label="Catch-Up Rule" field="catchUpRule" options={['no_catchup','run_once','run_all_missed']} /></ZebraItem>
            <ZebraItem index={3}><F label="Effective From" field="effectiveFrom" type="datetime-local" /></ZebraItem>
            <ZebraItem index={4}><F label="Effective To" field="effectiveTo" type="datetime-local" /></ZebraItem>
            <ZebraItem index={5}><F label="Max Concurrent Runs" field="maxConcurrent" type="number" /></ZebraItem>
            <ZebraItem index={6}><F label="Misfire Policy" field="misfirePolicy" options={['ignore','fire_once','do_nothing','fire_all']} /></ZebraItem>
          </ZebraSection>
        )}

        {cfg.type === 'interval' && (
          <ZebraSection title="Interval Settings">
            <ZebraItem index={0}><F label="Every" field="intervalValue" type="number" /></ZebraItem>
            <ZebraItem index={1}><F label="Unit" field="intervalUnit" options={['minutes','hours','days']} /></ZebraItem>
            <ZebraItem index={2}><F label="Timezone" field="timezone" options={['UTC','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Kolkata','Asia/Tokyo']} /></ZebraItem>
            <ZebraItem index={3}><F label="Effective From" field="effectiveFrom" type="datetime-local" /></ZebraItem>
            <ZebraItem index={4}><F label="Effective To" field="effectiveTo" type="datetime-local" /></ZebraItem>
          </ZebraSection>
        )}

        {cfg.type === 'event' && (
          <ZebraSection title="Event Trigger Settings">
            <ZebraItem index={0}><F label="Event Source" field="eventSource" placeholder="e.g. S3 bucket, Kafka topic, webhook" /></ZebraItem>
            <ZebraItem index={1}>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">Event Filter</label>
                <textarea rows={3} value={cfg.eventFilter} onChange={e => update({ eventFilter: e.target.value })}
                  placeholder={'{"prefix": "data/", "suffix": ".parquet"}'}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-1.5 py-1 text-[10px] text-slate-200 font-mono outline-none focus:border-blue-500 resize-none" />
              </div>
            </ZebraItem>
          </ZebraSection>
        )}

        {cfg.type === 'manual' && (
          <ZebraSection title="Manual Execution Only">
            <ZebraItem index={0} className="flex items-start gap-2">
              <Hand className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400">This orchestrator will only run when explicitly triggered via the Run button, API, or another orchestrator.</p>
            </ZebraItem>
          </ZebraSection>
        )}

        <ZebraSection title="Retry Policy">
          <ZebraItem index={0}><F label="Strategy" field="retryPolicy" options={['fixed','exponential','no_retry']} /></ZebraItem>
          <ZebraItem index={1}><F label="Max Retries" field="retryCount" type="number" /></ZebraItem>
          <ZebraItem index={2}><F label="Retry Delay (s)" field="retryDelayS" type="number" /></ZebraItem>
        </ZebraSection>

        <ZebraSection title="Failure Handling">
          <ZebraItem index={0}><F label="On Failure" field="failureHandling" options={['stop','continue','rollback','skip_and_continue','alert_only']} /></ZebraItem>
          <ZebraItem index={1}><Checkbox label="Notify on failure" field="notifyOnFailure" /></ZebraItem>
          <ZebraItem index={2}><Checkbox label="Notify on success" field="notifyOnSuccess" /></ZebraItem>
        </ZebraSection>

        <ZebraSection title="Advanced">
          <ZebraItem index={0}>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">Blackout Windows</label>
              <textarea rows={2} value={cfg.blackoutWindows} onChange={e => update({ blackoutWindows: e.target.value })}
                placeholder={'Mon-Fri 23:00-06:00 UTC\nSat-Sun all-day'}
                className="w-full rounded bg-slate-800 border border-slate-700 px-1.5 py-1 text-[10px] text-slate-200 outline-none focus:border-blue-500 resize-none" />
            </div>
          </ZebraItem>
          <ZebraItem index={1}><F label="Holiday Calendar Reference" field="holidayCalendar" placeholder="e.g. US Federal Holidays" /></ZebraItem>
        </ZebraSection>

      </div>
    </div>
  );
}
