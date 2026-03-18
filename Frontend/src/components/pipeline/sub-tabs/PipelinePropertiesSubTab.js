import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Pipeline > Properties sub-tab
 */
import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { updateActivePipeline } from '@/store/slices/pipelineSlice';
function Field({ label, value, onChange, ro, ta, placeholder }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] text-slate-500 mb-1", children: label }), ro ? (_jsx("div", { className: "h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono", children: value || '—' })) : ta ? (_jsx("textarea", { rows: 3, value: value, onChange: e => onChange?.(e.target.value), placeholder: placeholder, className: "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" })) : (_jsx("input", { type: "text", value: value, onChange: e => onChange?.(e.target.value), placeholder: placeholder, className: "w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" }))] }));
}
export function PipelinePropertiesSubTab({ pipelineId, onDirty }) {
    const dispatch = useAppDispatch();
    const activePipeline = useAppSelector(s => s.pipeline.activePipeline);
    const projects = useAppSelector(s => s.projects.projects);
    const foldersByProject = useAppSelector(s => s.projects.foldersByProject);
    const project = projects.find(p => p.projectId === activePipeline?.projectId)?.projectDisplayName ?? 'Global / None';
    let folder = 'Root';
    if (activePipeline?.projectId) {
        const pFolders = foldersByProject[activePipeline.projectId] ?? [];
        const fNode = pFolders.find(f => f.folderId === activePipeline.folderId); // activePipeline doesn't have folderId typed in frontend Pipeline? We don't have it typed on Pipeline interface but it exists from API.
        if (fNode)
            folder = fNode.folderDisplayName;
    }
    const [data, setData] = useState({
        pipelineId,
        name: activePipeline?.name ?? '',
        description: activePipeline?.description ?? '',
        project, folder,
        status: activePipeline?.statusCode ?? '—',
        owner: activePipeline?.ownerUserName ?? '—',
        tags: (activePipeline?.tags ?? []).join(', '),
        labels: (activePipeline?.labels ?? []).join(', '),
        version: String(activePipeline?.version ?? '1'),
        createdBy: activePipeline?.createdByName ?? '—',
        createdOn: activePipeline?.createdAt ?? '—',
        updatedBy: activePipeline?.updatedByName ?? '—',
        updatedOn: activePipeline?.updatedAt ?? '—',
        lastOpenedBy: activePipeline?.lastOpenedByName ?? '—',
        lastOpenedOn: activePipeline?.lastOpenedDtm ?? '—',
        lastExecutedBy: activePipeline?.lastExecutedByName ?? '—',
        lastExecutedOn: activePipeline?.lastExecutedDtm ?? '—',
        lastSuccessOn: activePipeline?.lastSuccessDtm ?? '—',
        lastFailedOn: activePipeline?.lastFailedDtm ?? '—',
        runtimeEngine: activePipeline?.runtimeEngineCode ?? '—',
        executionMode: activePipeline?.executionModeCode ?? '—',
        retryPolicy: activePipeline?.retryPolicyText ?? '—',
        timeout: activePipeline?.timeoutText ?? '—',
        loggingLevel: activePipeline?.loggingLevelCode ?? '—',
        publishedState: activePipeline?.publishedStateCode ?? '—',
        lockState: activePipeline?.lockStateCode ?? '—',
    });
    useEffect(() => {
        setData(prev => ({
            ...prev,
            name: activePipeline?.name ?? '',
            description: activePipeline?.description ?? '',
            version: String(activePipeline?.version ?? '1'),
            createdOn: activePipeline?.createdAt ?? '—',
            updatedOn: activePipeline?.updatedAt ?? '—',
            project,
            folder,
        }));
    }, [activePipeline, project, folder]);
    const handleChange = (field, value) => {
        setData(prev => ({ ...prev, [field]: value }));
        if (field === 'name' || field === 'description') {
            dispatch(updateActivePipeline({ [field]: value }));
        }
        onDirty?.();
    };
    const F = (p) => (_jsx(Field, { label: p.label, value: data[p.field] ?? '', onChange: v => handleChange(p.field, v), ro: p.ro, ta: p.ta }));
    return (_jsx("div", { className: "flex-1 overflow-auto p-5", children: _jsxs("div", { className: "max-w-2xl space-y-4", children: [_jsx(F, { label: "Pipeline ID", field: "pipelineId", ro: true }), _jsx(F, { label: "Pipeline Name *", field: "name" }), _jsx(F, { label: "Description", field: "description", ta: true }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Project", field: "project", ro: true }), _jsx(F, { label: "Folder", field: "folder", ro: true })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Status", field: "status", ro: true }), _jsx(F, { label: "Owner", field: "owner" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Tags", field: "tags" }), _jsx(F, { label: "Labels", field: "labels" })] }), _jsxs("div", { className: "border-t border-slate-800 pt-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Runtime Engine", field: "runtimeEngine", ro: true }), _jsx(F, { label: "Execution Mode", field: "executionMode" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Retry Policy", field: "retryPolicy" }), _jsx(F, { label: "Timeout", field: "timeout" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Logging Level", field: "loggingLevel" }), _jsx(F, { label: "Published State", field: "publishedState", ro: true })] })] }), _jsxs("div", { className: "border-t border-slate-800 pt-4 grid grid-cols-2 gap-4", children: [_jsx(F, { label: "Created By", field: "createdBy", ro: true }), _jsx(F, { label: "Created On", field: "createdOn", ro: true }), _jsx(F, { label: "Updated By", field: "updatedBy", ro: true }), _jsx(F, { label: "Updated On", field: "updatedOn", ro: true }), _jsx(F, { label: "Last Opened By", field: "lastOpenedBy", ro: true }), _jsx(F, { label: "Last Opened On", field: "lastOpenedOn", ro: true }), _jsx(F, { label: "Last Executed By", field: "lastExecutedBy", ro: true }), _jsx(F, { label: "Last Executed On", field: "lastExecutedOn", ro: true }), _jsx(F, { label: "Last Success On", field: "lastSuccessOn", ro: true }), _jsx(F, { label: "Last Failed On", field: "lastFailedOn", ro: true }), _jsx(F, { label: "Version", field: "version", ro: true }), _jsx(F, { label: "Lock State", field: "lockState", ro: true })] })] }) }));
}
