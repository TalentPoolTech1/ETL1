import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';
import { Button } from '@/components/common/Button';
import api from '@/services/api';
const STATUS_COLOR = {
    PENDING: 'bg-neutral-100 text-neutral-600',
    QUEUED: 'bg-blue-100 text-blue-700',
    RUNNING: 'bg-blue-100 text-blue-800',
    SUCCESS: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-orange-100 text-orange-700',
    SKIPPED: 'bg-neutral-100 text-neutral-500',
    RETRYING: 'bg-yellow-100 text-yellow-700',
    TIMED_OUT: 'bg-red-200 text-red-900',
    PARTIALLY_COMPLETED: 'bg-amber-100 text-amber-700',
};
function fmtDuration(ms) {
    if (ms === null)
        return '—';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
function fmtDatetime(iso) {
    if (!iso)
        return '—';
    return new Date(iso).toLocaleString();
}
export function OverviewSubTab({ pipelineId }) {
    const dispatch = useAppDispatch();
    const pipeline = useAppSelector(s => s.pipeline.activePipeline);
    const nodes = useAppSelector(s => s.pipeline.nodes);
    const [runs, setRuns] = useState([]);
    const [loadingRuns, setLoadingRuns] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [draftDesc, setDraftDesc] = useState('');
    const loadRuns = useCallback(async () => {
        if (!pipelineId)
            return;
        setLoadingRuns(true);
        try {
            const res = await api.getPipelineRuns({ pipelineId, pageSize: 5 });
            const data = res.data.data ?? res.data;
            setRuns(data.items ?? data ?? []);
        }
        catch {
            /* silently degrade — pipeline may have no runs yet */
        }
        finally {
            setLoadingRuns(false);
        }
    }, [pipelineId]);
    useEffect(() => { loadRuns(); }, [loadRuns]);
    const handleRun = async () => {
        if (!pipelineId)
            return;
        try {
            await api.runPipeline(pipelineId);
            setTimeout(loadRuns, 1500);
        }
        catch (err) {
            alert(err?.response?.data?.userMessage ?? 'Failed to trigger run');
        }
    };
    if (!pipeline) {
        return _jsx("div", { className: "flex-1 flex items-center justify-center text-neutral-400 text-sm", children: "Loading pipeline\u2026" });
    }
    const nodeCount = Object.keys(nodes).length;
    const successCount = runs.filter(r => r.runStatus === 'SUCCESS').length;
    const successRate = runs.length ? Math.round((successCount / runs.length) * 100) : '—';
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsx("div", { className: "flex-1 min-w-0", children: editing ? (_jsxs("div", { className: "space-y-2", children: [_jsx("input", { value: draftName, onChange: e => setDraftName(e.target.value), className: "w-full px-3 py-2 border border-neutral-300 rounded-md text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500" }), _jsx("textarea", { value: draftDesc, onChange: e => setDraftDesc(e.target.value), rows: 2, className: "w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", onClick: () => setEditing(false), children: "Save" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setEditing(false), children: "Cancel" })] })] })) : (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h2", { className: "text-xl font-semibold text-neutral-900 truncate", children: pipeline.name }), _jsx("button", { onClick: () => { setDraftName(pipeline.name); setDraftDesc(pipeline.description); setEditing(true); }, className: "text-neutral-400 hover:text-neutral-600 text-xs", children: "\u270E" })] }), _jsx("p", { className: "text-sm text-neutral-500 mt-0.5", children: pipeline.description || _jsx("span", { className: "italic", children: "No description" }) })] })) }), _jsxs("div", { className: "flex gap-2 flex-shrink-0", children: [_jsx(Button, { size: "sm", onClick: handleRun, children: "\u25B6 Run" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Schedule" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Clone" })] })] }), _jsx("div", { className: "grid grid-cols-4 gap-4", children: [
                    { label: 'Nodes', value: nodeCount },
                    { label: 'Success rate', value: `${successRate}%` },
                    { label: 'Last run', value: runs[0] ? fmtDatetime(runs[0].startDtm) : '—' },
                    { label: 'Version', value: `v${pipeline.version}` },
                ].map(stat => (_jsxs("div", { className: "bg-neutral-50 border border-neutral-200 rounded-lg p-4", children: [_jsx("div", { className: "text-2xl font-bold text-neutral-900", children: stat.value }), _jsx("div", { className: "text-xs text-neutral-500 mt-1", children: stat.label })] }, stat.label))) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-700 mb-3", children: "Recent runs" }), _jsx("div", { className: "border border-neutral-200 rounded-lg overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-neutral-50", children: _jsx("tr", { children: ['Run ID', 'Started', 'Duration', 'Status', 'Triggered by'].map(h => (_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-neutral-500", children: h }, h))) }) }), _jsxs("tbody", { className: "divide-y divide-neutral-100", children: [loadingRuns && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-4 text-center text-neutral-400 text-xs", children: "Loading\u2026" }) })), !loadingRuns && runs.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-4 py-6 text-center text-neutral-400 text-sm", children: "No runs yet." }) })), runs.map(run => (_jsxs("tr", { className: "hover:bg-neutral-50 cursor-pointer", onClick: () => dispatch(openTab({
                                                id: `execution-${run.pipelineRunId}`,
                                                type: 'execution',
                                                objectId: run.pipelineRunId,
                                                objectName: `Run: ${run.pipelineName}`,
                                                unsaved: false, isDirty: false, executionKind: 'pipeline',
                                            })), children: [_jsxs("td", { className: "px-4 py-2 font-mono text-xs text-primary-600", children: [run.pipelineRunId.slice(0, 8), "\u2026"] }), _jsx("td", { className: "px-4 py-2 text-neutral-600", children: fmtDatetime(run.startDtm) }), _jsx("td", { className: "px-4 py-2 text-neutral-600", children: fmtDuration(run.durationMs) }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[run.runStatus]}`, children: run.runStatus }) }), _jsx("td", { className: "px-4 py-2 text-neutral-500 capitalize", children: run.triggerType })] }, run.pipelineRunId)))] })] }) })] })] }));
}
