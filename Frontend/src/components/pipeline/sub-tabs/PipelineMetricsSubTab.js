import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Pipeline > Metrics sub-tab — Execution metrics summary across recent runs
 */
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3 } from 'lucide-react';
import api from '@/services/api';
function MetricCard({ label, value, sub, trend }) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500';
    return (_jsxs("div", { className: "bg-slate-800/40 border border-slate-700 rounded-lg p-4", children: [_jsx("div", { className: "text-[11px] text-slate-500 mb-1", children: label }), _jsx("div", { className: "text-[22px] font-bold text-slate-100 leading-tight", children: value }), sub && (_jsxs("div", { className: `flex items-center gap-1 mt-1 text-[11px] ${trendColor}`, children: [_jsx(TrendIcon, { className: "w-3 h-3" }), sub] }))] }));
}
function fmtDur(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)
        return `${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtBytes(b) {
    if (b >= 1073741824)
        return `${(b / 1073741824).toFixed(1)} GB`;
    if (b >= 1048576)
        return `${(b / 1048576).toFixed(1)} MB`;
    if (b >= 1024)
        return `${(b / 1024).toFixed(1)} KB`;
    return `${b} B`;
}
export function PipelineMetricsSubTab({ pipelineId }) {
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        setLoading(true);
        try {
            const res = await api.getPipelineRuns({ pipelineId, pageSize: 30, page: 1 });
            const d = res.data?.data ?? res.data;
            setRuns(Array.isArray(d) ? d : (d.items ?? []));
        }
        catch {
            setRuns([]);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [pipelineId]);
    if (loading)
        return (_jsx("div", { className: "flex-1 flex items-center justify-center text-slate-500 text-sm bg-[#0d0f1a]", children: "Loading metrics\u2026" }));
    if (runs.length === 0)
        return (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 bg-[#0d0f1a]", children: [_jsx(BarChart3, { className: "w-10 h-10 mb-3 opacity-30" }), _jsx("p", { className: "text-sm", children: "No execution data available yet." })] }));
    // Compute summary stats
    const completed = runs.filter(r => r.runStatus === 'SUCCESS' || r.runStatus === 'FAILED' || r.runStatus === 'PARTIALLY_COMPLETED');
    const successful = runs.filter(r => r.runStatus === 'SUCCESS');
    const failed = runs.filter(r => r.runStatus === 'FAILED');
    const successRate = completed.length > 0 ? (successful.length / completed.length * 100).toFixed(1) : '—';
    const durations = completed.filter(r => r.durationMs !== null).map(r => r.durationMs);
    const avgDur = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const maxDur = durations.length > 0 ? Math.max(...durations) : null;
    const minDur = durations.length > 0 ? Math.min(...durations) : null;
    const totalRows = runs.reduce((a, r) => a + (r.rowsProcessed ?? 0), 0);
    const totalBytes = runs.reduce((a, r) => a + (r.bytesRead ?? 0), 0);
    const totalRetries = runs.reduce((a, r) => a + r.retryCount, 0);
    // Duration chart (simple bar chart using div widths)
    const maxBarDur = maxDur ?? 1;
    const chartRuns = [...runs].filter(r => r.durationMs !== null).slice(-15);
    return (_jsxs("div", { className: "flex-1 overflow-auto p-5 bg-[#0d0f1a]", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-6", children: [_jsx(MetricCard, { label: "Success Rate (last 30)", value: `${successRate}%`, sub: `${successful.length} / ${completed.length} runs`, trend: Number(successRate) >= 90 ? 'up' : Number(successRate) >= 70 ? 'flat' : 'down' }), _jsx(MetricCard, { label: "Avg Duration", value: avgDur !== null ? fmtDur(avgDur) : '—', sub: `Min ${minDur !== null ? fmtDur(minDur) : '—'} · Max ${maxDur !== null ? fmtDur(maxDur) : '—'}` }), _jsx(MetricCard, { label: "Total Rows Processed", value: totalRows >= 1000000 ? `${(totalRows / 1000000).toFixed(1)}M` : totalRows >= 1000 ? `${(totalRows / 1000).toFixed(1)}K` : String(totalRows), sub: "across all runs" }), _jsx(MetricCard, { label: "Total Data Processed", value: fmtBytes(totalBytes), sub: `${totalRetries} retries total` })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-6", children: [_jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Status Breakdown (Last 30)" }), [
                                { label: 'Success', count: successful.length, color: 'bg-emerald-500' },
                                { label: 'Failed', count: failed.length, color: 'bg-red-500' },
                                { label: 'Cancelled', count: runs.filter(r => r.runStatus === 'CANCELLED').length, color: 'bg-orange-500' },
                                { label: 'Other', count: runs.filter(r => !['SUCCESS', 'FAILED', 'CANCELLED'].includes(r.runStatus)).length, color: 'bg-slate-600' },
                            ].map(b => (_jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [_jsx("span", { className: "text-[12px] text-slate-400 w-16", children: b.label }), _jsx("div", { className: "flex-1 bg-slate-800 rounded-full h-4 overflow-hidden", children: _jsx("div", { className: `h-full ${b.color} rounded-full transition-all`, style: { width: runs.length > 0 ? `${(b.count / runs.length * 100)}%` : '0%' } }) }), _jsx("span", { className: "text-[12px] text-slate-300 w-6 text-right", children: b.count })] }, b.label)))] }), _jsxs("div", { className: "bg-slate-800/30 border border-slate-800 rounded-lg p-4", children: [_jsx("div", { className: "text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3", children: "Recent Run Durations" }), _jsx("div", { className: "flex items-end gap-1 h-24", children: chartRuns.map((r, i) => {
                                    const pct = (r.durationMs / maxBarDur) * 100;
                                    const color = r.runStatus === 'SUCCESS' ? 'bg-emerald-600' : r.runStatus === 'FAILED' ? 'bg-red-600' : 'bg-slate-600';
                                    return (_jsx("div", { className: "flex-1 flex flex-col items-center gap-0.5", title: `${fmtDur(r.durationMs)} · ${r.runStatus}`, children: _jsx("div", { className: `w-full ${color} rounded-t transition-all`, style: { height: `${Math.max(4, pct)}%` } }) }, i));
                                }) }), _jsxs("div", { className: "text-[10px] text-slate-600 mt-1 text-right", children: [chartRuns.length, " recent runs"] })] })] }), _jsxs("button", { onClick: load, className: "flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors", children: [_jsx(RefreshCw, { className: "w-3 h-3" }), " Refresh"] })] }));
}
