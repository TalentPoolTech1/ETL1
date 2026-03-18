import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Pipeline > Validation sub-tab
 */
import { useState, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, RefreshCw, Filter } from 'lucide-react';
import api from '@/services/api';
const SEV_CONFIG = {
    error: { Icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/20 border-red-700/50', label: 'Error' },
    warning: { Icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-700/50', label: 'Warning' },
    info: { Icon: Info, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-700/50', label: 'Info' },
};
export function PipelineValidationSubTab({ pipelineId }) {
    const [issues, setIssues] = useState([]);
    const [isRunning, setRunning] = useState(false);
    const [hasRun, setHasRun] = useState(false);
    const [filter, setFilter] = useState('all');
    const runValidation = useCallback(async () => {
        setRunning(true);
        try {
            const res = await api.validatePipeline(pipelineId);
            const d = res.data?.data ?? res.data;
            setIssues(Array.isArray(d?.issues) ? d.issues : []);
        }
        catch {
            setIssues([{ id: '1', severity: 'error', ruleId: 'SYS-001', message: 'Validation service unavailable.' }]);
        }
        finally {
            setRunning(false);
            setHasRun(true);
        }
    }, [pipelineId]);
    const filtered = filter === 'all' ? issues : issues.filter(i => i.severity === filter);
    const counts = { error: issues.filter(i => i.severity === 'error').length, warning: issues.filter(i => i.severity === 'warning').length, info: issues.filter(i => i.severity === 'info').length };
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 flex-shrink-0", children: [_jsx("button", { onClick: runValidation, disabled: isRunning, className: "flex items-center gap-1.5 h-7 px-3 bg-violet-700 hover:bg-violet-600 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-60", children: isRunning ? _jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "w-3 h-3 animate-spin" }), " Validating\u2026"] }) : _jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "w-3 h-3" }), " Validate"] }) }), hasRun && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2 text-[12px]", children: [counts.error > 0 && _jsxs("span", { className: "text-red-400 font-medium", children: [counts.error, " errors"] }), counts.warning > 0 && _jsxs("span", { className: "text-amber-400 font-medium", children: [counts.warning, " warnings"] }), counts.info > 0 && _jsxs("span", { className: "text-blue-400", children: [counts.info, " info"] }), issues.length === 0 && _jsxs("span", { className: "text-emerald-400 font-medium flex items-center gap-1", children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5" }), " All checks passed"] })] }), _jsxs("div", { className: "flex items-center gap-1 ml-auto", children: [_jsx(Filter, { className: "w-3.5 h-3.5 text-slate-500" }), ['all', 'error', 'warning', 'info'].map(f => (_jsx("button", { onClick: () => setFilter(f), className: `h-6 px-2 rounded text-[11px] transition-colors capitalize ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`, children: f }, f)))] })] }))] }), _jsxs("div", { className: "flex-1 overflow-auto p-4 space-y-2", children: [!hasRun && (_jsxs("div", { className: "flex flex-col items-center justify-center h-40 text-slate-600", children: [_jsx(AlertCircle, { className: "w-8 h-8 mb-2 opacity-30" }), _jsx("p", { className: "text-sm", children: "Click \"Validate\" to check the pipeline for issues." })] })), hasRun && filtered.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center h-40 text-emerald-500", children: [_jsx(CheckCircle2, { className: "w-8 h-8 mb-2" }), _jsxs("p", { className: "text-sm font-medium", children: ["No ", filter !== 'all' ? filter + 's' : 'issues', " found."] })] })), filtered.map(issue => {
                        const cfg = SEV_CONFIG[issue.severity];
                        return (_jsxs("div", { className: `flex items-start gap-3 p-3 rounded-lg border ${cfg.bg}`, children: [_jsx(cfg.Icon, { className: `w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.color}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 text-[12px]", children: [_jsx("span", { className: `font-medium ${cfg.color}`, children: cfg.label }), _jsx("span", { className: "text-slate-600 font-mono", children: issue.ruleId }), issue.affectedNode && _jsxs("span", { className: "text-slate-500", children: ["\u00B7 ", issue.affectedNode] })] }), _jsx("p", { className: "text-[12px] text-slate-300 mt-0.5", children: issue.message }), issue.suggestedFix && (_jsxs("p", { className: "text-[11px] text-slate-500 mt-1", children: ["\uD83D\uDCA1 ", issue.suggestedFix] }))] })] }, issue.id));
                    })] })] }));
}
