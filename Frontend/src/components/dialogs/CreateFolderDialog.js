import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createFolder, closeCreateFolder } from '@/store/slices/projectsSlice';
import { X, FolderPlus, Loader2 } from 'lucide-react';
export function CreateFolderDialog() {
    const dispatch = useAppDispatch();
    const projectId = useAppSelector(s => s.projects.createFolderProjectId);
    const parentId = useAppSelector(s => s.projects.createFolderParentId);
    // Find the parent folder name for display purposes
    const parentFolder = useAppSelector(s => parentId
        ? (s.projects.foldersByProject[projectId ?? ''] ?? []).find(f => f.folderId === parentId) ?? null
        : null);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current?.focus(); }, []);
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape')
            dispatch(closeCreateFolder()); };
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
            await dispatch(createFolder({
                projectId,
                parentFolderId: parentId ?? undefined,
                folderDisplayName: name.trim(),
            })).unwrap();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create folder');
            setSaving(false);
        }
    };
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", onClick: () => dispatch(closeCreateFolder()), children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm" }), _jsxs("div", { className: "relative bg-[#1a1d27] border border-slate-700/60 rounded-xl shadow-2xl w-full max-w-[400px] mx-4 overflow-hidden", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0", children: _jsx(FolderPlus, { className: "w-4 h-4 text-sky-400" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-100", children: "New Folder" }), _jsx("p", { className: "text-[11px] text-slate-500 mt-0.5", children: parentFolder
                                            ? _jsxs(_Fragment, { children: ["Inside ", _jsx("span", { className: "text-slate-400", children: parentFolder.folderDisplayName })] })
                                            : 'Root folder in project' })] }), _jsx("button", { onClick: () => dispatch(closeCreateFolder()), className: "w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("form", { onSubmit: submit, className: "px-5 py-4 space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-400 mb-1.5", children: ["Folder name ", _jsx("span", { className: "text-red-400", children: "*" })] }), _jsx("input", { ref: inputRef, type: "text", value: name, onChange: e => setName(e.target.value), placeholder: "e.g. Raw Ingestion", className: "w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all" })] }), error && (_jsx("p", { className: "text-xs text-red-400 bg-red-950/40 border border-red-900/30 rounded-md px-3 py-2", children: error })), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx("button", { type: "button", onClick: () => dispatch(closeCreateFolder()), className: "flex-1 h-9 text-sm text-slate-400 border border-slate-700/60 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors", children: "Cancel" }), _jsxs("button", { type: "submit", disabled: saving || !name.trim(), className: "flex-1 h-9 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2", children: [saving && _jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin" }), saving ? 'Creating…' : 'Create Folder'] })] })] })] })] }));
}
