import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createPipeline, closeCreatePipeline } from '@/store/slices/projectsSlice';
import { openTab } from '@/store/slices/tabsSlice';
import { X, Workflow, Loader2, Folder } from 'lucide-react';
export function CreatePipelineDialog() {
    const dispatch = useAppDispatch();
    const projectId = useAppSelector(s => s.projects.createPipelineProjectId);
    const folderId = useAppSelector(s => s.projects.createPipelineFolderId);
    const project = useAppSelector(s => s.projects.projects.find(p => p.projectId === projectId));
    // Find folder name for display (may be in any project's foldersByProject, or local FolderNode state)
    // We keep it simple: show folderId prefix when set but no name available
    const folderName = useAppSelector(s => {
        if (!folderId || !projectId)
            return null;
        return (s.projects.foldersByProject[projectId] ?? []).find(f => f.folderId === folderId)?.folderDisplayName ?? null;
    });
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current?.focus(); }, []);
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape')
            dispatch(closeCreatePipeline()); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [dispatch]);
    if (!projectId)
        return null;
    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim())
            return;
        setSaving(true);
        setError(null);
        try {
            const result = await dispatch(createPipeline({
                projectId,
                pipelineDisplayName: name.trim(),
                pipelineDescText: desc.trim() || undefined,
                folderId: folderId ?? undefined,
            })).unwrap();
            dispatch(openTab({
                id: `pipeline-${result.pipeline.pipelineId}`,
                type: 'pipeline',
                objectId: result.pipeline.pipelineId,
                objectName: result.pipeline.pipelineDisplayName,
                unsaved: false,
                isDirty: false,
            }));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create pipeline');
            setSaving(false);
        }
    };
    // Context breadcrumb shown in the dialog subtitle
    const contextLabel = folderId
        ? folderName
            ? _jsxs(_Fragment, { children: ["in folder ", _jsx("span", { className: "text-slate-300", children: folderName })] })
            : _jsx(_Fragment, { children: "in a folder" })
        : project
            ? _jsxs(_Fragment, { children: ["at root of ", _jsx("span", { className: "text-slate-300", children: project.projectDisplayName })] })
            : null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", onClick: () => dispatch(closeCreatePipeline()), children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm" }), _jsxs("div", { className: "relative bg-[#1a1d27] border border-slate-700/60 rounded-xl shadow-2xl w-full max-w-[420px] mx-4 overflow-hidden", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0", children: _jsx(Workflow, { className: "w-4 h-4 text-sky-400" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-100", children: "New Pipeline" }), contextLabel && (_jsxs("p", { className: "text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate", children: [folderId && _jsx(Folder, { className: "w-3 h-3 flex-shrink-0" }), contextLabel] }))] }), _jsx("button", { onClick: () => dispatch(closeCreatePipeline()), className: "w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("form", { onSubmit: submit, className: "px-5 py-4 space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-400 mb-1.5", children: ["Pipeline name ", _jsx("span", { className: "text-red-400", children: "*" })] }), _jsx("input", { ref: inputRef, type: "text", value: name, onChange: e => setName(e.target.value), placeholder: "e.g. ingest-customers", className: "w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-400 mb-1.5", children: ["Description ", _jsx("span", { className: "text-slate-600", children: "(optional)" })] }), _jsx("textarea", { value: desc, onChange: e => setDesc(e.target.value), placeholder: "What does this pipeline do?", rows: 2, className: "w-full px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all" })] }), error && (_jsx("p", { className: "text-xs text-red-400 bg-red-950/40 border border-red-900/30 rounded-md px-3 py-2", children: error })), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx("button", { type: "button", onClick: () => dispatch(closeCreatePipeline()), className: "flex-1 h-9 text-sm text-slate-400 border border-slate-700/60 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors", children: "Cancel" }), _jsxs("button", { type: "submit", disabled: saving || !name.trim(), className: "flex-1 h-9 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2", children: [saving && _jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin" }), saving ? 'Creating…' : 'Create Pipeline'] })] })] })] })] }));
}
