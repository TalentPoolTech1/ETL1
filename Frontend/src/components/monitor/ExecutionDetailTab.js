import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * ExecutionDetailTab — full v2 spec compliant
 * Sub-tabs: Summary | Steps | Logs | Code | Metrics
 * Dark theme, log search + download, real-time auto-refresh
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { RefreshCw, Download, Search, Copy, CheckCircle2, XCircle, Activity, BarChart3, Code2, FileText, RotateCcw, ExternalLink, } from 'lucide-react';
import api from '@/services/api';
// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
    PENDING: { label: 'Pending', dot: 'bg-slate-500', text: 'text-slate-300', bg: 'bg-slate-800/60 border-slate-700' },
    QUEUED: { label: 'Queued', dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-900/30 border-blue-800' },
    RUNNING: { label: 'Running', dot: 'bg-blue-400 animate-pulse', text: 'text-blue-300', bg: 'bg-blue-900/30 border-blue-800' },
    SUCCESS: { label: 'Success', dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-900/30 border-emerald-800' },
    FAILED: { label: 'Failed', dot: 'bg-red-400', text: 'text-red-300', bg: 'bg-red-900/30 border-red-800' },
    CANCELLED: { label: 'Cancelled', dot: 'bg-orange-400', text: 'text-orange-300', bg: 'bg-orange-900/30 border-orange-800' },
    SKIPPED: { label: 'Skipped', dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-800/40 border-slate-700' },
    RETRYING: { label: 'Retrying', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300', bg: 'bg-amber-900/30 border-amber-800' },
    TIMED_OUT: { label: 'Timed Out', dot: 'bg-red-500', text: 'text-red-300', bg: 'bg-red-900/40 border-red-800' },
    PARTIALLY_COMPLETED: { label: 'Partial', dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-900/30 border-amber-800' },
};
function StatusBadge({ status }) {
    const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
    return (_jsxs("span", { className: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[12px] font-medium ${cfg.text} ${cfg.bg}`, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}` }), cfg.label] }));
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDur(ms) {
    if (ms === null)
        return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60)
        return `${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtDt(iso) {
    if (!iso)
        return '—';
    return new Date(iso).toLocaleString();
}
function fmtBytes(b) {
    if (b === null)
        return '—';
    if (b >= 1073741824)
        return `${(b / 1073741824).toFixed(1)} GB`;
    if (b >= 1048576)
        return `${(b / 1048576).toFixed(1)} MB`;
    if (b >= 1024)
        return `${(b / 1024).toFixed(1)} KB`;
    return `${b} B`;
}
// ─── Metric card ─────────────────────────────────────────────────────────────
function Metric({ label, value }) {
    return (_jsxs("div", { className: "bg-slate-800/40 border border-slate-700 rounded-lg p-3", children: [_jsx("div", { className: "text-[10px] text-slate-500 mb-1", children: label }), _jsx("div", { className: "text-[14px] font-semibold text-slate-100", children: value ?? '—' })] }));
}
// ─── Node timeline ────────────────────────────────────────────────────────────
function NodeTimeline({ nodes }) {
    if (!nodes.length)
        return _jsx("div", { className: "text-sm text-slate-500 py-4", children: "No node-level data available." });
    const maxDur = Math.max(...nodes.map(n => n.durationMs ?? 0), 1);
    const barCls = (s) => s === 'SUCCESS' ? 'bg-emerald-600' : s === 'FAILED' ? 'bg-red-600' : s === 'RUNNING' ? 'bg-blue-500' : 'bg-slate-600';
    return (_jsx("div", { className: "space-y-1.5", children: nodes.map(node => {
            const pct = Math.max(2, ((node.durationMs ?? 0) / maxDur) * 100);
            return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-48 text-[11px] text-slate-400 truncate font-mono", title: node.nodeDisplayName, children: node.nodeDisplayName || node.nodeIdInIrText }), _jsxs("div", { className: "flex-1 bg-slate-800 rounded h-5 overflow-hidden relative", children: [_jsx("div", { className: `h-full ${barCls(node.runStatus)} rounded transition-all`, style: { width: `${pct}%` } }), _jsx("span", { className: "absolute inset-0 flex items-center px-2 text-[11px] font-medium text-slate-200", children: fmtDur(node.durationMs) })] }), _jsx(StatusBadge, { status: node.runStatus }), _jsx("div", { className: "w-20 text-right text-[11px] text-slate-500", children: node.rowsOut !== null ? `${node.rowsOut.toLocaleString()} rows` : '—' })] }, node.nodeRunId));
        }) }));
}
function LogViewer({ runId, autoRefresh }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [levelFilter, setLevel] = useState('');
    const [copied, setCopied] = useState(false);
    const bottomRef = useRef(null);
    const fetchLogs = useCallback(async () => {
        try {
            const res = await api.getPipelineRunLogs(runId, { limit: 1000 });
            setLogs(res.data.data ?? []);
        }
        catch { /* silently degrade */ }
        finally {
            setLoading(false);
        }
    }, [runId]);
    useEffect(() => { fetchLogs(); }, [fetchLogs]);
    useEffect(() => {
        if (!autoRefresh)
            return;
        const t = setInterval(fetchLogs, 5000);
        return () => clearInterval(t);
    }, [autoRefresh, fetchLogs]);
    useEffect(() => {
        if (!search && !levelFilter)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs, search, levelFilter]);
    const filtered = logs.filter(l => {
        const matchLevel = !levelFilter || l.logLevel === levelFilter;
        const matchSearch = !search || l.logMessage.toLowerCase().includes(search.toLowerCase());
        return matchLevel && matchSearch;
    });
    const levelCls = (level) => {
        switch (level) {
            case 'ERROR':
            case 'FATAL': return 'text-red-400';
            case 'WARN': return 'text-amber-400';
            case 'INFO': return 'text-emerald-400';
            case 'DEBUG':
            case 'TRACE': return 'text-slate-500';
            default: return 'text-slate-400';
        }
    };
    const downloadLogs = () => {
        const text = filtered.map(l => `${l.logDtm} [${l.logLevel}] ${l.nodeId ? `[${l.nodeId}] ` : ''}${l.logMessage}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `run_${runId}_logs.txt`;
        a.click();
    };
    const copyLogs = async () => {
        await navigator.clipboard.writeText(filtered.map(l => `${l.logDtm} [${l.logLevel}] ${l.logMessage}`).join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const uniqueLevels = [...new Set(logs.map(l => l.logLevel))].sort();
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2 flex-shrink-0", children: [_jsxs("div", { className: "relative flex-1 max-w-xs", children: [_jsx(Search, { className: "absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" }), _jsx("input", { value: search, onChange: e => setSearch(e.target.value), placeholder: "Search logs\u2026", className: "w-full h-7 pl-7 pr-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-600" })] }), _jsxs("select", { value: levelFilter, onChange: e => setLevel(e.target.value), className: "h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 outline-none focus:border-blue-600", children: [_jsx("option", { value: "", children: "All levels" }), uniqueLevels.map(l => _jsx("option", { value: l, children: l }, l))] }), _jsxs("span", { className: "text-[11px] text-slate-600", children: [filtered.length, " lines"] }), _jsx("div", { className: "flex-1" }), _jsx("button", { onClick: fetchLogs, className: "flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", children: _jsx(RefreshCw, { className: "w-3 h-3" }) }), _jsx("button", { onClick: copyLogs, className: "flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", children: copied ? _jsxs(_Fragment, { children: [_jsx(CheckCircle2, { className: "w-3 h-3 text-emerald-400" }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3 h-3" }), " Copy"] }) }), _jsxs("button", { onClick: downloadLogs, className: "flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", children: [_jsx(Download, { className: "w-3 h-3" }), " Download"] })] }), _jsxs("div", { className: "flex-1 overflow-auto bg-[#070910] border border-slate-800 rounded-lg p-3 font-mono text-[12px] min-h-0", children: [loading && _jsx("div", { className: "text-slate-600", children: "Loading logs\u2026" }), !loading && filtered.length === 0 && _jsx("div", { className: "text-slate-600", children: "No log entries found." }), filtered.map((entry, i) => (_jsxs("div", { className: "flex gap-2 leading-5 hover:bg-slate-900/40 px-1 rounded", children: [_jsx("span", { className: "text-slate-600 shrink-0 select-none", children: new Date(entry.logDtm).toLocaleTimeString() }), _jsx("span", { className: `shrink-0 w-11 font-medium ${levelCls(entry.logLevel)}`, children: entry.logLevel }), entry.nodeId && _jsxs("span", { className: "text-slate-600 shrink-0", children: ["[", entry.nodeId.slice(0, 8), "]"] }), _jsx("span", { className: "text-slate-300 break-all", children: entry.logMessage })] }, i))), _jsx("div", { ref: bottomRef })] })] }));
}
export function ExecutionDetailTab({ runId, executionKind }) {
    const [detail, setDetail] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [subTab, setSubTab] = useState('summary');
    const [autoRefresh, setAuto] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const isRunning = detail?.runStatus === 'RUNNING' || detail?.runStatus === 'RETRYING';
    const fetchDetail = useCallback(async () => {
        try {
            if (executionKind === 'pipeline') {
                const [detRes, nodeRes] = await Promise.allSettled([
                    api.getPipelineRunDetail(runId),
                    api.getPipelineRunNodes(runId),
                ]);
                if (detRes.status === 'fulfilled')
                    setDetail(detRes.value.data.data ?? detRes.value.data);
                if (nodeRes.status === 'fulfilled')
                    setNodes(nodeRes.value.data.data ?? []);
            }
            else {
                const res = await api.getOrchestratorRunDetail(runId);
                setDetail(res.data.data ?? res.data);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load execution details');
        }
        finally {
            setLoading(false);
        }
    }, [runId, executionKind]);
    useEffect(() => { fetchDetail(); }, [fetchDetail]);
    useEffect(() => {
        if (!autoRefresh || !isRunning)
            return;
        const t = setInterval(fetchDetail, 5000);
        return () => clearInterval(t);
    }, [autoRefresh, isRunning, fetchDetail]);
    const SUB_TABS = [
        { key: 'summary', label: 'Summary', Icon: FileText },
        { key: 'steps', label: 'Steps', Icon: Activity },
        { key: 'logs', label: 'Logs', Icon: FileText },
        { key: 'code', label: 'Code', Icon: Code2 },
        { key: 'metrics', label: 'Metrics', Icon: BarChart3 },
    ];
    if (loading)
        return (_jsx("div", { className: "flex-1 flex items-center justify-center bg-[#0d0f1a] text-slate-400 text-sm", children: "Loading execution details\u2026" }));
    if (error || !detail)
        return (_jsx("div", { className: "flex-1 flex items-center justify-center bg-[#0d0f1a]", children: _jsxs("div", { className: "bg-red-950/50 border border-red-800 rounded-lg p-6 max-w-sm text-center", children: [_jsx("div", { className: "text-red-400 font-medium mb-1", children: "Could not load execution" }), _jsx("div", { className: "text-sm text-red-500/80", children: error ?? 'Unknown error' }), _jsx("button", { onClick: fetchDetail, className: "mt-4 px-4 py-1.5 bg-red-700 text-white text-sm rounded hover:bg-red-600 transition-colors", children: "Retry" })] }) }));
    return (_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden bg-[#0d0f1a]", children: [_jsx("div", { className: "px-5 pt-4 pb-3 border-b border-slate-800 flex-shrink-0", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h1", { className: "text-[16px] font-semibold text-slate-100", children: detail.pipelineName }), _jsx(StatusBadge, { status: detail.runStatus })] }), _jsxs("div", { className: "text-[11px] text-slate-500 mt-1", children: [executionKind === 'pipeline' ? 'Pipeline' : 'Orchestrator', " Run \u00B7", ' ', _jsx("span", { className: "font-mono", children: runId }), detail.projectName && ` · ${detail.projectName}`] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [isRunning && (_jsxs("label", { className: "flex items-center gap-1.5 text-[12px] text-slate-400 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: autoRefresh, onChange: e => setAuto(e.target.checked), className: "accent-blue-500" }), "Live"] })), (detail.runStatus === 'FAILED' || detail.runStatus === 'TIMED_OUT') && (_jsxs("button", { onClick: () => (executionKind === 'pipeline' ? api.retryPipelineRun : api.retryOrchestratorRun)(runId), className: "flex items-center gap-1.5 h-7 px-3 bg-amber-700 hover:bg-amber-600 text-white rounded text-[12px] font-medium transition-colors", children: [_jsx(RotateCcw, { className: "w-3.5 h-3.5" }), " Retry"] })), (detail.runStatus === 'RUNNING' || detail.runStatus === 'QUEUED') && (_jsxs("button", { onClick: () => (executionKind === 'pipeline' ? api.cancelPipelineRun : api.cancelOrchestratorRun)(runId), className: "flex items-center gap-1.5 h-7 px-3 bg-red-700 hover:bg-red-600 text-white rounded text-[12px] font-medium transition-colors", children: [_jsx(XCircle, { className: "w-3.5 h-3.5" }), " Cancel"] })), detail.sparkUiUrl && (_jsxs("a", { href: detail.sparkUiUrl, target: "_blank", rel: "noreferrer", className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors", children: [_jsx(ExternalLink, { className: "w-3.5 h-3.5" }), " Spark UI"] })), _jsxs("button", { onClick: fetchDetail, className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors", children: [_jsx(RefreshCw, { className: "w-3 h-3" }), " Refresh"] })] })] }) }), _jsx("div", { className: "flex items-center border-b border-slate-800 px-5 flex-shrink-0", children: SUB_TABS.map(t => (_jsxs("button", { onClick: () => setSubTab(t.key), className: `flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${subTab === t.key
                        ? 'border-blue-500 text-blue-300'
                        : 'border-transparent text-slate-500 hover:text-slate-300'}`, children: [_jsx(t.Icon, { className: "w-3.5 h-3.5" }), t.label] }, t.key))) }), _jsxs("div", { className: "flex-1 overflow-auto p-5 min-h-0", children: [subTab === 'summary' && (_jsxs("div", { className: "max-w-3xl space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3", children: [_jsx(Metric, { label: "Status", value: detail.runStatus }), _jsx(Metric, { label: "Trigger", value: detail.triggerType }), _jsx(Metric, { label: "Submitted By", value: detail.submittedBy }), _jsx(Metric, { label: "Version", value: detail.versionLabel }), _jsx(Metric, { label: "Started", value: fmtDt(detail.startDtm) }), _jsx(Metric, { label: "Ended", value: fmtDt(detail.endDtm) }), _jsx(Metric, { label: "Duration", value: fmtDur(detail.durationMs) }), _jsx(Metric, { label: "Retries", value: detail.retryCount }), _jsx(Metric, { label: "SLA Status", value: detail.slaStatus }), _jsx(Metric, { label: "Error Category", value: detail.errorCategory }), _jsx(Metric, { label: "Rows Processed", value: detail.rowsProcessed?.toLocaleString() ?? null }), _jsx(Metric, { label: "Data Read", value: fmtBytes(detail.bytesRead) }), _jsx(Metric, { label: "Data Written", value: fmtBytes(detail.bytesWritten) }), detail.sparkJobId && _jsx(Metric, { label: "Spark Job ID", value: detail.sparkJobId })] }), detail.errorMessage && (_jsxs("div", { className: "bg-red-950/40 border border-red-800 rounded-lg p-4", children: [_jsxs("div", { className: "text-[11px] font-semibold text-red-400 mb-2 flex items-center gap-1.5", children: [_jsx(XCircle, { className: "w-3.5 h-3.5" }), " Error Details"] }), _jsx("pre", { className: "text-[12px] text-red-300/80 whitespace-pre-wrap font-mono", children: detail.errorMessage })] }))] })), subTab === 'steps' && (_jsxs("div", { className: "max-w-3xl", children: [_jsxs("div", { className: "text-[12px] text-slate-500 mb-4", children: [nodes.length, " step", nodes.length !== 1 ? 's' : '', " \u00B7 click a bar to expand metrics"] }), _jsx(NodeTimeline, { nodes: nodes })] })), subTab === 'logs' && (_jsx("div", { className: "h-full flex flex-col", style: { minHeight: '400px' }, children: _jsx(LogViewer, { runId: runId, autoRefresh: isRunning && autoRefresh }) })), subTab === 'code' && (_jsxs("div", { className: "max-w-3xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("div", { className: "text-[13px] font-medium text-slate-300", children: "Generated Spark Code" }), detail.generatedCodeRef && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: async () => {
                                                    await navigator.clipboard.writeText(detail.generatedCodeRef);
                                                    setCodeCopied(true);
                                                    setTimeout(() => setCodeCopied(false), 2000);
                                                }, className: "flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", children: codeCopied ? _jsxs(_Fragment, { children: [_jsx(CheckCircle2, { className: "w-3 h-3 text-emerald-400" }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3 h-3" }), " Copy"] }) }), _jsxs("button", { onClick: () => {
                                                    const blob = new Blob([detail.generatedCodeRef], { type: 'text/plain' });
                                                    const a = document.createElement('a');
                                                    a.href = URL.createObjectURL(blob);
                                                    a.download = `run_${runId}_code.py`;
                                                    a.click();
                                                }, className: "flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", children: [_jsx(Download, { className: "w-3 h-3" }), " Download"] })] }))] }), detail.generatedCodeRef ? (_jsx("div", { className: "bg-[#070910] border border-slate-800 rounded-lg overflow-auto max-h-[70vh]", children: _jsx("pre", { className: "p-4 text-[12px] text-slate-300 font-mono whitespace-pre", children: detail.generatedCodeRef }) })) : (_jsxs("div", { className: "flex flex-col items-center justify-center h-40 text-slate-600", children: [_jsx(Code2, { className: "w-8 h-8 mb-2 opacity-30" }), _jsx("p", { className: "text-sm", children: "Generated code snapshot not available for this run." })] }))] })), subTab === 'metrics' && (_jsxs("div", { className: "max-w-3xl space-y-4", children: [_jsx("div", { className: "text-[12px] font-medium text-slate-300 mb-4", children: "Node-Level Metrics" }), nodes.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-40 text-slate-600", children: [_jsx(BarChart3, { className: "w-8 h-8 mb-2 opacity-30" }), _jsx("p", { className: "text-sm", children: "No node metrics captured for this run." })] })) : nodes.map(node => (_jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-[12px] font-medium text-slate-200 font-mono", children: node.nodeDisplayName || node.nodeIdInIrText }), _jsx(StatusBadge, { status: node.runStatus })] }), _jsxs("div", { className: "grid grid-cols-4 gap-3", children: [_jsx(Metric, { label: "Duration", value: fmtDur(node.durationMs) }), _jsx(Metric, { label: "Rows In", value: node.rowsIn?.toLocaleString() ?? null }), _jsx(Metric, { label: "Rows Out", value: node.rowsOut?.toLocaleString() ?? null }), node.errorMessage && _jsx(Metric, { label: "Error", value: node.errorMessage.slice(0, 60) })] }), Object.keys(node.metrics).length > 0 && (_jsxs("details", { className: "mt-2", children: [_jsx("summary", { className: "text-[11px] text-slate-500 cursor-pointer hover:text-slate-300", children: "Raw metrics" }), _jsx("pre", { className: "mt-1 text-[11px] text-slate-500 bg-[#070910] rounded p-2 overflow-auto max-h-32 border border-slate-800", children: JSON.stringify(node.metrics, null, 2) })] }))] }, node.nodeRunId)))] }))] })] }));
}
