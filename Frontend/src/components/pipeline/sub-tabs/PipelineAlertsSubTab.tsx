/**
 * Pipeline > Alerts sub-tab — Configure alert routing rules (persisted)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Bell, BellOff, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import api from '@/services/api';

type AlertEvent = 'EXECUTION_FAILED' | 'EXECUTION_SUCCEEDED' | 'EXECUTION_STARTED'
  | 'TIMED_OUT' | 'SLA_BREACHED' | 'RETRY_EXHAUSTED' | 'ROWS_BELOW_THRESHOLD' | 'ROWS_ABOVE_THRESHOLD';

type AlertChannel = 'email' | 'slack' | 'webhook' | 'pagerduty';

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  event: AlertEvent;
  channel: AlertChannel;
  target: string;
  condition?: string;
  conditionValue?: string;
  retryDelay?: number;
  silenceMinutes?: number;
}

const EVENT_LABELS: Record<AlertEvent, string> = {
  EXECUTION_FAILED:     'Execution Failed',
  EXECUTION_SUCCEEDED:  'Execution Succeeded',
  EXECUTION_STARTED:    'Execution Started',
  TIMED_OUT:            'Timed Out',
  SLA_BREACHED:         'SLA Breached',
  RETRY_EXHAUSTED:      'Retries Exhausted',
  ROWS_BELOW_THRESHOLD: 'Rows Below Threshold',
  ROWS_ABOVE_THRESHOLD: 'Rows Above Threshold',
};

const EVENT_ICONS: Record<AlertEvent, React.ReactNode> = {
  EXECUTION_FAILED:     <XCircle className="w-3.5 h-3.5 text-red-400" />,
  EXECUTION_SUCCEEDED:  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  EXECUTION_STARTED:    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />,
  TIMED_OUT:            <Clock className="w-3.5 h-3.5 text-orange-400" />,
  SLA_BREACHED:         <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  RETRY_EXHAUSTED:      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
  ROWS_BELOW_THRESHOLD: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  ROWS_ABOVE_THRESHOLD: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
};

const CHANNEL_COLORS: Record<AlertChannel, string> = {
  email:     'text-blue-300 bg-blue-900/30 border-blue-700',
  slack:     'text-purple-300 bg-purple-900/30 border-purple-700',
  webhook:   'text-amber-300 bg-amber-900/30 border-amber-700',
  pagerduty: 'text-red-300 bg-red-900/30 border-red-700',
};

export function PipelineAlertsSubTab({ pipelineId }: { pipelineId: string }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<AlertRule>>({
    name: '', enabled: true, event: 'EXECUTION_FAILED', channel: 'email', target: '',
  });

  const toEventTypeCode = (e: AlertEvent): string => {
    switch (e) {
      case 'EXECUTION_FAILED': return 'RUN_FAILURE';
      case 'EXECUTION_SUCCEEDED': return 'RUN_SUCCESS';
      case 'EXECUTION_STARTED': return 'RUN_START';
      case 'SLA_BREACHED': return 'SLA_VIOLATION';
      default: return 'RUN_FAILURE';
    }
  };

  const toChannelTypeCode = (c: AlertChannel): string => {
    switch (c) {
      case 'email': return 'EMAIL';
      case 'slack': return 'SLACK';
      case 'webhook': return 'WEBHOOK';
      case 'pagerduty': return 'PAGERDUTY';
    }
  };

  const fromEventTypeCode = (c: string): AlertEvent => {
    switch (String(c || '').toUpperCase()) {
      case 'RUN_SUCCESS': return 'EXECUTION_SUCCEEDED';
      case 'RUN_START': return 'EXECUTION_STARTED';
      case 'SLA_VIOLATION': return 'SLA_BREACHED';
      case 'RUN_FAILURE':
      default: return 'EXECUTION_FAILED';
    }
  };

  const fromChannelTypeCode = (c: string): AlertChannel => {
    switch (String(c || '').toUpperCase()) {
      case 'SLACK': return 'slack';
      case 'WEBHOOK': return 'webhook';
      case 'PAGERDUTY': return 'pagerduty';
      case 'EMAIL':
      default: return 'email';
    }
  };

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setIsLoading(true);
    setError(null);
    setBanner(null);
    try {
      const res = await api.getPipelineAlerts(pipelineId);
      const rows = (res.data as any)?.data ?? [];
      const mapped: AlertRule[] = (Array.isArray(rows) ? rows : []).map((r: any) => {
        const event = fromEventTypeCode(r.eventTypeCode);
        const channel = fromChannelTypeCode(r.channelTypeCode);
        const target = String(r.channelTargetText ?? '');
        return {
          id: String(r.id),
          name: `${EVENT_LABELS[event]} → ${channel}`,
          enabled: r.enabled === true,
          event,
          channel,
          target,
        };
      });
      setRules(mapped);
      if (mapped.length === 0) setBanner('No alert rules configured yet.');
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to load alert rules');
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (nextRules: AlertRule[]) => {
    if (!pipelineId) return;
    setIsSaving(true);
    setError(null);
    setBanner(null);
    try {
      await api.savePipelineAlerts(
        pipelineId,
        nextRules
          .filter(r => r.target?.trim())
          .map(r => ({
            id: r.id.startsWith('tmp-') ? undefined : r.id,
            eventTypeCode: toEventTypeCode(r.event),
            channelTypeCode: toChannelTypeCode(r.channel),
            channelTargetText: r.target.trim(),
            enabled: r.enabled,
          })),
      );
      setRules(nextRules);
      setBanner('Alert rules saved.');
      setShowAdd(false);
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to save alert rules');
    } finally {
      setIsSaving(false);
    }
  }, [pipelineId]);

  const toggleRule = (id: string) =>
    void save(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const deleteRule = (id: string) =>
    void save(rules.filter(r => r.id !== id));

  const addRule = () => {
    if (!newRule.name || !newRule.target) return;
    const tmp: AlertRule = { ...newRule, id: `tmp-${crypto.randomUUID()}` } as AlertRule;
    void save([...rules, tmp]);
    setNewRule({ name: '', enabled: true, event: 'EXECUTION_FAILED', channel: 'email', target: '' });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
        <Bell className="w-4 h-4 text-amber-400" />
        <span className="text-[12px] font-medium text-slate-300">Alert Rules</span>
        <span className="text-[11px] text-slate-600">· {rules.filter(r => r.enabled).length} active / {rules.length} total</span>
        <button onClick={load}
          disabled={isLoading || isSaving}
          className="ml-2 h-7 px-3 bg-slate-800/40 hover:bg-slate-700/40 text-slate-200 rounded text-[12px] transition-colors disabled:opacity-50">
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
        <button onClick={() => setShowAdd(v => !v)}
          disabled={isSaving}
          className="ml-auto flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors">
          <Plus className="w-3 h-3" /> Add Rule
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 border-b border-slate-800 bg-red-900/10 text-red-200 text-[12px]">
          {error}
        </div>
      )}
      {banner && !error && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/20 text-slate-300 text-[12px]">
          {banner}
        </div>
      )}

      {/* Add rule form */}
      {showAdd && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/30 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Rule Name *</label>
              <input value={newRule.name ?? ''} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))}
                className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Event</label>
              <select value={newRule.event} onChange={e => setNewRule(p => ({ ...p, event: e.target.value as AlertEvent }))}
                className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500">
                {(Object.keys(EVENT_LABELS) as AlertEvent[]).map(e => (
                  <option key={e} value={e}>{EVENT_LABELS[e]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Channel</label>
              <select value={newRule.channel} onChange={e => setNewRule(p => ({ ...p, channel: e.target.value as AlertChannel }))}
                className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500">
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="webhook">Webhook</option>
                <option value="pagerduty">PagerDuty</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Target *</label>
              <input value={newRule.target ?? ''} onChange={e => setNewRule(p => ({ ...p, target: e.target.value }))}
                placeholder={newRule.channel === 'email' ? 'email@example.com' : newRule.channel === 'slack' ? '#channel' : 'https://…'}
                className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRule}
              className="h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors">
              Add
            </button>
            <button onClick={() => setShowAdd(false)}
              className="h-7 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[12px] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="flex-1 overflow-auto p-4">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600">
            <BellOff className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No alert rules configured.</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {rules.map(rule => (
              <div key={rule.id}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors ${
                  rule.enabled ? 'border-slate-700 bg-slate-800/30' : 'border-slate-800 bg-slate-900/20 opacity-60'
                }`}>
                {/* Enable toggle */}
                <button onClick={() => toggleRule(rule.id)}
                  className={`flex-shrink-0 transition-colors ${rule.enabled ? 'text-emerald-400' : 'text-slate-600'}`}
                  title={rule.enabled ? 'Disable' : 'Enable'}>
                  {rule.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>

                {/* Event icon + name */}
                <div className="flex items-center gap-2 flex-shrink-0 min-w-[160px]">
                  {EVENT_ICONS[rule.event]}
                  <span className="text-[12px] font-medium text-slate-200">{rule.name}</span>
                </div>

                {/* Event */}
                <span className="text-[11px] text-slate-500 flex-1">{EVENT_LABELS[rule.event]}</span>

                {/* Channel */}
                <span className={`px-2 py-0.5 rounded border text-[11px] font-medium capitalize ${CHANNEL_COLORS[rule.channel]}`}>
                  {rule.channel}
                </span>

                {/* Target */}
                <span className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]" title={rule.target}>
                  {rule.target}
                </span>

                {/* Silence */}
                {rule.silenceMinutes && (
                  <span className="text-[10px] text-slate-600 whitespace-nowrap">Silence {rule.silenceMinutes}m</span>
                )}

                {/* Delete */}
                <button onClick={() => deleteRule(rule.id)}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-2 border-t border-slate-800 flex-shrink-0">
        <p className="text-[11px] text-slate-600">Alert delivery requires the notification backend to be configured. Contact your platform administrator.</p>
      </div>
    </div>
  );
}
