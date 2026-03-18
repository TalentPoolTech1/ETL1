import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Pipeline > Activity sub-tab
 * Wired to the audit logs API to show real pipeline activity.
 */
import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import api from '@/services/api';
const EVENT_COLORS = {
    OPENED: 'text-slate-400', SAVED: 'text-emerald-400', VALIDATED: 'text-violet-400',
    EXECUTION_STARTED: 'text-blue-400', EXECUTION_SUCCEEDED: 'text-emerald-400',
    EXECUTION_FAILED: 'text-red-400', PUBLISHED: 'text-teal-400', PERMISSION_CHANGED: 'text-orange-400',
    PIPELINE_SAVED: 'text-emerald-400', RUN_STARTED: 'text-blue-400', RUN_COMPLETED: 'text-emerald-400',
    RUN_FAILED: 'text-red-400',
};
export function PipelineActivitySubTab({ pipelineId }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const load = useCallback(async () => {
        if (!pipelineId)
            return;
        setLoading(true);
        try {
            const res = await api.getPipelineAuditLogs(pipelineId);
            const data = res.data?.data ?? res.data ?? [];
            const mapped = (Array.isArray(data) ? data : []).map((e) => ({
                id: e.id ?? e.hist_id ?? crypto.randomUUID(),
                action: e.action ?? e.hist_action_cd ?? 'UNKNOWN',
                actor: e.user ?? e.hist_action_by ?? 'system',
                timestamp: e.timestamp ?? e.hist_action_dtm ?? '',
                detail: e.summary ?? e.detail ?? '',
            }));
            setEvents(mapped);
        }
        catch {
            setEvents([]);
        }
        finally {
            setLoading(false);
        }
    }, [pipelineId]);
    useEffect(() => { load(); }, [load]);
    return (_jsxs("div", { className: "flex-1 overflow-auto p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Activity, { className: "w-4 h-4 text-slate-400" }), _jsx("span", { className: "text-[12px] font-medium text-slate-300", children: "Pipeline Activity" }), _jsxs("button", { onClick: load, className: "ml-auto text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 border border-slate-700 px-2 py-1 rounded transition-colors", children: [_jsx(RefreshCw, { className: `w-3 h-3 ${loading ? 'animate-spin' : ''}` }), " Refresh"] })] }), loading ? (_jsx("div", { className: "flex flex-col items-center justify-center h-40 text-slate-600", children: _jsx("p", { className: "text-sm", children: "Loading activity\u2026" }) })) : events.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-40 text-slate-600", children: [_jsx(Activity, { className: "w-8 h-8 mb-2 opacity-30" }), _jsx("p", { className: "text-sm", children: "No activity recorded yet for this pipeline." })] })) : (_jsx("div", { className: "max-w-2xl space-y-0", children: events.map(e => (_jsxs("div", { className: "flex items-start gap-3 py-2.5 border-b border-slate-800/50", children: [_jsx("div", { className: "text-[11px] text-slate-600 font-mono w-32 flex-shrink-0 mt-0.5", children: e.timestamp ? new Date(e.timestamp).toLocaleString() : '—' }), _jsx("span", { className: `text-[12px] font-medium ${EVENT_COLORS[e.action] ?? 'text-slate-400'}`, children: (e.action ?? '').replace(/_/g, ' ') }), _jsx("span", { className: "text-[12px] text-slate-400", children: e.actor }), e.detail && _jsx("span", { className: "text-[11px] text-slate-600 ml-auto", children: e.detail })] }, e.id))) }))] }));
}
