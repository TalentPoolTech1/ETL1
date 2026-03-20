import React, { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '@/store/hooks';
import api from '@/services/api';

type RunState = 'idle' | 'running' | 'success' | 'failed';

interface StepProgress {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: string;
}


interface Props { pipelineId: string; }

export function ExecutionSubTab({ pipelineId }: Props) {
  const pipeline = useAppSelector(s => s.pipeline.activePipeline);
  const [runState, setRunState]   = useState<RunState>('idle');
  const [logs, setLogs]           = useState<string[]>([]);
  const [steps, setSteps]         = useState<StepProgress[]>([]);
  const [elapsed, setElapsed]     = useState(0);
  const [environment, setEnvironment] = useState('development');
  const [technology, setTechnology]   = useState('pyspark');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Poll run status when we have an active run ID
  useEffect(() => {
    if (!activeRunId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.getPipelineRunDetail(activeRunId);
        const detail = res.data.data ?? res.data;
        const status: string = detail.runStatus ?? detail.run_status_code;

        if (status === 'SUCCESS') {
          setRunState('success');
          setLogs(prev => [...prev, `[INFO] Run completed successfully.`]);
          clearInterval(pollRef.current!);
          setActiveRunId(null);
        } else if (status === 'FAILED' || status === 'TIMED_OUT') {
          setRunState('failed');
          setLogs(prev => [...prev, `[ERROR] Run ${status.toLowerCase()}.`, detail.errorMessage ? `[ERROR] ${detail.errorMessage}` : ''].filter(Boolean));
          clearInterval(pollRef.current!);
          setActiveRunId(null);
        } else if (status === 'CANCELLED') {
          setRunState('failed');
          setLogs(prev => [...prev, `[WARN] Run cancelled.`]);
          clearInterval(pollRef.current!);
          setActiveRunId(null);
        }
      } catch { /* silently continue polling */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRunId]);

  const startRun = async () => {
    if (!pipelineId) return;
    setRunState('running');
    setElapsed(0);
    setSteps([
      { name: 'Validate pipeline',    status: 'running' },
      { name: 'Generate Spark code',  status: 'pending' },
      { name: 'Submit to cluster',    status: 'pending' },
      { name: 'Execute DAG',          status: 'pending' },
      { name: 'Write sinks',          status: 'pending' },
    ]);
    setLogs([`[INFO] Triggering pipeline run…`, `[INFO] Pipeline: ${pipeline?.name ?? pipelineId}`]);

    try {
      const res = await api.runPipeline(pipelineId, { environment, technology });
      const data = res.data.data ?? res.data;
      const runId: string = data.pipelineRunId ?? data.runId ?? data.id;
      setActiveRunId(runId);
      setLogs(prev => [...prev, `[INFO] Run submitted. Run ID: ${runId}`]);
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'success' } : i === 1 ? { ...s, status: 'running' } : s));
    } catch (err: unknown) {
      setRunState('failed');
      const msg = (err as any)?.response?.data?.userMessage ?? String(err);
      setLogs(prev => [...prev, `[ERROR] ${msg}`]);
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s));
    }
  };

  const stopRun = async () => {
    if (activeRunId) {
      try { await api.cancelPipelineRun(activeRunId); } catch { /* ignore */ }
    }
    setRunState('failed');
    setLogs(prev => [...prev, '[WARN] Run cancelled by user.']);
    setSteps(prev => prev.map(s =>
      s.status === 'running' ? { ...s, status: 'failed', duration: '—' }
      : s.status === 'pending' ? { ...s, status: 'skipped' }
      : s
    ));
    setActiveRunId(null);
  };

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0d0f1a]">
      {/* Left: config + step timeline */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-800 overflow-hidden bg-[#111320]">
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-200">Run Configuration</span>
            {runState === 'running' && (
              <span className="text-[12px] text-blue-400 font-mono">{fmtElapsed(elapsed)}</span>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-slate-500">Environment</label>
              <select value={environment} onChange={e => setEnvironment(e.target.value)}
                disabled={runState === 'running'}
                className="w-full mt-1 px-2 py-1.5 bg-[#1e2035] border border-slate-600 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50">
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Technology</label>
              <select value={technology} onChange={e => setTechnology(e.target.value)}
                disabled={runState === 'running'}
                className="w-full mt-1 px-2 py-1.5 bg-[#1e2035] border border-slate-600 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50">
                <option value="pyspark">PySpark 3.5</option>
                <option value="scala">Scala Spark 3.5</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            {runState !== 'running' ? (
              <button onClick={startRun}
                className="flex-1 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5">
                ▶ Run Pipeline
              </button>
            ) : (
              <button onClick={stopRun}
                className="flex-1 h-8 bg-red-700 hover:bg-red-600 text-white rounded text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5">
                ⏹ Stop
              </button>
            )}
          </div>

          {runState === 'success' && (
            <div className="text-[12px] text-center py-1.5 rounded bg-emerald-900/40 border border-emerald-800 text-emerald-300">
              ✓ Completed in {fmtElapsed(elapsed)}
            </div>
          )}
          {runState === 'failed' && (
            <div className="text-[12px] text-center py-1.5 rounded bg-red-900/40 border border-red-800 text-red-300">
              ✗ Run stopped or failed
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[10px] font-semibold text-slate-600 mb-3 uppercase tracking-widest">Pipeline Steps</div>
          {steps.length === 0 ? (
            <p className="text-[12px] text-slate-600 italic">Run a pipeline to see step progress.</p>
          ) : (
            <div className="space-y-2">
              {steps.map((step, i) => {
                const dotCls =
                  step.status === 'success' ? 'bg-emerald-400' :
                  step.status === 'failed'  ? 'bg-red-400' :
                  step.status === 'running' ? 'bg-blue-400 animate-pulse' :
                  step.status === 'skipped' ? 'bg-slate-600' :
                  'bg-slate-700';
                const textCls =
                  step.status === 'success' ? 'text-emerald-300' :
                  step.status === 'failed'  ? 'text-red-300' :
                  step.status === 'running' ? 'text-blue-300' :
                  'text-slate-500';
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] truncate ${textCls}`}>{step.name}</div>
                      {step.duration && <div className="text-[11px] text-slate-600">{step.duration}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: live log console */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#070910]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 flex-shrink-0 bg-[#0d0f1a]">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Execution Log</span>
          <button onClick={() => setLogs([])} className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">Clear</button>
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto p-4 font-mono text-[12px] space-y-0.5">
          {logs.length === 0 ? (
            <span className="text-slate-700">Waiting for execution…</span>
          ) : logs.map((line, i) => {
            const color = line.startsWith('[ERROR]') || line.startsWith('[FATAL]') ? 'text-red-400'
              : line.startsWith('[WARN]') ? 'text-amber-400'
              : line.startsWith('[INFO]') ? 'text-slate-300'
              : 'text-slate-400';
            return <div key={i} className={`leading-5 ${color}`}>{line}</div>;
          })}
          {runState === 'running' && <div className="text-blue-400 animate-pulse">▌</div>}
        </div>
      </div>
    </div>
  );
}
