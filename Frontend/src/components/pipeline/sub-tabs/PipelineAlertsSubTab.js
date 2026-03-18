import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Pipeline > Alerts sub-tab — Configure alerting rules for execution events
 */
import { useState } from 'react';
import { Plus, Trash2, Bell, BellOff, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
const EVENT_LABELS = {
    EXECUTION_FAILED: 'Execution Failed',
    EXECUTION_SUCCEEDED: 'Execution Succeeded',
    EXECUTION_STARTED: 'Execution Started',
    TIMED_OUT: 'Timed Out',
    SLA_BREACHED: 'SLA Breached',
    RETRY_EXHAUSTED: 'Retries Exhausted',
    ROWS_BELOW_THRESHOLD: 'Rows Below Threshold',
    ROWS_ABOVE_THRESHOLD: 'Rows Above Threshold',
};
const EVENT_ICONS = {
    EXECUTION_FAILED: _jsx(XCircle, { className: "w-3.5 h-3.5 text-red-400" }),
    EXECUTION_SUCCEEDED: _jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-400" }),
    EXECUTION_STARTED: _jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-blue-400" }),
    TIMED_OUT: _jsx(Clock, { className: "w-3.5 h-3.5 text-orange-400" }),
    SLA_BREACHED: _jsx(AlertTriangle, { className: "w-3.5 h-3.5 text-amber-400" }),
    RETRY_EXHAUSTED: _jsx(AlertTriangle, { className: "w-3.5 h-3.5 text-red-400" }),
    ROWS_BELOW_THRESHOLD: _jsx(AlertTriangle, { className: "w-3.5 h-3.5 text-amber-400" }),
    ROWS_ABOVE_THRESHOLD: _jsx(AlertTriangle, { className: "w-3.5 h-3.5 text-amber-400" }),
};
const CHANNEL_COLORS = {
    email: 'text-blue-300 bg-blue-900/30 border-blue-700',
    slack: 'text-purple-300 bg-purple-900/30 border-purple-700',
    webhook: 'text-amber-300 bg-amber-900/30 border-amber-700',
    pagerduty: 'text-red-300 bg-red-900/30 border-red-700',
};
export function PipelineAlertsSubTab({ pipelineId }) {
    const [rules, setRules] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newRule, setNewRule] = useState({
        name: '', enabled: true, event: 'EXECUTION_FAILED', channel: 'email', target: '',
    });
    const toggleRule = (id) => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    const deleteRule = (id) => setRules(prev => prev.filter(r => r.id !== id));
    const addRule = () => {
        if (!newRule.name || !newRule.target)
            return;
        setRules(prev => [...prev, { ...newRule, id: crypto.randomUUID() }]);
        setNewRule({ name: '', enabled: true, event: 'EXECUTION_FAILED', channel: 'email', target: '' });
        setShowAdd(false);
    };
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden bg-[#0d0f1a]", children: [_jsxs("div", { className: "flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0", children: [_jsx(Bell, { className: "w-4 h-4 text-amber-400" }), _jsx("span", { className: "text-[12px] font-medium text-slate-300", children: "Alert Rules" }), _jsxs("span", { className: "text-[11px] text-slate-600", children: ["\u00B7 ", rules.filter(r => r.enabled).length, " active / ", rules.length, " total"] }), _jsxs("button", { onClick: () => setShowAdd(v => !v), className: "ml-auto flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors", children: [_jsx(Plus, { className: "w-3 h-3" }), " Add Rule"] })] }), showAdd && (_jsxs("div", { className: "px-4 py-3 border-b border-slate-800 bg-slate-900/30 flex-shrink-0", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[10px] text-slate-500 mb-1", children: "Rule Name *" }), _jsx("input", { value: newRule.name ?? '', onChange: e => setNewRule(p => ({ ...p, name: e.target.value })), className: "w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[10px] text-slate-500 mb-1", children: "Event" }), _jsx("select", { value: newRule.event, onChange: e => setNewRule(p => ({ ...p, event: e.target.value })), className: "w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500", children: Object.keys(EVENT_LABELS).map(e => (_jsx("option", { value: e, children: EVENT_LABELS[e] }, e))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[10px] text-slate-500 mb-1", children: "Channel" }), _jsxs("select", { value: newRule.channel, onChange: e => setNewRule(p => ({ ...p, channel: e.target.value })), className: "w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500", children: [_jsx("option", { value: "email", children: "Email" }), _jsx("option", { value: "slack", children: "Slack" }), _jsx("option", { value: "webhook", children: "Webhook" }), _jsx("option", { value: "pagerduty", children: "PagerDuty" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[10px] text-slate-500 mb-1", children: "Target *" }), _jsx("input", { value: newRule.target ?? '', onChange: e => setNewRule(p => ({ ...p, target: e.target.value })), placeholder: newRule.channel === 'email' ? 'email@example.com' : newRule.channel === 'slack' ? '#channel' : 'https://…', className: "w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: addRule, className: "h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors", children: "Add" }), _jsx("button", { onClick: () => setShowAdd(false), className: "h-7 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[12px] transition-colors", children: "Cancel" })] })] })), _jsx("div", { className: "flex-1 overflow-auto p-4", children: rules.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-40 text-slate-600", children: [_jsx(BellOff, { className: "w-8 h-8 mb-2 opacity-30" }), _jsx("p", { className: "text-sm", children: "No alert rules configured." })] })) : (_jsx("div", { className: "space-y-2 max-w-3xl", children: rules.map(rule => (_jsxs("div", { className: `flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors ${rule.enabled ? 'border-slate-700 bg-slate-800/30' : 'border-slate-800 bg-slate-900/20 opacity-60'}`, children: [_jsx("button", { onClick: () => toggleRule(rule.id), className: `flex-shrink-0 transition-colors ${rule.enabled ? 'text-emerald-400' : 'text-slate-600'}`, title: rule.enabled ? 'Disable' : 'Enable', children: rule.enabled ? _jsx(Bell, { className: "w-4 h-4" }) : _jsx(BellOff, { className: "w-4 h-4" }) }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0 min-w-[160px]", children: [EVENT_ICONS[rule.event], _jsx("span", { className: "text-[12px] font-medium text-slate-200", children: rule.name })] }), _jsx("span", { className: "text-[11px] text-slate-500 flex-1", children: EVENT_LABELS[rule.event] }), _jsx("span", { className: `px-2 py-0.5 rounded border text-[11px] font-medium capitalize ${CHANNEL_COLORS[rule.channel]}`, children: rule.channel }), _jsx("span", { className: "text-[11px] text-slate-400 font-mono truncate max-w-[200px]", title: rule.target, children: rule.target }), rule.silenceMinutes && (_jsxs("span", { className: "text-[10px] text-slate-600 whitespace-nowrap", children: ["Silence ", rule.silenceMinutes, "m"] })), _jsx("button", { onClick: () => deleteRule(rule.id), className: "flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors", children: _jsx(Trash2, { className: "w-3 h-3" }) })] }, rule.id))) })) }), _jsx("div", { className: "px-4 py-2 border-t border-slate-800 flex-shrink-0", children: _jsx("p", { className: "text-[11px] text-slate-600", children: "Alert delivery requires the notification backend to be configured. Contact your platform administrator." }) })] }));
}
