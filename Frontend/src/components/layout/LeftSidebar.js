import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * LeftSidebar — Hierarchical tree explorer
 *
 * Design contract:
 *   • Project row quick-actions: Rename | New Folder | Delete  (NO pipeline/orch here)
 *   • Under each project (and each folder/sub-folder at every depth):
 *       ▸ Pipelines  [+]          ← folder_id IS NULL at project level
 *       ▸ Orchestrators  [+]      ← folder_id IS NULL at project level
 *       ▾ Folders  [+]
 *           ▾ FolderA  [new-sub | new-pipeline | new-orch | rename | delete]
 *               ▸ Pipelines  [+]
 *               ▸ Orchestrators  [+]
 *               ▾ SubFolder …
 *
 * This means pipelines and orchestrators are ALWAYS created and displayed
 * relative to a specific scope (project root OR a folder).
 * The "new pipeline" button on a folder creates a pipeline with that folder_id.
 * The "new pipeline" SubLabel at project root creates with folder_id = NULL.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, AlertCircle, ChevronDown, ChevronRight, Database, FolderOpen, Folder, FolderPlus, GitBranch, GitMerge, LayoutDashboard, Loader2, Pencil, Plug2, Plus, RefreshCw, Search, Settings, Shield, Trash2, Users, Workflow, Network, ExternalLink, Play, } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';
