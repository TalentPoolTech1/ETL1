import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Pipeline > Parameters sub-tab
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Lock, Save, Loader2 } from 'lucide-react';
import api from '@/services/api';
const DATA_TYPES = ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'LIST', 'MAP'];
export function PipelineParametersSubTab({ pipelineId, onDirty }) {
    const [params, setParams] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirtyLocal, setIsDirtyLocal] = useState(false);
    useEffect(() => {
        setIsLoading(true);
        api.getPipelineParameters(pipelineId)
            .then(res => {
            setParams(res.data.data ?? []);
            setIsDirtyLocal(false);
        })
            .catch(err => console.error('Failed to load parameters:', err))
            .finally(() => setIsLoading(false));
    }, [pipelineId]);
    const markDirty = () => {
        setIsDirtyLocal(true);
        onDirty?.();
    };
    const handleSave = async () => {
        if (isSaving || !isDirtyLocal)
            return;
        setIsSaving(true);
        try {
            await api.savePipelineParameters(pipelineId, params);
            setIsDirtyLocal(false);
        }
        catch (err) {
            alert(err?.response?.data?.userMessage ?? 'Failed to save parameters');
        }
        finally {
            setIsSaving(false);
        }
    };
    const addParam = () => {
        const id = crypto.randomUUID();
        setParams(prev => [...prev, { id, name: 'new_param', dataType: 'STRING', required: false, defaultValue: '', isSensitive: false, description: '', scope: 'pipeline' }]);
        setEditingId(id);
        onDirty?.();
    };
    const removeParam = (id) => {
        setParams(prev => prev.filter(p => p.id !== id));
        markDirty();
    };
    const updateParam = (id, field, value) => {
        setParams(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
        markDirty();
    };
    if (isLoading) {
        return _jsxs("div", { className: "flex-1 flex items-center justify-center text-slate-400 text-sm", children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), " Loading parameters..."] });
    }
    if (params.length === 0) {
        return (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 p-5", children: [_jsx("p", { className: "text-sm mb-3", children: "No parameters defined for this pipeline." }), _jsxs("button", { onClick: addParam, className: "flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors", children: [_jsx(Plus, { className: "w-3 h-3" }), " Add Parameter"] })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0", children: [_jsxs("span", { className: "text-[12px] text-slate-400 font-medium", children: [params.length, " parameter", params.length !== 1 ? 's' : ''] }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [isDirtyLocal && (_jsxs("button", { onClick: handleSave, disabled: isSaving, className: "flex items-center gap-1.5 h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50", children: [isSaving ? _jsx(Loader2, { className: "w-3 h-3 animate-spin" }) : _jsx(Save, { className: "w-3 h-3" }), " Save Parameters"] })), _jsxs("button", { onClick: addParam, className: "flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors", children: [_jsx(Plus, { className: "w-3 h-3" }), " Add Parameter"] })] })] }), _jsx("div", { className: "flex-1 overflow-auto", children: _jsxs("table", { className: "w-full border-collapse text-[12px]", children: [_jsx("thead", { className: "sticky top-0 bg-[#0a0c15] z-10", children: _jsxs("tr", { className: "text-left text-[11px] text-slate-500 border-b border-slate-800", children: [_jsx("th", { className: "px-3 py-2 font-medium", children: "Name" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Type" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Required" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Default Value" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Sensitive" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Scope" }), _jsx("th", { className: "px-3 py-2 font-medium", children: "Description" }), _jsx("th", { className: "px-3 py-2 font-medium w-8" })] }) }), _jsx("tbody", { children: params.map(p => (_jsxs("tr", { className: "border-b border-slate-800/50 hover:bg-slate-800/20", children: [_jsx("td", { className: "px-2 py-1.5", children: _jsx("input", { value: p.name, onChange: e => updateParam(p.id, 'name', e.target.value), className: "w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 font-mono" }) }), _jsx("td", { className: "px-2 py-1.5", children: _jsx("select", { value: p.dataType, onChange: e => updateParam(p.id, 'dataType', e.target.value), className: "h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500", children: DATA_TYPES.map(t => _jsx("option", { value: t, children: t }, t)) }) }), _jsx("td", { className: "px-3 py-1.5 text-center", children: _jsx("input", { type: "checkbox", checked: p.required, onChange: e => updateParam(p.id, 'required', e.target.checked), className: "accent-blue-500" }) }), _jsx("td", { className: "px-2 py-1.5", children: p.isSensitive ? (_jsxs("div", { className: "flex items-center gap-1 text-slate-600 text-[11px]", children: [_jsx(Lock, { className: "w-3 h-3" }), " Hidden"] })) : (_jsx("input", { value: p.defaultValue, onChange: e => updateParam(p.id, 'defaultValue', e.target.value), className: "w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" })) }), _jsx("td", { className: "px-3 py-1.5 text-center", children: _jsx("input", { type: "checkbox", checked: p.isSensitive, onChange: e => updateParam(p.id, 'isSensitive', e.target.checked), className: "accent-red-500" }) }), _jsx("td", { className: "px-2 py-1.5", children: _jsxs("select", { value: p.scope, onChange: e => updateParam(p.id, 'scope', e.target.value), className: "h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500", children: [_jsx("option", { value: "pipeline", children: "Pipeline" }), _jsx("option", { value: "execution", children: "Execution" }), _jsx("option", { value: "global", children: "Global" })] }) }), _jsx("td", { className: "px-2 py-1.5", children: _jsx("input", { value: p.description, onChange: e => updateParam(p.id, 'description', e.target.value), className: "w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" }) }), _jsx("td", { className: "px-2 py-1.5", children: _jsx("button", { onClick: () => removeParam(p.id), className: "w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors", children: _jsx(Trash2, { className: "w-3 h-3" }) }) })] }, p.id))) })] }) })] }));
}
