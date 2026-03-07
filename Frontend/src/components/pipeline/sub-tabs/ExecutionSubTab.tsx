import React, { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '@/store/hooks';
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

export function ExecutionSubTab() {
  const pipeline = useAppSelector(s => s.pipeline.activePipeline);
  const [runState, setRunState]   = useState<RunState>('idle');
  const [logs, setLogs]           = useState<string[]>([]);
  const [steps, setSteps]         = useState<StepProgress[]>([]);
  const [elapsed, setElapsed]     = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll logs to bottom on update
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  // Timer
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
      { name: 'Validate pipeline',   status: 'pending' },
      { name: 'Generate PySpark code', status: 'pending' },
      { name: 'Submit to cluster',   status: 'pending' },
      { name: 'Execute DAG',         status: 'pending' },
      { name: 'Write sinks',         status: 'pending' },
    ];
    setSteps(initialSteps);
    setLogs(['[INFO] Starting pipeline execution…', `[INFO] Pipeline: ${pipeline?.name ?? 'unknown'}`]);

    // Simulate step progression
    const delays = [500, 1200, 2000, 3500, 5500];
    const messages = [
      ['[INFO] Pipeline validation passed.'],
      ['[INFO] Code generation complete (47 lines).', '[INFO] Technology: PySpark 3.5'],
      ['[INFO] Submitting job to Spark cluster…', '[INFO] Job ID: spark-20260302-14220-001'],
      ['[INFO] DAG execution started.', '[INFO] Source: customer_jdbc_source → 12,400 rows.', '[INFO] Transform: clean_names → 12,400 rows out.'],
      ['[INFO] Writing to delta sink: /data/customers_clean', '[INFO] Write complete. 12,400 rows written.', '[INFO] Execution finished successfully.'],
    ];

    delays.forEach((delay, idx) => {
      setTimeout(() => {
        setSteps(prev => prev.map((s, i) => {
          if (i === idx)     return { ...s, status: 'success', duration: `${(Math.random() * 1.2 + 0.3).toFixed(1)}s` };
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
    setLogs(prev => [...prev, '[WARN] Run cancelled by user.']);
    setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed', duration: '—' } : s.status === 'pending' ? { ...s, status: 'skipped' } : s));
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
              <label className="text-xs text-neutral-500">Technology</label>
              <select disabled={runState === 'running'} className="w-full mt-1 px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white">
                <option>PySpark 3.5</option>
                <option>Scala Spark 3.5</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            {runState !== 'running' ? (
              <Button className="flex-1" onClick={startRun} disabled={runState === 'running'}>
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
          <div className="text-xs font-medium text-neutral-500 mb-3 uppercase tracking-wide">Steps</div>
          {steps.length === 0 ? (
            <p className="text-xs text-neutral-400">Run a pipeline to see step progress.</p>
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