import { fetchProjects, fetchPipelinesForProject, fetchOrchestratorsForProject, fetchFoldersForProject, fetchFolderPipelines, fetchFolderOrchestrators, toggleProjectExpanded, openCreateProject, openCreatePipeline, openCreateOrchestrator, openCreateFolder, deleteProject, renameProject, deletePipeline, renamePipeline, deleteOrchestrator, renameOrchestrator, deleteFolder, renameFolder, } from '@/store/slices/projectsSlice';
import { fetchConnectors, openCreateConnection } from '@/store/slices/connectionsSlice';
import { CreateProjectDialog } from '@/components/dialogs/CreateProjectDialog';
import { CreatePipelineDialog } from '@/components/dialogs/CreatePipelineDialog';
import { CreateOrchestratorDialog } from '@/components/dialogs/CreateOrchestratorDialog';
import { CreateFolderDialog } from '@/components/dialogs/CreateFolderDialog';
import { CreateConnectionDialog } from '@/components/dialogs/CreateConnectionDialog';
import api from '@/services/api';
// ─── Inline rename ────────────────────────────────────────────────────────────
function InlineRename({ defaultValue, onCommit, onCancel, indent }) {
    const ref = useRef(null);
    const [val, setVal] = useState(defaultValue);
    useEffect(() => { setTimeout(() => ref.current?.select(), 30); }, []);
    return (_jsx("div", { className: "flex items-center h-7 px-1.5", style: { paddingLeft: indent }, children: _jsx("input", { ref: ref, autoFocus: true, value: val, onChange: e => setVal(e.target.value), onBlur: () => onCommit(val.trim() || defaultValue), onKeyDown: e => {
                if (e.key === 'Enter')
                    onCommit(val.trim() || defaultValue);
                if (e.key === 'Escape')
                    onCancel();
            }, className: "flex-1 bg-slate-700 border border-blue-500 rounded px-1.5 py-0.5 text-[12px] text-slate-100 outline-none min-w-0" }) }));
}
// ─── Icon button ──────────────────────────────────────────────────────────────
function Btn({ title, onClick, danger, children }) {
    return (_jsx("button", { title: title, onClick: e => { e.stopPropagation(); onClick(e); }, className: `w-4 h-4 flex items-center justify-center rounded flex-shrink-0 transition-colors
        ${danger ? 'text-slate-600 hover:bg-red-900/50 hover:text-red-400' : 'text-slate-600 hover:bg-slate-600 hover:text-slate-200'}`, children: children }));
}
function TreeItem({ depth, icon, label, isActive, isExpanded, hasChildren, isLoading, onPrimaryClick, actions, }) {
    const pl = 8 + depth * 16;
    return (_jsxs("div", { style: { paddingLeft: pl }, onClick: onPrimaryClick, className: `
        group/item relative flex items-center h-6 rounded-[3px] cursor-pointer select-none
        transition-colors duration-100 pr-1 overflow-hidden
        ${isActive
            ? 'bg-blue-600/20 text-blue-300'
            : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}
      `, children: [_jsx("span", { className: "w-4 h-4 flex items-center justify-center flex-shrink-0 mr-0.5", children: isLoading
                    ? _jsx(Loader2, { className: "w-3 h-3 animate-spin text-slate-600" })
                    : hasChildren
                        ? (isExpanded
                            ? _jsx(ChevronDown, { className: "w-3 h-3 text-slate-500" })
                            : _jsx(ChevronRight, { className: "w-3 h-3 text-slate-500" }))
                        : _jsx("span", { className: "w-3 h-3" }) }), _jsx("span", { className: "w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1", children: icon }), _jsx("span", { className: `flex-1 min-w-0 text-[12px] truncate leading-none ${isActive ? 'font-medium' : ''}`, children: label }), actions && (_jsx("span", { className: `
            absolute right-0 top-0 bottom-0
            flex items-center gap-0.5 px-1
            opacity-0 group-hover/item:opacity-100
            transition-opacity duration-100
            ${isActive ? 'bg-blue-600/20' : 'bg-slate-800'}
          `, onClick: e => e.stopPropagation(), children: actions }))] }));
}
function Section({ label, icon: Icon, iconColor, isExpanded, onToggle, onRefresh, onAdd, addTitle }) {
    return (_jsxs("div", { onClick: onToggle, className: "group/sec relative flex items-center h-6 px-2 rounded-[3px] cursor-pointer select-none\n        text-slate-300 hover:bg-slate-800/80 transition-colors overflow-hidden", children: [_jsx("span", { className: "w-4 h-4 flex items-center justify-center flex-shrink-0 mr-0.5", children: isExpanded
                    ? _jsx(ChevronDown, { className: "w-3 h-3 text-slate-500" })
                    : _jsx(ChevronRight, { className: "w-3 h-3 text-slate-500" }) }), _jsx("span", { className: "w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1", children: _jsx(Icon, { className: `w-3.5 h-3.5 ${iconColor}` }) }), _jsx("span", { className: "flex-1 min-w-0 text-[12px] font-semibold truncate", children: label }), (onRefresh || onAdd) && (_jsxs("span", { className: "absolute right-0 top-0 bottom-0 flex items-center gap-0.5 px-1\n            opacity-0 group-hover/sec:opacity-100 transition-opacity duration-100 bg-slate-800", onClick: e => e.stopPropagation(), children: [onRefresh && (_jsx(Btn, { title: "Refresh", onClick: () => onRefresh(), children: _jsx(RefreshCw, { className: "w-3 h-3" }) })), onAdd && (_jsx(Btn, { title: addTitle ?? 'Add', onClick: () => onAdd(), children: _jsx(Plus, { className: "w-3 h-3" }) }))] }))] }));
}
// ─── Flat nav row ─────────────────────────────────────────────────────────────
function NavRow({ icon: Icon, iconColor, label, isActive, onClick }) {
    return (_jsxs("div", { onClick: onClick, className: `flex items-center h-6 px-2 rounded-[3px] cursor-pointer select-none transition-colors
        ${isActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`, children: [_jsx("span", { className: "w-4 h-4 flex-shrink-0 mr-0.5" }), _jsx("span", { className: "w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1.5", children: _jsx(Icon, { className: `w-3.5 h-3.5 ${iconColor}` }) }), _jsx("span", { className: "flex-1 text-[12px] truncate", children: label })] }));
}
// ─── Sub-group label with (+) ─────────────────────────────────────────────────
function SubLabel({ label, depth, onAdd, addTitle }) {
    return (_jsxs("div", { className: "group/sub flex items-center h-5 text-[9px] uppercase tracking-[0.1em] text-slate-600 font-semibold", style: { paddingLeft: 8 + depth * 16 + 20 }, children: [_jsx("span", { className: "flex-1", children: label }), onAdd && (_jsx("button", { title: addTitle, onClick: e => { e.stopPropagation(); onAdd(); }, className: "opacity-0 group-hover/sub:opacity-100 mr-1 w-3.5 h-3.5 flex items-center justify-center\n            rounded text-slate-600 hover:text-slate-200 hover:bg-slate-700 transition-all", children: _jsx(Plus, { className: "w-2.5 h-2.5" }) }))] }));
}
function Divider() {
    return _jsx("div", { className: "mx-2 border-t border-slate-800 my-1" });
}
function EmptyHint({ depth, text }) {
    return (_jsx("div", { className: "h-5 flex items-center text-[11px] text-slate-700 italic", style: { paddingLeft: 8 + depth * 16 + 20 }, children: text }));
}
// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE ROW
// ─────────────────────────────────────────────────────────────────────────────
function PipelineRow({ pipeline, projectId, projectName, depth }) {
    const dispatch = useAppDispatch();
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
    const isActive = activeTab?.objectId === pipeline.pipelineId && activeTab?.type === 'pipeline';
    const [renaming, setRenaming] = useState(false);
    const open = useCallback(() => dispatch(openTab({
        id: `pipeline-${pipeline.pipelineId}`, type: 'pipeline',
        objectId: pipeline.pipelineId, objectName: pipeline.pipelineDisplayName,
        hierarchyPath: `Projects → ${projectName} → ${pipeline.pipelineDisplayName}`,
        unsaved: false, isDirty: false,
    })), [dispatch, pipeline, projectName]);
    const commitRename = (val) => {
        setRenaming(false);
        if (val !== pipeline.pipelineDisplayName)
            dispatch(renamePipeline({ projectId, pipelineId: pipeline.pipelineId, name: val }));
    };
    if (renaming)
        return (_jsx(InlineRename, { defaultValue: pipeline.pipelineDisplayName, onCommit: commitRename, onCancel: () => setRenaming(false), indent: 8 + depth * 16 + 20 }));
    return (_jsx(TreeItem, { depth: depth, icon: _jsx(Workflow, { className: "w-3.5 h-3.5 text-sky-400" }), label: pipeline.pipelineDisplayName, isActive: isActive, onPrimaryClick: open, actions: _jsxs(_Fragment, { children: [_jsx(Btn, { title: "Run pipeline", onClick: open, children: _jsx(Play, { className: "w-3 h-3 text-emerald-500" }) }), _jsx(Btn, { title: "Rename", onClick: () => setRenaming(true), children: _jsx(Pencil, { className: "w-3 h-3" }) }), _jsx(Btn, { title: "Delete", danger: true, onClick: () => {
                        if (window.confirm(`Delete pipeline "${pipeline.pipelineDisplayName}"?`))
                            dispatch(deletePipeline({ projectId, pipelineId: pipeline.pipelineId }));
                    }, children: _jsx(Trash2, { className: "w-3 h-3" }) })] }) }));
}
// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR ROW
// ─────────────────────────────────────────────────────────────────────────────
function OrchestratorRow({ orch, projectId, projectName, depth }) {
    const dispatch = useAppDispatch();
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
    const isActive = activeTab?.objectId === orch.orchId && activeTab?.type === 'orchestrator';
    const [renaming, setRenaming] = useState(false);
    const open = useCallback(() => dispatch(openTab({
        id: `orchestrator-${orch.orchId}`, type: 'orchestrator',
        objectId: orch.orchId, objectName: orch.orchDisplayName,
        hierarchyPath: `Projects → ${projectName} → ${orch.orchDisplayName}`,
        unsaved: false, isDirty: false,
    })), [dispatch, orch, projectName]);
    const commitRename = (val) => {
        setRenaming(false);
        if (val !== orch.orchDisplayName)
            dispatch(renameOrchestrator({ projectId, orchId: orch.orchId, name: val }));
    };
    if (renaming)
        return (_jsx(InlineRename, { defaultValue: orch.orchDisplayName, onCommit: commitRename, onCancel: () => setRenaming(false), indent: 8 + depth * 16 + 20 }));
    return (_jsx(TreeItem, { depth: depth, icon: _jsx(GitMerge, { className: "w-3.5 h-3.5 text-purple-400" }), label: orch.orchDisplayName, isActive: isActive, onPrimaryClick: open, actions: _jsxs(_Fragment, { children: [_jsx(Btn, { title: "Rename", onClick: () => setRenaming(true), children: _jsx(Pencil, { className: "w-3 h-3" }) }), _jsx(Btn, { title: "Delete", danger: true, onClick: () => {
                        if (window.confirm(`Delete orchestrator "${orch.orchDisplayName}"?`))
                            dispatch(deleteOrchestrator({ projectId, orchId: orch.orchId }));
                    }, children: _jsx(Trash2, { className: "w-3 h-3" }) })] }) }));
}
function ContentBlock({ projectId, projectName, depth, pipelines, orchestrators, isLoading, onNewPipeline, onNewOrchestrator, }) {
    if (isLoading) {
        return (_jsxs("div", { className: "flex items-center gap-1.5 h-6 text-[11px] text-slate-600", style: { paddingLeft: 8 + depth * 16 + 20 }, children: [_jsx(Loader2, { className: "w-3 h-3 animate-spin" }), " Loading\u2026"] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(SubLabel, { label: "Pipelines", depth: depth - 1, onAdd: onNewPipeline, addTitle: "New pipeline here" }), pipelines && pipelines.length === 0 && (_jsx(EmptyHint, { depth: depth, text: "No pipelines yet" })), pipelines && pipelines.map(p => (_jsx(PipelineRow, { pipeline: p, projectId: projectId, projectName: projectName, depth: depth }, p.pipelineId))), _jsx(SubLabel, { label: "Orchestrators", depth: depth - 1, onAdd: onNewOrchestrator, addTitle: "New orchestrator here" }), orchestrators && orchestrators.length === 0 && (_jsx(EmptyHint, { depth: depth, text: "No orchestrators yet" })), orchestrators && orchestrators.map(o => (_jsx(OrchestratorRow, { orch: o, projectId: projectId, projectName: projectName, depth: depth }, o.orchId)))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// FOLDER NODE — recursive, self-contained
// Owns its sub-folder children, pipelines, and orchestrators as local state
// (loaded lazily on first expand).
// ─────────────────────────────────────────────────────────────────────────────
function FolderNode({ folder, projectName, depth, }) {
    const dispatch = useAppDispatch();
    const [expanded, setExpanded] = useState(false);
    const [contentLoaded, setContentLoaded] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const subFolders = useAppSelector(s => (s.projects.foldersByProject[folder.projectId] ?? []).filter(f => f.parentFolderId === folder.folderId));
    const pipelines = useAppSelector(s => s.projects.pipelinesByFolder[folder.folderId] ?? []);
    const orchestrators = useAppSelector(s => s.projects.orchestratorsByFolder[folder.folderId] ?? []);
    const [renaming, setRenaming] = useState(false);
    const load = useCallback(async () => {
        setContentLoading(true);
        try {
            await Promise.all([
                dispatch(fetchFolderPipelines(folder.folderId)).unwrap(),
                dispatch(fetchFolderOrchestrators(folder.folderId)).unwrap(),
            ]);
            setContentLoaded(true);
        }
        catch {
            setContentLoaded(true);
        }
        finally {
            setContentLoading(false);
        }
    }, [dispatch, folder.folderId]);
    const toggle = () => {
        const next = !expanded;
        setExpanded(next);
        if (next && !contentLoaded)
            load();
    };
    const commitRename = (val) => {
        setRenaming(false);
        if (val !== folder.folderDisplayName)
            dispatch(renameFolder({ projectId: folder.projectId, folderId: folder.folderId, name: val }));
    };
    // When a new pipeline/orch is created inside this folder, add it to local state
    const handleNewPipeline = () => dispatch(openCreatePipeline({ projectId: folder.projectId, folderId: folder.folderId }));
    const handleNewOrchestrator = () => dispatch(openCreateOrchestrator({ projectId: folder.projectId, folderId: folder.folderId }));
    const handleNewSubFolder = () => dispatch(openCreateFolder({ projectId: folder.projectId, parentFolderId: folder.folderId }));
    if (renaming)
        return (_jsx(InlineRename, { defaultValue: folder.folderDisplayName, onCommit: commitRename, onCancel: () => setRenaming(false), indent: 8 + depth * 16 + 20 }));
    return (_jsxs(_Fragment, { children: [_jsx(TreeItem, { depth: depth, icon: expanded
                    ? _jsx(FolderOpen, { className: "w-3.5 h-3.5 text-sky-300" })
                    : _jsx(Folder, { className: "w-3.5 h-3.5 text-sky-400" }), label: folder.folderDisplayName, hasChildren: true, isExpanded: expanded, isLoading: contentLoading, onPrimaryClick: toggle, actions: _jsxs(_Fragment, { children: [_jsx(Btn, { title: "New pipeline in folder", onClick: handleNewPipeline, children: _jsx(Workflow, { className: "w-3 h-3 text-sky-500" }) }), _jsx(Btn, { title: "New orchestrator in folder", onClick: handleNewOrchestrator, children: _jsx(GitMerge, { className: "w-3 h-3 text-purple-400" }) }), _jsx(Btn, { title: "New sub-folder", onClick: handleNewSubFolder, children: _jsx(FolderPlus, { className: "w-3 h-3 text-sky-400" }) }), _jsx(Btn, { title: "Rename", onClick: () => setRenaming(true), children: _jsx(Pencil, { className: "w-3 h-3" }) }), _jsx(Btn, { title: "Delete folder", danger: true, onClick: () => {
                                if (window.confirm(`Delete folder "${folder.folderDisplayName}" and all its contents?`))
                                    dispatch(deleteFolder({ projectId: folder.projectId, folderId: folder.folderId }));
                            }, children: _jsx(Trash2, { className: "w-3 h-3" }) })] }) }), expanded && contentLoaded && (_jsxs(_Fragment, { children: [_jsx(ContentBlock, { projectId: folder.projectId, projectName: projectName, depth: depth + 1, pipelines: pipelines, orchestrators: orchestrators, isLoading: false, onNewPipeline: handleNewPipeline, onNewOrchestrator: handleNewOrchestrator }), subFolders.length > 0 && (_jsxs(_Fragment, { children: [_jsx(SubLabel, { label: "Sub-folders", depth: depth, onAdd: handleNewSubFolder, addTitle: "New sub-folder" }), subFolders.map(sf => (_jsx(FolderNode, { folder: sf, projectName: projectName, depth: depth + 1 }, sf.folderId)))] }))] })), expanded && contentLoading && (_jsxs("div", { className: "flex items-center gap-1.5 h-6 text-[11px] text-slate-600", style: { paddingLeft: 8 + (depth + 1) * 16 + 20 }, children: [_jsx(Loader2, { className: "w-3 h-3 animate-spin" }), " Loading\u2026"] }))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// PROJECT NODE
// Row quick-actions: Rename | New Folder | Delete
// Children: Pipelines (root) | Orchestrators (root) | Folders
// ─────────────────────────────────────────────────────────────────────────────
function ProjectNode({ project }) {
    const dispatch = useAppDispatch();
    const expanded = useAppSelector(s => s.projects.expandedProjectIds.includes(project.projectId));
    const pipelines = useAppSelector(s => s.projects.pipelinesByProject[project.projectId] ?? null);
    const orchestrators = useAppSelector(s => s.projects.orchestratorsByProject[project.projectId] ?? null);
    const folders = useAppSelector(s => s.projects.foldersByProject[project.projectId] ?? null);
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
    const isActive = activeTab?.objectId === project.projectId && activeTab?.type === 'project';
    const [renaming, setRenaming] = useState(false);
    const toggle = useCallback(() => {
        dispatch(toggleProjectExpanded(project.projectId));
        if (!expanded) {
            if (pipelines === null)
                dispatch(fetchPipelinesForProject(project.projectId));
            if (orchestrators === null)
                dispatch(fetchOrchestratorsForProject(project.projectId));
            if (folders === null)
                dispatch(fetchFoldersForProject(project.projectId));
        }
    }, [dispatch, project.projectId, expanded, pipelines, orchestrators, folders]);
    const commitRename = (val) => {
        setRenaming(false);
        if (val !== project.projectDisplayName)
            dispatch(renameProject({ id: project.projectId, name: val }));
    };
    if (renaming)
        return (_jsx(InlineRename, { defaultValue: project.projectDisplayName, onCommit: commitRename, onCancel: () => setRenaming(false), indent: 8 + 1 * 16 + 20 }));
    const isLoadingChildren = (pipelines === null || orchestrators === null) && expanded;
    return (_jsxs(_Fragment, { children: [_jsx(TreeItem, { depth: 1, icon: expanded
                    ? _jsx(FolderOpen, { className: "w-3.5 h-3.5 text-amber-400" })
                    : _jsx(Folder, { className: "w-3.5 h-3.5 text-amber-400" }), label: project.projectDisplayName, isActive: isActive, hasChildren: true, isExpanded: expanded, isLoading: isLoadingChildren, onPrimaryClick: toggle, actions: _jsxs(_Fragment, { children: [_jsx(Btn, { title: "Rename project", onClick: () => setRenaming(true), children: _jsx(Pencil, { className: "w-2.5 h-2.5" }) }), _jsx(Btn, { title: "New folder in project", onClick: () => dispatch(openCreateFolder({ projectId: project.projectId })), children: _jsx(FolderPlus, { className: "w-2.5 h-2.5 text-sky-400" }) }), _jsx(Btn, { title: "Delete project", danger: true, onClick: () => {
                                if (window.confirm(`Delete project "${project.projectDisplayName}" and all its contents?`))
                                    dispatch(deleteProject(project.projectId));
                            }, children: _jsx(Trash2, { className: "w-2.5 h-2.5" }) })] }) }), expanded && (_jsxs(_Fragment, { children: [_jsx(ContentBlock, { projectId: project.projectId, projectName: project.projectDisplayName, depth: 2, pipelines: pipelines, orchestrators: orchestrators, isLoading: isLoadingChildren, onNewPipeline: () => dispatch(openCreatePipeline({ projectId: project.projectId, folderId: null })), onNewOrchestrator: () => dispatch(openCreateOrchestrator({ projectId: project.projectId, folderId: null })) }), !isLoadingChildren && folders !== null && (_jsxs(_Fragment, { children: [_jsx(SubLabel, { label: "Folders", depth: 1, onAdd: () => dispatch(openCreateFolder({ projectId: project.projectId })), addTitle: "New folder" }), folders.length === 0 && (_jsx(EmptyHint, { depth: 2, text: "No folders yet" })), folders.map(f => (_jsx(FolderNode, { folder: f, projectName: project.projectDisplayName, depth: 2 }, f.folderId)))] }))] }))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIONS SECTION
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionsSection() {
    const dispatch = useAppDispatch();
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
    const { connectors, isLoading } = useAppSelector(s => s.connections);
    const [expanded, setExpanded] = useState(false);
    const toggle = () => {
        if (!expanded && connectors.length === 0)
            dispatch(fetchConnectors());
        setExpanded(v => !v);
    };
    const openConnection = useCallback((c) => {
        dispatch(openTab({
            id: `connection-${c.connectorId}`, type: 'connection',
            objectId: c.connectorId, objectName: c.connectorDisplayName,
            hierarchyPath: `Connections → ${c.connectorDisplayName}`,
            unsaved: false, isDirty: false,
        }));
    }, [dispatch]);
    const healthDot = (code) => code === 'HEALTHY' ? 'bg-emerald-400' : code === 'DEGRADED' ? 'bg-amber-400' : 'bg-slate-600';
    return (_jsxs(_Fragment, { children: [_jsx(Section, { label: "Connections", icon: Plug2, iconColor: "text-emerald-400", isExpanded: expanded, onToggle: toggle, onRefresh: () => dispatch(fetchConnectors()), onAdd: () => dispatch(openCreateConnection()), addTitle: "New connection" }), expanded && (_jsxs(_Fragment, { children: [isLoading && (_jsxs("div", { className: "flex items-center gap-1.5 h-6 text-[11px] text-slate-600", style: { paddingLeft: 8 + 1 * 16 + 20 }, children: [_jsx(Loader2, { className: "w-3 h-3 animate-spin" }), " Loading\u2026"] })), !isLoading && connectors.length === 0 && (_jsx("div", { className: "h-6 flex items-center text-[11px] text-slate-700 italic", style: { paddingLeft: 8 + 1 * 16 + 20 }, children: "No connections \u2014 click + to add" })), connectors.map(c => {
                        const isConn = activeTab?.objectId === c.connectorId && activeTab?.type === 'connection';
                        return (_jsx(TreeItem, { depth: 1, icon: _jsxs("span", { className: "relative", children: [_jsx(Network, { className: "w-3.5 h-3.5 text-emerald-500" }), _jsx("span", { className: `absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#0f1117] ${healthDot(c.healthStatusCode)}` })] }), label: c.connectorDisplayName, isActive: isConn, onPrimaryClick: () => openConnection(c), actions: _jsx(Btn, { title: "Open connection details", onClick: () => openConnection(c), children: _jsx(ExternalLink, { className: "w-3 h-3" }) }) }, c.connectorId));
                    })] }))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// USERS SECTION
// ─────────────────────────────────────────────────────────────────────────────
function UsersSection() {
    const dispatch = useAppDispatch();
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
    const [expanded, setExpanded] = useState(false);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const load = async () => {
        setLoading(true);
        try {
            const res = await api.getUsers();
            const data = res.data?.data ?? [];
            setUsers(data.map((u) => ({ id: u.userId ?? u.user_id, name: u.displayName ?? u.user_full_name ?? u.email_address })));
        }
        catch { /* governance may not be set up yet */ }
        finally {
            setLoading(false);
        }
    };
    const toggle = () => { const next = !expanded; setExpanded(next); if (next && users.length === 0)
        load(); };
    return (_jsxs(_Fragment, { children: [_jsx(Section, { label: "Users", icon: Users, iconColor: "text-rose-400", isExpanded: expanded, onToggle: toggle, onRefresh: expanded ? load : undefined, onAdd: () => dispatch(openTab({ id: 'governance-users', type: 'governance', objectId: 'users', objectName: 'Users', unsaved: false, isDirty: false })), addTitle: "Manage users" }), expanded && (_jsxs(_Fragment, { children: [loading && _jsxs("div", { className: "flex items-center gap-1.5 h-6 text-[11px] text-slate-600", style: { paddingLeft: 8 + 1 * 16 + 20 }, children: [_jsx(Loader2, { className: "w-3 h-3 animate-spin" }), " Loading\u2026"] }), !loading && users.length === 0 && _jsx("div", { className: "h-6 flex items-center text-[11px] text-slate-700 italic", style: { paddingLeft: 8 + 1 * 16 + 20 }, children: "No users found" }), !loading && users.map(u => (_jsx(TreeItem, { depth: 1, icon: _jsx(Users, { className: "w-3 h-3 text-rose-400" }), label: u.name, isActive: activeTab?.objectId === u.id && activeTab?.type === 'user', onPrimaryClick: () => dispatch(openTab({ id: `user-${u.id}`, type: 'user', objectId: u.id, objectName: u.name, hierarchyPath: `Users → ${u.name}`, unsaved: false, isDirty: false })) }, u.id)))] }))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// ROLES SECTION
// ─────────────────────────────────────────────────────────────────────────────
function RolesSection() {
    const dispatch = useAppDispatch();
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
    const [expanded, setExpanded] = useState(false);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const load = async () => {
        setLoading(true);
        try {
            const res = await api.getRoles();
            const data = res.data?.data ?? [];
            setRoles(data.map((r) => ({ id: r.roleId ?? r.role_id, name: r.roleName ?? r.role_display_name })));
        }
        catch { /* governance may not be set up yet */ }
        finally {
            setLoading(false);
        }
    };
    const toggle = () => { const next = !expanded; setExpanded(next); if (next && roles.length === 0)
        load(); };
    return (_jsxs(_Fragment, { children: [_jsx(Section, { label: "Roles", icon: Shield, iconColor: "text-orange-400", isExpanded: expanded, onToggle: toggle, onRefresh: expanded ? load : undefined, onAdd: () => dispatch(openTab({ id: 'governance-roles', type: 'governance', objectId: 'roles', objectName: 'Roles', unsaved: false, isDirty: false })), addTitle: "Manage roles" }), expanded && (_jsxs(_Fragment, { children: [loading && _jsxs("div", { className: "flex items-center gap-1.5 h-6 text-[11px] text-slate-600", style: { paddingLeft: 8 + 1 * 16 + 20 }, children: [_jsx(Loader2, { className: "w-3 h-3 animate-spin" }), " Loading\u2026"] }), !loading && roles.length === 0 && _jsx("div", { className: "h-6 flex items-center text-[11px] text-slate-700 italic", style: { paddingLeft: 8 + 1 * 16 + 20 }, children: "No roles found" }), !loading && roles.map(r => (_jsx(TreeItem, { depth: 1, icon: _jsx(Shield, { className: "w-3 h-3 text-orange-400" }), label: r.name, isActive: activeTab?.objectId === r.id && activeTab?.type === 'role', onPrimaryClick: () => dispatch(openTab({ id: `role-${r.id}`, type: 'role', objectId: r.id, objectName: r.name, hierarchyPath: `Roles → ${r.name}`, unsaved: false, isDirty: false })) }, r.id)))] }))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// MAIN SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
export function LeftSidebar() {
    const dispatch = useAppDispatch();
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
    const { projects, isLoading, error } = useAppSelector(s => s.projects);
    const createProjectOpen = useAppSelector(s => s.projects.createProjectOpen);
    const createPipelineOpen = useAppSelector(s => s.projects.createPipelineOpen);
    const createOrchestratorOpen = useAppSelector(s => s.projects.createOrchestratorOpen);
    const createFolderOpen = useAppSelector(s => s.projects.createFolderOpen);
    const createConnectionOpen = useAppSelector(s => s.connections.createConnectionOpen);
    const [projectsExpanded, setProjectsExpanded] = useState(true);
    const [globalPipelinesExpanded, setGlobalPipelinesExpanded] = useState(false);
    const [globalOrchsExpanded, setGlobalOrchsExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const [globalPipelines, setGlobalPipelines] = useState([]);
    const [globalOrchestrators, setGlobalOrchestrators] = useState([]);
    const [loadingGlobalPipelines, setLoadingGlobalPipelines] = useState(false);
    const [loadingGlobalOrchestrators, setLoadingGlobalOrchestrators] = useState(false);
    useEffect(() => { dispatch(fetchProjects()); }, [dispatch]);
    // Load global pipelines when section expanded
    useEffect(() => {
        if (!globalPipelinesExpanded || loadingGlobalPipelines)
            return;
        setLoadingGlobalPipelines(true);
        Promise.all(projects.map(p => api.getPipelinesForProject(p.projectId)
            .then(res => {
            const items = res.data?.data ?? res.data ?? [];
            return (Array.isArray(items) ? items : []).map((pl) => ({
                id: pl.pipeline_id ?? pl.pipelineId,
                name: pl.pipeline_display_name ?? pl.name ?? 'Unnamed',
                projectName: p.projectDisplayName,
            }));
        })
            .catch(() => []))).then(results => {
            setGlobalPipelines(results.flat());
            setLoadingGlobalPipelines(false);
        });
    }, [globalPipelinesExpanded, projects]);
    // Load global orchestrators when section expanded
    useEffect(() => {
        if (!globalOrchsExpanded || loadingGlobalOrchestrators)
            return;
        setLoadingGlobalOrchestrators(true);
        Promise.all(projects.map(p => api.getOrchestratorsForProject(p.projectId)
            .then(res => {
            const items = res.data?.data ?? res.data ?? [];
            return (Array.isArray(items) ? items : []).map((o) => ({
                id: o.orch_id ?? o.orchestratorId,
                name: o.orch_display_name ?? o.name ?? 'Unnamed',
                projectName: p.projectDisplayName,
            }));
        })
            .catch(() => []))).then(results => {
            setGlobalOrchestrators(results.flat());
            setLoadingGlobalOrchestrators(false);
        });
    }, [globalOrchsExpanded, projects]);
    const isType = (t) => activeTab?.type === t;
    const openNav = (id, type, name) => dispatch(openTab({ id, type: type, objectId: id, objectName: name, unsaved: false, isDirty: false }));
    const filtered = search.trim()
        ? projects.filter(p => p.projectDisplayName.toLowerCase().includes(search.toLowerCase()))
        : projects;
    return (_jsxs(_Fragment, { children: [_jsxs("aside", { className: "flex flex-col h-full bg-[#0f1117] border-r border-slate-800/60 overflow-hidden", style: { minWidth: 0 }, children: [_jsx("div", { className: "px-2 pt-2 pb-1.5 flex-shrink-0", children: _jsxs("div", { className: "flex items-center gap-1.5 h-7 bg-slate-800/50 border border-slate-700/50 rounded px-2", children: [_jsx(Search, { className: "w-3 h-3 text-slate-600 flex-shrink-0" }), _jsx("input", { type: "text", value: search, onChange: e => setSearch(e.target.value), placeholder: "Filter tree\u2026", className: "flex-1 bg-transparent text-[12px] text-slate-300 placeholder-slate-600 outline-none min-w-0" }), search && (_jsx("button", { onClick: () => setSearch(''), className: "text-slate-600 hover:text-slate-300 text-[11px]", children: "\u2715" }))] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto overflow-x-hidden px-1 pb-2 min-h-0 space-y-0.5", children: [_jsx(Section, { label: "Projects", icon: FolderOpen, iconColor: "text-amber-400", isExpanded: projectsExpanded, onToggle: () => setProjectsExpanded(v => !v), onRefresh: () => dispatch(fetchProjects()), onAdd: () => dispatch(openCreateProject()), addTitle: "New project" }), projectsExpanded && (_jsxs("div", { className: "space-y-0.5", children: [isLoading && (_jsxs("div", { className: "flex items-center gap-1.5 h-6 text-[11px] text-slate-600 px-9", children: [_jsx(Loader2, { className: "w-3 h-3 animate-spin" }), " Loading projects\u2026"] })), !isLoading && error && (_jsxs("div", { className: "mx-2 px-2 py-1.5 bg-red-950/40 border border-red-900/30 rounded flex items-start gap-1.5 text-[11px] text-red-400", children: [_jsx(AlertCircle, { className: "w-3 h-3 mt-0.5 flex-shrink-0" }), " ", error] })), !isLoading && !error && projects.length === 0 && (_jsxs("button", { onClick: () => dispatch(openCreateProject()), className: "flex items-center gap-1.5 h-7 text-[11px] text-blue-400 hover:text-blue-300 px-9", children: [_jsx(Plus, { className: "w-3 h-3" }), " Create first project"] })), !isLoading && filtered.map(p => (_jsx(ProjectNode, { project: p }, p.projectId))), !isLoading && search && filtered.length === 0 && projects.length > 0 && (_jsxs("div", { className: "px-9 py-1 text-[11px] text-slate-600 italic", children: ["No match for \"", search, "\""] }))] })), _jsx(Section, { label: "Global Pipelines", icon: Workflow, iconColor: "text-sky-400", isExpanded: globalPipelinesExpanded, onToggle: () => setGlobalPipelinesExpanded(v => !v), onAdd: () => { }, addTitle: "New global pipeline" }), globalPipelinesExpanded && (loadingGlobalPipelines ? (_jsx("div", { className: "px-9 py-1 text-[11px] text-slate-600 italic", children: "Loading\u2026" })) : globalPipelines.length === 0 ? (_jsx(EmptyHint, { depth: 1, text: "No global pipelines yet" })) : (_jsx("div", { children: globalPipelines.map(pl => (_jsxs("button", { onClick: () => dispatch(openTab({ id: `pipeline-${pl.id}`, type: 'pipeline', objectId: pl.id, objectName: pl.name, unsaved: false, isDirty: false })), className: "w-full flex items-center gap-2 px-9 py-1 text-[12px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors", children: [_jsx(Workflow, { className: "w-3.5 h-3.5 text-sky-500 flex-shrink-0" }), _jsx("span", { className: "truncate", children: pl.name }), _jsx("span", { className: "text-[10px] text-slate-600 ml-auto truncate", children: pl.projectName })] }, pl.id))) }))), _jsx(Section, { label: "Global Orchestrators", icon: GitMerge, iconColor: "text-purple-400", isExpanded: globalOrchsExpanded, onToggle: () => setGlobalOrchsExpanded(v => !v), onAdd: () => { }, addTitle: "New global orchestrator" }), globalOrchsExpanded && (loadingGlobalOrchestrators ? (_jsx("div", { className: "px-9 py-1 text-[11px] text-slate-600 italic", children: "Loading\u2026" })) : globalOrchestrators.length === 0 ? (_jsx(EmptyHint, { depth: 1, text: "No global orchestrators yet" })) : (_jsx("div", { children: globalOrchestrators.map(o => (_jsxs("button", { onClick: () => dispatch(openTab({ id: `orchestrator-${o.id}`, type: 'orchestrator', objectId: o.id, objectName: o.name, unsaved: false, isDirty: false })), className: "w-full flex items-center gap-2 px-9 py-1 text-[12px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors", children: [_jsx(GitMerge, { className: "w-3.5 h-3.5 text-purple-500 flex-shrink-0" }), _jsx("span", { className: "truncate", children: o.name }), _jsx("span", { className: "text-[10px] text-slate-600 ml-auto truncate", children: o.projectName })] }, o.id))) }))), _jsx(Divider, {}), _jsx(ConnectionsSection, {}), _jsx(NavRow, { icon: Database, iconColor: "text-violet-400", label: "Metadata Catalog", isActive: isType('metadata'), onClick: () => openNav('metadata', 'metadata', 'Metadata Catalog') }), _jsx(NavRow, { icon: GitBranch, iconColor: "text-teal-400", label: "Lineage", isActive: isType('lineage'), onClick: () => openNav('lineage', 'lineage', 'Lineage') }), _jsx(Divider, {}), _jsx(UsersSection, {}), _jsx(RolesSection, {}), _jsx(Divider, {}), _jsx(NavRow, { icon: Activity, iconColor: isType('monitor') ? 'text-blue-400' : 'text-sky-500', label: "Monitor", isActive: isType('monitor'), onClick: () => openNav('monitor', 'monitor', 'Monitor') }), _jsx(NavRow, { icon: LayoutDashboard, iconColor: "text-slate-500", label: "Dashboard", isActive: isType('dashboard'), onClick: () => openNav('dashboard', 'dashboard', 'Dashboard') })] }), _jsx("div", { className: "border-t border-slate-800/60 px-1 py-1 flex-shrink-0", children: _jsx(NavRow, { icon: Settings, iconColor: isType('settings') ? 'text-blue-400' : 'text-slate-500', label: "Settings", isActive: isType('settings'), onClick: () => openNav('settings', 'settings', 'Settings') }) })] }), createProjectOpen && _jsx(CreateProjectDialog, {}), createPipelineOpen && _jsx(CreatePipelineDialog, {}), createOrchestratorOpen && _jsx(CreateOrchestratorDialog, {}), createFolderOpen && _jsx(CreateFolderDialog, {}), createConnectionOpen && _jsx(CreateConnectionDialog, {})] }));
}
