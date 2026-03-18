import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/components/common/Button';
import api from '@/services/api';
const STEP_ICON = {
    pending: '○', running: '◔', success: '✓', failed: '✗', skipped: '—',
};
const STEP_COLOR = {
    pending: 'text-neutral-400',
    running: 'text-primary-600 animate-pulse',
    success: 'text-success-600',
    failed: 'text-danger-600',
    skipped: 'text-neutral-400',
};
export function ExecutionSubTab({ pipelineId }) {
    const pipeline = useAppSelector(s => s.pipeline.activePipeline);
    const [runState, setRunState] = useState('idle');
    const [logs, setLogs] = useState([]);
    const [steps, setSteps] = useState([]);
    const [elapsed, setElapsed] = useState(0);
    const [environment, setEnvironment] = useState('development');
    const [technology, setTechnology] = useState('pyspark');
    const [activeRunId, setActiveRunId] = useState(null);
    const logRef = useRef(null);
    const timerRef = useRef(null);
    const pollRef = useRef(null);
    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
    }, [logs]);
    useEffect(() => {
        if (runState === 'running') {
            timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        }
        else {
            if (timerRef.current)
                clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current)
            clearInterval(timerRef.current); };
    }, [runState]);
    // Poll run status when we have an active run ID
    useEffect(() => {
        if (!activeRunId)
            return;
        pollRef.current = setInterval(async () => {
            try {
                const res = await api.getPipelineRunDetail(activeRunId);
                const detail = res.data.data ?? res.data;
                const status = detail.runStatus ?? detail.run_status_code;
                if (status === 'SUCCESS') {
                    setRunState('success');
                    setLogs(prev => [...prev, `[INFO] Run completed successfully.`]);
                    clearInterval(pollRef.current);
                    setActiveRunId(null);
                }
                else if (status === 'FAILED' || status === 'TIMED_OUT') {
                    setRunState('failed');
                    setLogs(prev => [...prev, `[ERROR] Run ${status.toLowerCase()}.`, detail.errorMessage ? `[ERROR] ${detail.errorMessage}` : ''].filter(Boolean));
                    clearInterval(pollRef.current);
                    setActiveRunId(null);
                }
                else if (status === 'CANCELLED') {
                    setRunState('failed');
                    setLogs(prev => [...prev, `[WARN] Run cancelled.`]);
                    clearInterval(pollRef.current);
                    setActiveRunId(null);
                }
            }
            catch { /* silently continue polling */ }
        }, 3000);
        return () => { if (pollRef.current)
            clearInterval(pollRef.current); };
    }, [activeRunId]);
    const startRun = async () => {
        if (!pipelineId)
            return;
        setRunState('running');
        setElapsed(0);
        setSteps([
            { name: 'Validate pipeline', status: 'running' },
            { name: 'Generate Spark code', status: 'pending' },
            { name: 'Submit to cluster', status: 'pending' },
            { name: 'Execute DAG', status: 'pending' },
            { name: 'Write sinks', status: 'pending' },
        ]);
        setLogs([`[INFO] Triggering pipeline run…`, `[INFO] Pipeline: ${pipeline?.name ?? pipelineId}`]);
        try {
            const res = await api.runPipeline(pipelineId, { environment, technology });
            const data = res.data.data ?? res.data;
            const runId = data.pipelineRunId ?? data.runId ?? data.id;
            setActiveRunId(runId);
            setLogs(prev => [...prev, `[INFO] Run submitted. Run ID: ${runId}`]);
            setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'success' } : i === 1 ? { ...s, status: 'running' } : s));
        }
        catch (err) {
            setRunState('failed');
            const msg = err?.response?.data?.userMessage ?? String(err);
            setLogs(prev => [...prev, `[ERROR] ${msg}`]);
            setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s));
        }
    };
    const stopRun = async () => {
        if (activeRunId) {
            try {
                await api.cancelPipelineRun(activeRunId);
            }
            catch { /* ignore */ }
        }
        setRunState('failed');
        setLogs(prev => [...prev, '[WARN] Run cancelled by user.']);
        setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed', duration: '—' }
            : s.status === 'pending' ? { ...s, status: 'skipped' }
                : s));
        setActiveRunId(null);
    };
    const fmtElapsed = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;
    return (_jsxs("div", { className: "flex-1 flex overflow-hidden", children: [_jsxs("div", { className: "w-72 flex-shrink-0 flex flex-col border-r border-neutral-200 overflow-hidden", children: [_jsxs("div", { className: "p-4 border-b border-neutral-200 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm font-medium text-neutral-700", children: "Run configuration" }), runState === 'running' && (_jsx("span", { className: "text-xs text-primary-600 font-mono", children: fmtElapsed(elapsed) }))] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-neutral-500", children: "Environment" }), _jsxs("select", { value: environment, onChange: e => setEnvironment(e.target.value), disabled: runState === 'running', className: "w-full mt-1 px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white", children: [_jsx("option", { value: "development", children: "Development" }), _jsx("option", { value: "staging", children: "Staging" }), _jsx("option", { value: "production", children: "Production" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-neutral-500", children: "Technology" }), _jsxs("select", { value: technology, onChange: e => setTechnology(e.target.value), disabled: runState === 'running', className: "w-full mt-1 px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white", children: [_jsx("option", { value: "pyspark", children: "PySpark 3.5" }), _jsx("option", { value: "scala", children: "Scala Spark 3.5" })] })] })] }), _jsx("div", { className: "flex gap-2", children: runState !== 'running' ? (_jsx(Button, { className: "flex-1", onClick: startRun, children: "\u25B6 Run" })) : (_jsx(Button, { className: "flex-1", variant: "ghost", onClick: stopRun, children: "\u23F9 Stop" })) }), (runState === 'success' || runState === 'failed') && (_jsx("div", { className: `text-xs text-center py-1 rounded ${runState === 'success' ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`, children: runState === 'success' ? `Completed in ${fmtElapsed(elapsed)}` : 'Run stopped or failed' }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [_jsx("div", { className: "text-xs font-medium text-neutral-500 mb-3 uppercase tracking-wide", children: "Steps" }), steps.length === 0 ? (_jsx("p", { className: "text-xs text-neutral-400", children: "Run a pipeline to see step progress." })) : (_jsx("div", { className: "space-y-2", children: steps.map((step, i) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-base w-4 text-center ${STEP_COLOR[step.status]}`, children: STEP_ICON[step.status] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-xs text-neutral-700 truncate", children: step.name }), step.duration && _jsx("div", { className: "text-xs text-neutral-400", children: step.duration })] })] }, i))) }))] })] }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden bg-neutral-950", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2 border-b border-neutral-800 flex-shrink-0", children: [_jsx("span", { className: "text-xs font-medium text-neutral-400 uppercase tracking-wide", children: "Execution log" }), _jsx("button", { onClick: () => setLogs([]), className: "text-xs text-neutral-500 hover:text-neutral-300", children: "Clear" })] }), _jsxs("div", { ref: logRef, className: "flex-1 overflow-y-auto p-4 font-mono text-xs text-neutral-200 space-y-0.5", children: [logs.length === 0 ? (_jsx("span", { className: "text-neutral-600", children: "Waiting for execution\u2026" })) : logs.map((line, i) => {
                                const color = line.startsWith('[ERROR]') || line.startsWith('[FATAL]') ? 'text-danger-400'
                                    : line.startsWith('[WARN]') ? 'text-warning-400'
                                        : 'text-neutral-200';
                                return _jsx("div", { className: color, children: line }, i);
                            }), runState === 'running' && _jsx("div", { className: "text-primary-400 animate-pulse", children: "\u258C" })] })] })] }));
}
