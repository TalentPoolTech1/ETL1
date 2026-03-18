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
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {options ? (
        <select value={String(cfg[field])} onChange={e => update({ [field]: e.target.value } as Partial<ScheduleConfig>)}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={String(cfg[field])} placeholder={placeholder}
          onChange={e => update({ [field]: e.target.value } as Partial<ScheduleConfig>)}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      )}
    </div>
  );

  const Checkbox = ({ label, field }: { label: string; field: keyof ScheduleConfig }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={Boolean(cfg[field])} onChange={e => update({ [field]: e.target.checked } as Partial<ScheduleConfig>)}
        className="w-3.5 h-3.5 accent-blue-500" />
      <span className="text-[12px] text-slate-300">{label}</span>
    </label>
  );

  return (
    <div className="flex-1 overflow-auto p-5 bg-[#0d0f1a]">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={isLoading || isSaving}
            className="flex items-center gap-2 h-8 px-3 rounded bg-slate-800/50 border border-slate-700 text-[12px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={save}
            disabled={isLoading || isSaving}
            className="ml-auto h-8 px-3 rounded bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save Schedule'}
          </button>
          <button
            onClick={clear}
            disabled={isLoading || isSaving}
            className="h-8 px-3 rounded bg-slate-800/50 border border-slate-700 text-[12px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
          >
            Delete
          </button>
        </div>

        {error && (
          <div className="p-3 rounded border border-red-900/50 bg-red-900/20 text-red-200 text-[12px]">
            {error}
          </div>
        )}
        {banner && !error && (
          <div className="p-3 rounded border border-slate-800 bg-slate-900/30 text-slate-300 text-[12px]">
            {banner}
          </div>
        )}

        {!isPersistable && (
          <div className="p-3 rounded border border-amber-900/40 bg-amber-900/10 text-amber-200 text-[12px] flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Interval and Event schedules are not persisted yet. Select Cron or Manual to save.
          </div>
        )}

        {/* Basic settings */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="Schedule Name *" field="name" placeholder="e.g. Daily 2am Run" />
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer pb-1">
                <input type="checkbox" checked={cfg.enabled} onChange={e => update({ enabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-500" />
                <span className="text-[13px] text-slate-300 font-medium">Schedule Enabled</span>
              </label>
            </div>
          </div>
        </div>

        {/* Schedule type selector */}
        <div>
          <label className="block text-[11px] text-slate-500 mb-2">Schedule Type</label>
          <div className="grid grid-cols-4 gap-2">
            {(['cron', 'interval', 'event', 'manual'] as ScheduleType[]).map(t => (
              <button key={t} onClick={() => update({ type: t })}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                  cfg.type === t
                    ? 'bg-blue-900/40 border-blue-600 text-blue-300'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}>
                {TYPE_ICONS[t]}
                <span className="text-[11px] font-medium">{TYPE_LABELS[t]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Type-specific config */}
        {cfg.type === 'cron' && (
          <div className="space-y-4 p-4 bg-slate-800/20 border border-slate-800 rounded-lg">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Cron Settings</div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Cron Expression *</label>
              <input value={cfg.cronExpression} onChange={e => update({ cronExpression: e.target.value })}
                className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 font-mono outline-none focus:border-blue-500" />
              <p className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> 5-field cron: minute hour day-of-month month day-of-week
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <F label="Timezone" field="timezone"
                options={['UTC','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Berlin','Europe/Paris','Asia/Kolkata','Asia/Tokyo','Asia/Singapore','Australia/Sydney']} />
              <F label="Catch-Up Rule" field="catchUpRule" options={['no_catchup','run_once','run_all_missed']} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <F label="Effective From" field="effectiveFrom" type="datetime-local" />
              <F label="Effective To" field="effectiveTo" type="datetime-local" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <F label="Max Concurrent Runs" field="maxConcurrent" type="number" />
              <F label="Misfire Policy" field="misfirePolicy" options={['ignore','fire_once','do_nothing','fire_all']} />
            </div>
          </div>
        )}

        {cfg.type === 'interval' && (
          <div className="space-y-4 p-4 bg-slate-800/20 border border-slate-800 rounded-lg">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Interval Settings</div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[11px] text-slate-500 mb-1">Every</label>
                <input type="number" min="1" value={cfg.intervalValue} onChange={e => update({ intervalValue: e.target.value })}
                  className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] text-slate-500 mb-1">Unit</label>
                <select value={cfg.intervalUnit} onChange={e => update({ intervalUnit: e.target.value })}
                  className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500">
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
            <F label="Timezone" field="timezone"
              options={['UTC','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Berlin','Asia/Kolkata','Asia/Tokyo']} />
            <div className="grid grid-cols-2 gap-4">
              <F label="Effective From" field="effectiveFrom" type="datetime-local" />
              <F label="Effective To" field="effectiveTo" type="datetime-local" />
            </div>
          </div>
        )}

        {cfg.type === 'event' && (
          <div className="space-y-4 p-4 bg-slate-800/20 border border-slate-800 rounded-lg">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Event Trigger Settings</div>
            <F label="Event Source" field="eventSource" placeholder="e.g. S3 bucket, Kafka topic, webhook" />
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Event Filter (optional)</label>
              <textarea rows={3} value={cfg.eventFilter} onChange={e => update({ eventFilter: e.target.value })}
                placeholder={'{"prefix": "data/", "suffix": ".parquet"}'}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 font-mono outline-none focus:border-blue-500 resize-none" />
            </div>
          </div>
        )}

        {cfg.type === 'manual' && (
          <div className="p-4 bg-slate-800/20 border border-slate-800 rounded-lg flex items-start gap-3">
            <Hand className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-medium text-slate-300">Manual Execution Only</div>
              <p className="text-[12px] text-slate-500 mt-1">This orchestrator will only run when explicitly triggered via the Run button, API, or another orchestrator.</p>
            </div>
          </div>
        )}

        {/* Retry policy */}
        <div className="space-y-4 p-4 bg-slate-800/20 border border-slate-800 rounded-lg">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Retry Policy</div>
          <div className="grid grid-cols-3 gap-4">
            <F label="Strategy" field="retryPolicy" options={['fixed','exponential','no_retry']} />
            <F label="Max Retries" field="retryCount" type="number" />
            <F label="Retry Delay (s)" field="retryDelayS" type="number" />
          </div>
        </div>

        {/* Failure handling */}
        <div className="space-y-4 p-4 bg-slate-800/20 border border-slate-800 rounded-lg">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Failure Handling</div>
          <F label="On Failure" field="failureHandling"
            options={['stop','continue','rollback','skip_and_continue','alert_only']} />
          <div className="space-y-2">
            <Checkbox label="Notify on failure" field="notifyOnFailure" />
            <Checkbox label="Notify on success" field="notifyOnSuccess" />
          </div>
        </div>

        {/* Advanced */}
        <div className="space-y-4 p-4 bg-slate-800/20 border border-slate-800 rounded-lg">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Advanced</div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Blackout Windows</label>
            <textarea rows={2} value={cfg.blackoutWindows} onChange={e => update({ blackoutWindows: e.target.value })}
              placeholder={'Mon-Fri 23:00-06:00 UTC\nSat-Sun all-day'}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" />
          </div>
          <F label="Holiday Calendar Reference" field="holidayCalendar"
            placeholder="e.g. US Federal Holidays" />
        </div>

      </div>
    </div>
  );
}
