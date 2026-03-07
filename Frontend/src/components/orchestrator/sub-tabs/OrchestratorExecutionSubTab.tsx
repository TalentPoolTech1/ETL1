import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/common/Button';

type RunState = 'idle' | 'running' | 'success' | 'failed';

interface StepProgress {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: string;
}

const STEP_ICON: Record<StepProgress['status'], string> = {
  pending: '○',
  running: '◔',
  success: '✓',
  failed:  '✗',
  skipped: '—',
};
const STEP_COLOR: Record<StepProgress['status'], string> = {
  pending: 'text-neutral-400',
  running: 'text-primary-600 animate-pulse',
  success: 'text-success-600',
  failed:  'text-danger-600',
  skipped: 'text-neutral-400',
};

export function OrchestratorExecutionSubTab() {
  const [runState, setRunState] = useState<RunState>('idle');
  const [logs, setLogs]         = useState<string[]>([]);
  const [steps, setSteps]       = useState<StepProgress[]>([]);
  const [elapsed, setElapsed]   = useState(0);
  const logRef  = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (runState === 'running') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [runState]);

  const startRun = () => {
    setRunState('running');
    setElapsed(0);
    const initialSteps: StepProgress[] = [
      { name: 'Validate orchestrator',    status: 'pending' },
      { name: 'ingest-customers',         status: 'pending' },
      { name: 'transform-orders',         status: 'pending' },
      { name: 'aggregate-daily-kpis',     status: 'pending' },
      { name: 'load-data-warehouse',      status: 'pending' },
    ];
    setSteps(initialSteps);
    setLogs(['[INFO] Starting orchestrator run…', '[INFO] Orchestrator: daily-etl-orchestrator']);

    const delays   = [600, 1800, 3800, 6200, 9500];
    const messages = [
      ['[INFO] Orchestrator validation passed. 4 pipelines scheduled.'],
      ['[INFO] Pipeline ingest-customers started.', '[INFO] JDBC source: 12,400 rows ingested.', '[INFO] Pipeline ingest-customers completed in 1.8s.'],
      ['[INFO] Pipeline transform-orders started.', '[INFO] Join applied: orders × customers.', '[INFO] Pipeline transform-orders completed in 2.1s.'],
      ['[INFO] Pipeline aggregate-daily-kpis started.', '[INFO] Aggregated 3 KPI groups.', '[INFO] Pipeline aggregate-daily-kpis completed in 2.5s.'],
      ['[INFO] Pipeline load-data-warehouse started.', '[INFO] Delta sink write: /data/warehouse/daily', '[INFO] Pipeline load-data-warehouse completed in 3.0s.', '[INFO] Orchestrator run completed successfully.'],
    ];

    delays.forEach((delay, idx) => {
      setTimeout(() => {
        setSteps(prev => prev.map((s, i) => {
          if (i === idx)     return { ...s, status: 'success', duration: `${(Math.random() * 2 + 0.5).toFixed(1)}s` };
          if (i === idx + 1) return { ...s, status: 'running' };
          return s;
        }));
        setLogs(prev => [...prev, ...(messages[idx] ?? [])]);
        if (idx === delays.length - 1) {
          setTimeout(() => setRunState('success'), 300);
        }
      }, delay);
    });
  };

  const stopRun = () => {
    setRunState('failed');
    setLogs(prev => [...prev, '[WARN] Orchestrator run cancelled by user.']);
    setSteps(prev => prev.map(s =>
      s.status === 'running' ? { ...s, status: 'failed', duration: '—' }
      : s.status === 'pending' ? { ...s, status: 'skipped' }
      : s
    ));
  };

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: config + step timeline */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-neutral-200 overflow-hidden">
        {/* Run controls */}
        <div className="p-4 border-b border-neutral-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700">Run configuration</span>
            {runState === 'running' && (
              <span className="text-xs text-primary-600 font-mono">{fmtElapsed(elapsed)}</span>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-neutral-500">Environment</label>
              <select disabled={runState === 'running'} className="w-full mt-1 px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white">
                <option>Development</option>
                <option>Staging</option>
                <option>Production</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Concurrency</label>
              <select disabled={runState === 'running'} className="w-full mt-1 px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white">
                <option>Sequential</option>
                <option>Parallel (max 4)</option>
                <option>Parallel (unlimited)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            {runState !== 'running' ? (
              <Button className="flex-1" onClick={startRun}>
                ▶ Run
              </Button>
            ) : (
              <Button className="flex-1" variant="ghost" onClick={stopRun}>
                ⏹ Stop
              </Button>
            )}
          </div>

          {(runState === 'success' || runState === 'failed') && (
            <div className={`text-xs text-center py-1 rounded ${runState === 'success' ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
              {runState === 'success' ? `Completed in ${fmtElapsed(elapsed)}` : 'Run stopped'}
            </div>
          )}
        </div>

        {/* Step timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-xs font-medium text-neutral-500 mb-3 uppercase tracking-wide">Pipelines</div>
          {steps.length === 0 ? (
            <p className="text-xs text-neutral-400">Run the orchestrator to see pipeline progress.</p>
          ) : (
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-base w-4 text-center ${STEP_COLOR[step.status]}`}>{STEP_ICON[step.status]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-neutral-700 truncate">{step.name}</div>
                    {step.duration && (
                      <div className="text-xs text-neutral-400">{step.duration}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: live log console */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 flex-shrink-0">
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Execution log</span>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Clear
          </button>
        </div>
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs text-neutral-200 space-y-0.5"
        >
          {logs.length === 0 ? (
            <span className="text-neutral-600">Waiting for execution…</span>
          ) : logs.map((line, i) => {
            const color = line.startsWith('[ERROR]') || line.startsWith('[FATAL]') ? 'text-danger-400'
              : line.startsWith('[WARN]')  ? 'text-warning-400'
              : line.startsWith('[INFO]')  ? 'text-neutral-200'
              : 'text-neutral-400';
            return <div key={i} className={color}>{line}</div>;
          })}
          {runState === 'running' && (
            <div className="text-primary-400 animate-pulse">▌</div>
          )}
        </div>
      </div>
    </div>
  );
}
