import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Orchestrator > Properties sub-tab
 */
import { useState } from 'react';
function Field({ label, value, onChange, ro }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: label }), ro ? (_jsx("div", { className: "h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono", children: value || '—' })) : (_jsx("input", { type: "text", value: value, onChange: e => onChange?.(e.target.value), className: "w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" }))] }));
}
export function OrchestratorPropertiesSubTab({ orchId, onDirty }) {
    const [data, setData] = useState({
        orchId,
        name: '',
        description: '',
        status: 'draft',
        owner: '',
        tags: '',
        version: '1',
        publishedState: 'draft',
        lockState: 'Unlocked',
        timeoutPolicy: '4 hours',
        retryPolicy: '3 retries, 60s delay',
        concurrencyRule: 'allow_parallel',
        createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
        lastOpenedBy: '—', lastOpenedOn: '—',
        lastExecutedBy: '—', lastExecutedOn: '—',
        lastSuccessOn: '—', lastFailedOn: '—',
    });
    const update = (field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        onDirty?.();
    };
    const F = (p) => (_jsx(Field, { label: p.label, value: data[p.field] ?? '', onChange: v => update(p.field, v), ro: p.ro }));
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(F, { label: "Orchestrator ID", field: "orchId", ro: true }), _jsx(F, { label: "Orchestrator Name *", field: "name" }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: "Description" }), _jsx("textarea", { rows: 3, value: data.description, onChange: e => update('description', e.target.value), className: "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Status", field: "status", ro: true }), _jsx(F, { label: "Owner", field: "owner" })] }), _jsx(F, { label: "Tags", field: "tags" }), _jsxs("div", { className: "border-t border-slate-800 pt-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Timeout Policy", field: "timeoutPolicy" }), _jsx(F, { label: "Retry Policy", field: "retryPolicy" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Concurrency Rule", field: "concurrencyRule" }), _jsx(F, { label: "Published State", field: "publishedState", ro: true })] })] }), _jsxs("div", { className: "border-t border-slate-800 pt-4 grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Created By", field: "createdBy", ro: true }), _jsx(F, { label: "Created On", field: "createdOn", ro: true }), _jsx(F, { label: "Updated By", field: "updatedBy", ro: true }), _jsx(F, { label: "Updated On", field: "updatedOn", ro: true }), _jsx(F, { label: "Last Opened By", field: "lastOpenedBy", ro: true }), _jsx(F, { label: "Last Opened On", field: "lastOpenedOn", ro: true }), _jsx(F, { label: "Last Executed By", field: "lastExecutedBy", ro: true }), _jsx(F, { label: "Last Executed On", field: "lastExecutedOn", ro: true }), _jsx(F, { label: "Last Success On", field: "lastSuccessOn", ro: true }), _jsx(F, { label: "Last Failed On", field: "lastFailedOn", ro: true }), _jsx(F, { label: "Version", field: "version", ro: true }), _jsx(F, { label: "Lock State", field: "lockState", ro: true })] })] }) }));
}
