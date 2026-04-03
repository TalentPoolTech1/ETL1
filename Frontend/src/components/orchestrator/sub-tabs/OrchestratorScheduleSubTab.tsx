/**
 * Orchestrator > Schedule sub-tab
 * Guided schedule builder only; backend still persists the recurring mode as a cron expression internally.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Info, Clock, Zap, Hand, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '@/services/api';

type ScheduleType = 'cron' | 'interval' | 'event' | 'manual';

interface ScheduleConfig {
  name: string;
  enabled: boolean;
  type: ScheduleType;
  // Cron
  cronExpression: string;
  cronPreset: 'hourly' | 'daily' | 'weekly' | 'monthly';
  cronMinute: string;
  cronHour: string;
  cronDayOfWeek: string;
  cronDayOfMonth: string;
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
  cronExpression: '0 2 * * *',
  cronPreset: 'daily',
  cronMinute: '0',
  cronHour: '2',
  cronDayOfWeek: '1',
  cronDayOfMonth: '1',
  timezone: 'UTC',
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
  cron:     'Recurring',
  interval: 'Interval',
  event:    'Event-triggered',
  manual:   'Manual Only',
};

const TYPE_DESCRIPTIONS: Record<ScheduleType, string> = {
  cron: 'Build recurring schedules entirely from guided selections such as hourly, daily, weekly, or monthly.',
  interval: 'Run every N minutes, hours, or days from an effective start window.',
  event: 'Wait for an external event or file arrival before triggering the orchestrator.',
  manual: 'No automatic schedule. Only explicit run actions or API calls can trigger execution.',
};

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

const CRON_PRESET_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index));
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index));
const DAY_OF_WEEK_OPTIONS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];
const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, index) => String(index + 1));

function pad2(value: string): string {
  return String(value).padStart(2, '0');
}

function buildCronExpression(cfg: ScheduleConfig): string {
  switch (cfg.cronPreset) {
    case 'hourly':
      return `${cfg.cronMinute} * * * *`;
    case 'daily':
      return `${cfg.cronMinute} ${cfg.cronHour} * * *`;
    case 'weekly':
      return `${cfg.cronMinute} ${cfg.cronHour} * * ${cfg.cronDayOfWeek}`;
    case 'monthly':
      return `${cfg.cronMinute} ${cfg.cronHour} ${cfg.cronDayOfMonth} * *`;
    default:
      return DEFAULTS.cronExpression;
  }
}

function describeCronSchedule(cfg: ScheduleConfig): string {
  const timeLabel = `${pad2(cfg.cronHour)}:${pad2(cfg.cronMinute)}`;
  switch (cfg.cronPreset) {
    case 'hourly':
      return `Every hour at minute ${pad2(cfg.cronMinute)}`;
    case 'daily':
      return `Every day at ${timeLabel}`;
    case 'weekly': {
      const dayLabel = DAY_OF_WEEK_OPTIONS.find(option => option.value === cfg.cronDayOfWeek)?.label ?? 'selected weekday';
      return `Every ${dayLabel} at ${timeLabel}`;
    }
    case 'monthly':
      return `Day ${cfg.cronDayOfMonth} of every month at ${timeLabel}`;
    default:
      return 'Not configured';
  }
}

function deriveCronBuilderState(expression: string): Pick<ScheduleConfig, 'cronExpression' | 'cronPreset' | 'cronMinute' | 'cronHour' | 'cronDayOfWeek' | 'cronDayOfMonth'> {
  const fallback = {
    cronExpression: DEFAULTS.cronExpression,
    cronPreset: DEFAULTS.cronPreset,
    cronMinute: DEFAULTS.cronMinute,
    cronHour: DEFAULTS.cronHour,
    cronDayOfWeek: DEFAULTS.cronDayOfWeek,
    cronDayOfMonth: DEFAULTS.cronDayOfMonth,
  } as const;

  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return fallback;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  if (hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    return { ...fallback, cronExpression: expression, cronPreset: 'hourly', cronMinute: minute };
  }

  if (dayOfMonth === '*' && dayOfWeek === '*') {
    return { ...fallback, cronExpression: expression, cronPreset: 'daily', cronMinute: minute, cronHour: hour };
  }

  if (dayOfMonth === '*' && dayOfWeek !== '*') {
    return { ...fallback, cronExpression: expression, cronPreset: 'weekly', cronMinute: minute, cronHour: hour, cronDayOfWeek: dayOfWeek };
  }

  if (dayOfMonth !== '*' && dayOfWeek === '*') {
    return { ...fallback, cronExpression: expression, cronPreset: 'monthly', cronMinute: minute, cronHour: hour, cronDayOfMonth: dayOfMonth };
  }

  return { ...fallback, cronExpression: expression };
}

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
    <section className={`overflow-hidden rounded-xl border border-slate-800 bg-[#0f1424] shadow-[0_0_0_1px_rgba(15,23,42,0.35)] ${className}`}>
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-300">{title}</div>
        {description && <p className="mt-1 text-[13px] text-slate-400">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function isPersistableScheduleType(type: ScheduleType): boolean {
  return type === 'cron' || type === 'manual';
}

function SummaryMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const toneClass = tone === 'good'
    ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-200'
    : tone === 'warn'
      ? 'border-amber-900/50 bg-amber-950/20 text-amber-200'
      : 'border-slate-800 bg-[#11182b] text-slate-200';

  return (
    <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 text-[14px] font-medium">{value}</div>
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

  const updateCronBuilder = (patch: Partial<ScheduleConfig>) => {
    setCfg(prev => {
      const next = { ...prev, ...patch };
      return { ...next, cronExpression: buildCronExpression(next) };
    });
    onDirty?.();
  };

  const isPersistable = useMemo(() => isPersistableScheduleType(cfg.type), [cfg.type]);
  const scheduleExpressionLabel = useMemo(() => {
    switch (cfg.type) {
      case 'cron':
        return describeCronSchedule(cfg);
      case 'interval':
        return `Every ${cfg.intervalValue || '—'} ${cfg.intervalUnit || '—'}`;
      case 'event':
        return cfg.eventSource ? `Awaiting ${cfg.eventSource}` : 'Waiting for configured event source';
      case 'manual':
        return 'Manual execution only';
      default:
        return 'Not configured';
    }
  }, [cfg.cronExpression, cfg.eventSource, cfg.intervalUnit, cfg.intervalValue, cfg.type]);

  const effectiveWindowLabel = useMemo(() => {
    if (!cfg.effectiveFrom && !cfg.effectiveTo) return 'No restriction';
    const from = cfg.effectiveFrom ? new Date(cfg.effectiveFrom).toLocaleString() : 'Immediate';
    const to = cfg.effectiveTo ? new Date(cfg.effectiveTo).toLocaleString() : 'No end';
    return `${from} → ${to}`;
  }, [cfg.effectiveFrom, cfg.effectiveTo]);

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
      const cronBuilder = deriveCronBuilderState(String(row.cron_expression_text ?? DEFAULTS.cronExpression));
      setCfg(prev => ({
        ...prev,
        enabled: row.is_schedule_active === true,
        type: 'cron',
        ...cronBuilder,
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
        cronExpression: cfg.type === 'manual' ? '0 0 1 1 *' : buildCronExpression(cfg),
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

  const cronBuilderFields = new Set<keyof ScheduleConfig>([
    'cronPreset',
    'cronMinute',
    'cronHour',
    'cronDayOfWeek',
    'cronDayOfMonth',
  ]);

  const F = ({ label, field, type = 'text', options, placeholder, disabled = false }: {
    label: string; field: keyof ScheduleConfig; type?: string;
    options?: Array<string | { value: string; label: string }>; placeholder?: string; disabled?: boolean;
  }) => {
    const baseClass = `w-full h-9 px-3 rounded-lg text-[13px] outline-none ${
      disabled
        ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
        : 'bg-slate-800 border border-slate-700 text-slate-200 focus:border-blue-500'
    }`;
    return (
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 mb-1.5">{label}</label>
        {options ? (
          <select
            value={String(cfg[field])}
            disabled={disabled}
            onChange={e => (
              cronBuilderFields.has(field)
                ? updateCronBuilder({ [field]: e.target.value } as Partial<ScheduleConfig>)
                : update({ [field]: e.target.value } as Partial<ScheduleConfig>)
            )}
            className={baseClass}>
            {options.map(option => {
              const value = typeof option === 'string' ? option : option.value;
              const labelValue = typeof option === 'string' ? option : option.label;
              return <option key={value} value={value}>{labelValue}</option>;
            })}
          </select>
        ) : (
          <input type={type} value={String(cfg[field])} placeholder={placeholder} disabled={disabled}
            onChange={e => update({ [field]: e.target.value } as Partial<ScheduleConfig>)}
            className={baseClass} />
        )}
      </div>
    );
  };

  const Checkbox = ({ label, field }: { label: string; field: keyof ScheduleConfig }) => (
    <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-slate-800 bg-[#11182b] px-3 py-2.5">
      <input type="checkbox" checked={Boolean(cfg[field])} onChange={e => update({ [field]: e.target.checked } as Partial<ScheduleConfig>)}
        className="w-4 h-4 accent-blue-500" />
      <span className="text-[13px] text-slate-200">{label}</span>
    </label>
  );

  return (
    <div className="flex-1 overflow-auto bg-[#0d0f1a] px-6 py-5">
      <div className="mx-auto w-full max-w-[1680px] space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            disabled={isLoading || isSaving}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-800/50 border border-slate-700 text-[13px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="rounded-lg border border-slate-800 bg-[#11182b] px-3 py-2 text-[13px] text-slate-300">
            {cfg.enabled ? 'Schedule is enabled' : 'Schedule is disabled'}
          </div>
          <button
            onClick={save}
            disabled={isLoading || isSaving}
            className="ml-auto h-9 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save Schedule'}
          </button>
          <button
            onClick={clear}
            disabled={isLoading || isSaving}
            className="h-9 px-3 rounded-lg bg-slate-800/50 border border-slate-700 text-[13px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
          >
            Delete
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded border border-red-900/50 bg-red-900/20 text-red-200 text-[12px]">
            {error}
          </div>
        )}
        {banner && !error && (
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/30 text-slate-300 text-[13px]">
            {banner}
          </div>
        )}

        {!isPersistable && (
          <div className="p-3 rounded-lg border border-amber-900/40 bg-amber-900/10 text-amber-200 text-[13px] flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Interval and Event schedules are not persisted yet. Select Recurring or Manual to save.
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="space-y-6 xl:col-span-8">
            <SectionCard title="Schedule Identity" description="Define how this orchestrator should be presented and whether scheduling is enabled.">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <F label="Schedule Name" field="name" placeholder="e.g. Daily 2 AM Accounts Load" />
                <div className="flex items-end">
                  <Checkbox label="Schedule Enabled" field="enabled" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Scheduling Mode" description="Choose how this orchestrator should start. The form below enables only the settings that apply to the selected mode.">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {(['cron', 'interval', 'event', 'manual'] as ScheduleType[]).map((t) => {
                  const active = cfg.type === t;
                  const supported = isPersistableScheduleType(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => (t === 'cron' ? updateCronBuilder({ type: t }) : update({ type: t }))}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        active ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-[#11182b] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className={`flex min-w-0 items-center gap-2 text-[13px] font-medium ${active ? 'text-blue-200' : 'text-slate-100'}`}>
                            {TYPE_ICONS[t]}
                            <span>{TYPE_LABELS[t]}</span>
                          </div>
                          <p className="mt-2 text-[12px] leading-5 text-slate-400">
                            {TYPE_DESCRIPTIONS[t]}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                            active ? 'bg-blue-500/20 text-blue-200' : 'bg-slate-700/60 text-slate-400'
                          }`}>
                            {active ? 'Selected' : 'Choose'}
                          </span>
                          <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            supported ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                          }`}>
                            {supported ? 'Ready' : 'Preview'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {cfg.type === 'cron' && (
              <SectionCard title="Schedule Builder" description="Build the schedule entirely from guided selections. No manual expression entry is required.">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <F label="Pattern" field="cronPreset" options={CRON_PRESET_OPTIONS.map(option => ({ value: option.value, label: option.label }))} />
                    <F label="Hour" field="cronHour" options={HOUR_OPTIONS} disabled={cfg.cronPreset === 'hourly'} />
                    <F label={cfg.cronPreset === 'hourly' ? 'Minute of Hour' : 'Minute'} field="cronMinute" options={MINUTE_OPTIONS} />
                    <F label="Day of Week" field="cronDayOfWeek" options={DAY_OF_WEEK_OPTIONS.map(option => ({ value: option.value, label: option.label }))} disabled={cfg.cronPreset !== 'weekly'} />
                    <F label="Day of Month" field="cronDayOfMonth" options={DAY_OF_MONTH_OPTIONS} disabled={cfg.cronPreset !== 'monthly'} />
                    <F label="Timezone" field="timezone" options={TIMEZONE_OPTIONS} />
                    <F label="Catch-Up Rule" field="catchUpRule" options={['no_catchup','run_once','run_all_missed']} />
                    <F label="Max Concurrent Runs" field="maxConcurrent" type="number" />
                    <F label="Misfire Policy" field="misfirePolicy" options={['ignore','fire_once','do_nothing','fire_all']} />
                    <F label="Effective From" field="effectiveFrom" type="datetime-local" />
                    <F label="Effective To" field="effectiveTo" type="datetime-local" />
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#11182b] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Schedule Summary</div>
                    <div className="mt-2 text-[14px] font-medium text-slate-100">{describeCronSchedule(cfg)}</div>
                    <div className="mt-2 text-[12px] text-slate-400">
                      The runtime schedule is generated automatically from the selections above.
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            {cfg.type === 'interval' && (
              <SectionCard title="Interval Definition" description="Define the frequency window and timezone for interval-driven orchestration.">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <F label="Every" field="intervalValue" type="number" />
                  <F label="Unit" field="intervalUnit" options={['minutes','hours','days']} />
                  <F label="Timezone" field="timezone" options={TIMEZONE_OPTIONS} />
                  <F label="Effective From" field="effectiveFrom" type="datetime-local" />
                  <F label="Effective To" field="effectiveTo" type="datetime-local" />
                </div>
              </SectionCard>
            )}

            {cfg.type === 'event' && (
              <SectionCard title="Event Trigger Definition" description="Capture the source and optional filter pattern for event-driven execution.">
                <div className="space-y-4">
                  <F label="Event Source" field="eventSource" placeholder="e.g. S3 bucket, Kafka topic, webhook" />
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 mb-1.5">Event Filter</label>
                    <textarea
                      rows={4}
                      value={cfg.eventFilter}
                      onChange={e => update({ eventFilter: e.target.value })}
                      placeholder={'{"prefix": "data/", "suffix": ".parquet"}'}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-[13px] text-slate-200 font-mono outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>
              </SectionCard>
            )}

            {cfg.type === 'manual' && (
              <SectionCard title="Manual Execution" description="Manual mode disables automatic triggering and keeps this orchestrator run-on-demand.">
                <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-[#11182b] px-4 py-4">
                  <Hand className="w-5 h-5 text-slate-200 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-[14px] font-medium text-slate-100">Run only when explicitly triggered</div>
                    <p className="text-[13px] leading-6 text-slate-400">
                      No scheduler will trigger this orchestrator automatically. It will only run from the toolbar, API, or another orchestrator.
                    </p>
                  </div>
                </div>
              </SectionCard>
            )}

            <SectionCard title="Execution Policy" description="Configure retries, failure behavior, and runtime notifications.">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-300">Retry Policy</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <F label="Strategy" field="retryPolicy" options={['fixed','exponential','no_retry']} />
                    <F label="Max Retries" field="retryCount" type="number" />
                    <F label="Retry Delay (s)" field="retryDelayS" type="number" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-300">Failure Handling</div>
                  <div className="grid grid-cols-1 gap-4">
                    <F label="On Failure" field="failureHandling" options={['stop','continue','rollback','skip_and_continue','alert_only']} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Checkbox label="Notify on failure" field="notifyOnFailure" />
                      <Checkbox label="Notify on success" field="notifyOnSuccess" />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Advanced Windows" description="Optional operating windows and holiday controls for enterprise scheduling.">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 mb-1.5">Blackout Windows</label>
                  <textarea
                    rows={4}
                    value={cfg.blackoutWindows}
                    onChange={e => update({ blackoutWindows: e.target.value })}
                    placeholder={'Mon-Fri 23:00-06:00 UTC\nSat-Sun all-day'}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                <F label="Holiday Calendar Reference" field="holidayCalendar" placeholder="e.g. US Federal Holidays" />
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-6 xl:col-span-4 xl:sticky xl:top-5">
            <SectionCard title="Schedule Summary" description="A live summary of the orchestrator schedule currently configured in this editor.">
              <div className="space-y-3">
                <SummaryMetric label="Mode" value={TYPE_LABELS[cfg.type]} tone={isPersistable ? 'good' : 'warn'} />
                <SummaryMetric label="Schedule" value={scheduleExpressionLabel} />
                <SummaryMetric label="Timezone" value={cfg.timezone || 'UTC'} />
                <SummaryMetric label="Effective Window" value={effectiveWindowLabel} />
                <SummaryMetric label="Retries" value={`${cfg.retryCount || '0'} attempts • ${cfg.retryPolicy}`} />
                <SummaryMetric label="Failure Action" value={cfg.failureHandling} />
              </div>
            </SectionCard>

            <SectionCard title="Readiness Check" description="Operational checks before you publish or enable the orchestrator schedule.">
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-[#11182b] px-4 py-3">
                  {cfg.enabled ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                  )}
                  <div>
                    <div className="text-[13px] font-medium text-slate-100">
                      {cfg.enabled ? 'Scheduler is enabled' : 'Scheduler is currently disabled'}
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-slate-400">
                      {cfg.enabled
                        ? 'This orchestrator is eligible to be triggered automatically once saved.'
                        : 'It will not auto-trigger until scheduling is enabled and saved.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-[#11182b] px-4 py-3">
                  {isPersistable ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                  )}
                  <div>
                    <div className="text-[13px] font-medium text-slate-100">
                      {isPersistable ? 'Persistable schedule mode' : 'Design-only schedule mode'}
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-slate-400">
                      {isPersistable
                        ? 'The current backend will store this scheduling mode.'
                        : 'Interval and Event designs are visible in the UI, but the backend currently persists only Recurring and Manual.'}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </div>
  );
}
