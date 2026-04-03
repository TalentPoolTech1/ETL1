/**
 * Pipeline > Validation sub-tab
 */
import React, { useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, RefreshCw, Download, Filter } from 'lucide-react';
import api from '@/services/api';

interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  ruleId: string;
  affectedNode?: string;
  message: string;
  suggestedFix?: string;
}

const SEV_CONFIG = {
  error:   { Icon: AlertCircle,   color: 'text-red-400',    bg: 'bg-red-900/20 border-red-700/50', label: 'Error' },
  warning: { Icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-900/20 border-amber-700/50', label: 'Warning' },
  info:    { Icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-900/20 border-blue-700/50', label: 'Info' },
};

export function PipelineValidationSubTab({ pipelineId }: { pipelineId: string }) {
  const [issues, setIssues]     = useState<ValidationIssue[]>([]);
  const [isRunning, setRunning] = useState(false);
  const [hasRun, setHasRun]     = useState(false);
  const [filter, setFilter]     = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const runValidation = useCallback(async () => {
    setRunning(true);
    try {
      const res = await api.validatePipeline(pipelineId);
      const d = res.data?.data ?? res.data;
      // API returns { valid, errors: [{code, message, nodeId?, severity?}], warnings: [{...}] }
      // Map to the ValidationIssue[] shape this component uses.
      const toIssues = (
        items: Array<{ code?: string; message?: string; nodeId?: string }>,
        severity: ValidationIssue['severity'],
      ): ValidationIssue[] =>
        (Array.isArray(items) ? items : []).map((item, idx) => ({
          id:           `${severity}-${idx}`,
          severity,
          ruleId:       item.code ?? `RULE-${idx}`,
          affectedNode: item.nodeId ?? undefined,
          message:      item.message ?? 'Unknown issue',
        }));

      const mapped: ValidationIssue[] = [
        ...toIssues(d?.errors   ?? [], 'error'),
        ...toIssues(d?.warnings ?? [], 'warning'),
      ];
      setIssues(mapped);
    } catch {
      setIssues([{ id: '1', severity: 'error', ruleId: 'SYS-001', message: 'Validation service unavailable.' }]);
    } finally {
      setRunning(false);
      setHasRun(true);
    }
  }, [pipelineId]);

  const filtered = filter === 'all' ? issues : issues.filter(i => i.severity === filter);
  const counts = { error: issues.filter(i => i.severity === 'error').length, warning: issues.filter(i => i.severity === 'warning').length, info: issues.filter(i => i.severity === 'info').length };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
        <button onClick={runValidation} disabled={isRunning}
          className="flex items-center gap-1.5 h-7 px-3 bg-violet-700 hover:bg-violet-600 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-60">
          {isRunning ? <><RefreshCw className="w-3 h-3 animate-spin" /> Validating…</> : <><RefreshCw className="w-3 h-3" /> Validate</>}
        </button>

        {hasRun && (
          <>
            <div className="flex items-center gap-2 text-[12px]">
              {counts.error > 0 && <span className="text-red-400 font-medium">{counts.error} errors</span>}
              {counts.warning > 0 && <span className="text-amber-400 font-medium">{counts.warning} warnings</span>}
              {counts.info > 0 && <span className="text-blue-400">{counts.info} info</span>}
              {issues.length === 0 && <span className="text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> All checks passed</span>}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Filter className="w-3.5 h-3.5 text-slate-300" />
              {(['all', 'error', 'warning', 'info'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`h-6 px-2 rounded text-[12px] transition-colors capitalize ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-slate-300 hover:bg-slate-700'}`}>
                  {f}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {!hasRun && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <AlertCircle className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Click "Validate" to check the pipeline for issues.</p>
          </div>
        )}
        {hasRun && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-emerald-500">
            <CheckCircle2 className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium">No {filter !== 'all' ? filter + 's' : 'issues'} found.</p>
          </div>
        )}
        {filtered.map(issue => {
          const cfg = SEV_CONFIG[issue.severity];
          return (
            <div key={issue.id} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg}`}>
              <cfg.Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-slate-400 font-mono">{issue.ruleId}</span>
                  {issue.affectedNode && <span className="text-slate-300">· {issue.affectedNode}</span>}
                </div>
                <p className="text-[12px] text-slate-300 mt-0.5">{issue.message}</p>
                {issue.suggestedFix && (
                  <p className="text-[12px] text-slate-300 mt-1">💡 {issue.suggestedFix}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
