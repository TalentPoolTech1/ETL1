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
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Activity, AlertCircle, ChevronDown, ChevronRight,
  Database, FolderOpen, Folder, FolderPlus,
  GitBranch, GitMerge,
  LayoutDashboard, Loader2, Pencil, Plug2, Plus,
  RefreshCw, Search, Settings, Shield, Trash2,
  Users, Workflow, Network, ExternalLink, Play, Layers, Eye,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';
import { openMetadataPreview } from '@/store/slices/uiSlice';
import {
  fetchProjects, fetchPipelinesForProject, fetchOrchestratorsForProject,
  fetchFoldersForProject, fetchFolderPipelines, fetchFolderOrchestrators,
  toggleProjectExpanded, openCreateProject, openCreatePipeline,
  openCreateOrchestrator, openCreateFolder,
  fetchGlobalPipelines, fetchGlobalOrchestrators,
  deleteProject, renameProject,
  deletePipeline, renamePipeline, deleteOrchestrator, renameOrchestrator,
  deleteFolder, renameFolder,
} from '@/store/slices/projectsSlice';
import { fetchConnectorsByTech, evictTechSlot, openCreateConnection, fetchTechnologies, deleteConnector } from '@/store/slices/connectionsSlice';
import { connectorCache } from '@/utils/connectorCache';
import { CreateProjectDialog }      from '@/components/dialogs/CreateProjectDialog';
import { CreatePipelineDialog }     from '@/components/dialogs/CreatePipelineDialog';
import { CreateOrchestratorDialog }  from '@/components/dialogs/CreateOrchestratorDialog';
import { CreateFolderDialog }       from '@/components/dialogs/CreateFolderDialog';
import { CreateConnectionDialog }   from '@/components/dialogs/CreateConnectionDialog';
import type { PipelineSummary, OrchestratorSummary, FolderSummary } from '@/store/slices/projectsSlice';
import api from '@/services/api';

// ─── Inline rename ────────────────────────────────────────────────────────────

function InlineRename({ defaultValue, onCommit, onCancel, indent }: {
  defaultValue: string; onCommit: (v: string) => void; onCancel: () => void; indent: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState(defaultValue);
  useEffect(() => { setTimeout(() => ref.current?.select(), 30); }, []);
  return (
    <div className="flex items-center h-[22px] px-1.5" style={{ paddingLeft: indent }}>
      <input ref={ref} autoFocus value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => onCommit(val.trim() || defaultValue)}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommit(val.trim() || defaultValue);
          if (e.key === 'Escape') onCancel();
        }}
        className="flex-1 bg-slate-700 border border-blue-500 rounded px-1.5 py-0.5 text-[12px] text-slate-100 outline-none min-w-0"
      />
    </div>
  );
}

// ─── Icon button ──────────────────────────────────────────────────────────────

function Btn({ title, onClick, danger, success, children, icon: Icon }: {
  title: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; success?: boolean; children?: React.ReactNode; icon?: React.ElementType;
}) {
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick(e); }}
      className={`w-3.5 h-3.5 flex items-center justify-center rounded flex-shrink-0 transition-all duration-200 text-slate-400
        ${danger ? 'hover:bg-red-950/40 hover:text-red-400' :
          success ? 'hover:bg-emerald-950/40 hover:text-emerald-400' :
          'hover:bg-slate-700/60 hover:text-slate-200'}`}
    >
      {Icon ? <Icon className="w-2.5 h-2.5" strokeWidth={1.5} /> : children}
    </button>
  );
}

// ─── Generic tree item ────────────────────────────────────────────────────────

interface TreeItemProps {
  depth: number;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  isLoading?: boolean;
  onPrimaryClick: () => void;
  actions?: React.ReactNode;
}

function TreeItem({
  depth, icon, label, isActive, isExpanded, hasChildren, isLoading, onPrimaryClick, actions,
}: TreeItemProps) {
  const pl = 4 + depth * 12;
  return (
    <div
      style={{ paddingLeft: pl }}
      onClick={onPrimaryClick}
      className={`
        group/item relative flex items-center h-[22px] rounded-[2px] cursor-pointer select-none
        transition-colors duration-75 pr-1 overflow-hidden
        ${isActive
          ? 'bg-blue-600/20 text-blue-300'
          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}
      `}
    >
      <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
        {isLoading
          ? <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-600" />
          : hasChildren
            ? (isExpanded
              ? <ChevronDown className="w-2.5 h-2.5 text-slate-500" strokeWidth={1.5} />
              : <ChevronRight className="w-2.5 h-2.5 text-slate-500" strokeWidth={1.5} />)
            : <span className="w-2.5 h-2.5" />
        }
      </span>
      <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 mr-0.5">
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement, { strokeWidth: 1.2 } as any)
          : icon}
      </span>
      <span className={`flex-1 min-w-0 text-[12px] truncate leading-none ${isActive ? 'font-medium' : ''}`}>
        {label}
      </span>
      {actions && (
        <span
          className={`
            absolute right-0 top-0 bottom-0
            flex items-center gap-0.5 px-0.5
            opacity-0 group-hover/item:opacity-100
            transition-opacity duration-100
            ${isActive ? 'bg-blue-600/20' : 'bg-slate-800'}
          `}
          onClick={e => e.stopPropagation()}
        >
          {actions}
        </span>
      )}
    </div>
  );
}

// ─── Section header (root level) ─────────────────────────────────────────────

interface SectionProps {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh?: () => void;
  onAdd?: () => void;
  addTitle?: string;
}

function Section({ label, icon: Icon, iconColor, isExpanded, onToggle, onRefresh, onAdd, addTitle }: SectionProps) {
  return (
    <div
      onClick={onToggle}
      className="group/sec relative flex items-center h-[22px] px-1.5 rounded-[2px] cursor-pointer select-none
        text-slate-400 font-medium hover:bg-slate-800/80 transition-colors overflow-hidden"
    >
      <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
        {isExpanded
          ? <ChevronDown className="w-2.5 h-2.5 text-slate-600" strokeWidth={1.5} />
          : <ChevronRight className="w-2.5 h-2.5 text-slate-600" strokeWidth={1.5} />}
      </span>
      <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 mr-0.5">
        <Icon className={`w-3 h-3 ${iconColor}`} strokeWidth={1.5} />
      </span>
      <span className="flex-1 min-w-0 text-[12px] font-semibold truncate">{label}</span>
      {(onRefresh || onAdd) && (
        <span
          className="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 px-0.5
            opacity-0 group-hover/sec:opacity-100 transition-opacity duration-100 bg-slate-800"
          onClick={e => e.stopPropagation()}>
          {onRefresh && (
            <Btn title="Refresh" onClick={() => onRefresh()} icon={RefreshCw} />
          )}
          {onAdd && (
            <Btn title={addTitle ?? 'Add'} onClick={() => onAdd()} icon={Plus} />
          )}
        </span>
      )}
    </div>
  );
}

// ─── Flat nav row ─────────────────────────────────────────────────────────────

function NavRow({ icon: Icon, iconColor, label, isActive, onClick }: {
  icon: React.ElementType; iconColor: string; label: string; isActive?: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center h-[22px] px-1.5 rounded-[2px] cursor-pointer select-none transition-all
        ${isActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
    >
      <span className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 mr-0.5">
        <Icon className={`w-3 h-3 ${iconColor}`} strokeWidth={1.5} />
      </span>
      <span className="flex-1 text-[12px] truncate">{label}</span>
    </div>
  );
}

// ─── Sub-group label with (+) ─────────────────────────────────────────────────

function SubLabel({ label, depth, onAdd, addTitle }: {
  label: string; depth: number; onAdd?: () => void; addTitle?: string;
}) {
  return (
    <div
      className="group/sub flex items-center h-[18px] text-[8px] uppercase tracking-[0.08em] text-slate-600 font-bold"
      style={{ paddingLeft: 4 + depth * 12 + 18 }}
    >
      <span className="flex-1">{label}</span>
      {onAdd && (
        <button
          title={addTitle}
          onClick={e => { e.stopPropagation(); onAdd(); }}
          className="opacity-20 group-hover/sub:opacity-100 mr-1 w-3 h-3 flex items-center justify-center
            rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
        >
          <Plus className="w-2.5 h-2.5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

function Divider() {
  return <div className="mx-2 border-t border-slate-800 my-1" />;
}

function EmptyHint({ depth, text }: { depth: number; text: string }) {
  return (
    <div className="h-[18px] flex items-center text-[11px] text-slate-700/60 italic"
      style={{ paddingLeft: 4 + depth * 12 + 18 }}>
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE ROW
// ─────────────────────────────────────────────────────────────────────────────

function PipelineRow({ pipeline, projectId, projectName, depth }: {
  pipeline: PipelineSummary; projectId: string; projectName: string; depth: number;
}) {
  const dispatch  = useAppDispatch();
  const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
  const isActive  = activeTab?.objectId === pipeline.pipelineId && activeTab?.type === 'pipeline';
  const [renaming, setRenaming] = useState(false);

  const open = useCallback(() => dispatch(openTab({
    id: `pipeline-${pipeline.pipelineId}`, type: 'pipeline',
    objectId: pipeline.pipelineId, objectName: pipeline.pipelineDisplayName,
    hierarchyPath: `Projects → ${projectName} → ${pipeline.pipelineDisplayName}`,
    unsaved: false, isDirty: false,
  })), [dispatch, pipeline, projectName]);

  const commitRename = (val: string) => {
    setRenaming(false);
    if (val !== pipeline.pipelineDisplayName)
      dispatch(renamePipeline({ projectId, pipelineId: pipeline.pipelineId, name: val }));
  };

  if (renaming) return (
    <InlineRename
      defaultValue={pipeline.pipelineDisplayName}
      onCommit={commitRename}
      onCancel={() => setRenaming(false)}
      indent={4 + depth * 12 + 18}
    />
  );

  return (
    <TreeItem
      depth={depth}
      icon={<Workflow className="w-3 h-3 text-sky-400" strokeWidth={1.5} />}
      label={pipeline.pipelineDisplayName}
      isActive={isActive}
      onPrimaryClick={open}
      actions={<>
        <Btn title="Run pipeline" onClick={open} success icon={Play} />
        <Btn title="Rename" onClick={() => setRenaming(true)} icon={Pencil} />
        <Btn title="Delete" danger onClick={() => {
          if (window.confirm(`Delete pipeline "${pipeline.pipelineDisplayName}"?`))
            dispatch(deletePipeline({ projectId, pipelineId: pipeline.pipelineId }));
        }} icon={Trash2} />
      </>}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR ROW
// ─────────────────────────────────────────────────────────────────────────────

function OrchestratorRow({ orch, projectId, projectName, depth }: {
  orch: OrchestratorSummary; projectId: string; projectName: string; depth: number;
}) {
  const dispatch  = useAppDispatch();
  const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
  const isActive  = activeTab?.objectId === orch.orchId && activeTab?.type === 'orchestrator';
  const [renaming, setRenaming] = useState(false);

  const open = useCallback(() => dispatch(openTab({
    id: `orchestrator-${orch.orchId}`, type: 'orchestrator',
    objectId: orch.orchId, objectName: orch.orchDisplayName,
    hierarchyPath: `Projects → ${projectName} → ${orch.orchDisplayName}`,
    unsaved: false, isDirty: false,
  })), [dispatch, orch, projectName]);

  const commitRename = (val: string) => {
    setRenaming(false);
    if (val !== orch.orchDisplayName)
      dispatch(renameOrchestrator({ projectId, orchId: orch.orchId, name: val }));
  };

  if (renaming) return (
    <InlineRename
      defaultValue={orch.orchDisplayName}
      onCommit={commitRename}
      onCancel={() => setRenaming(false)}
      indent={4 + depth * 12 + 18}
    />
  );

  return (
    <TreeItem
      depth={depth}
      icon={<GitMerge className="w-3 h-3 text-purple-400" strokeWidth={1.5} />}
      label={orch.orchDisplayName}
      isActive={isActive}
      onPrimaryClick={open}
      actions={<>
        <Btn title="Rename" onClick={() => setRenaming(true)} icon={Pencil} />
        <Btn title="Delete" danger onClick={() => {
          if (window.confirm(`Delete orchestrator "${orch.orchDisplayName}"?`))
            dispatch(deleteOrchestrator({ projectId, orchId: orch.orchId }));
        }} icon={Trash2} />
      </>}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINES + ORCHESTRATORS BLOCK
// Reused at both project-root level (from Redux) and folder level (local state)
// ─────────────────────────────────────────────────────────────────────────────

interface ContentBlockProps {
  projectId: string;
  projectName: string;
  depth: number;
  pipelines: PipelineSummary[] | null;
  orchestrators: OrchestratorSummary[] | null;
  isLoading: boolean;
  onNewPipeline: () => void;
  onNewOrchestrator: () => void;
}

function ContentBlock({
  projectId, projectName, depth,
  pipelines, orchestrators, isLoading,
  onNewPipeline, onNewOrchestrator,
}: ContentBlockProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1 h-[22px] text-[11px] text-slate-600"
        style={{ paddingLeft: 4 + depth * 12 + 18 }}>
        <Loader2 className="w-2.5 h-2.5 animate-spin" strokeWidth={1.5} /> Loading…
      </div>
    );
  }

  return (
    <>
      {/* Pipelines sub-group */}
      <SubLabel label="Pipelines" depth={depth - 1} onAdd={onNewPipeline} addTitle="New pipeline here" />
      {pipelines && pipelines.length === 0 && (
        <EmptyHint depth={depth} text="No pipelines yet" />
      )}
      {pipelines && pipelines.map(p => (
        <PipelineRow key={p.pipelineId} pipeline={p} projectId={projectId} projectName={projectName} depth={depth} />
      ))}

      {/* Orchestrators sub-group */}
      <SubLabel label="Orchestrators" depth={depth - 1} onAdd={onNewOrchestrator} addTitle="New orchestrator here" />
      {orchestrators && orchestrators.length === 0 && (
        <EmptyHint depth={depth} text="No orchestrators yet" />
      )}
      {orchestrators && orchestrators.map(o => (
        <OrchestratorRow key={o.orchId} orch={o} projectId={projectId} projectName={projectName} depth={depth} />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLDER NODE — recursive, self-contained
// Owns its sub-folder children, pipelines, and orchestrators as local state
// (loaded lazily on first expand).
// ─────────────────────────────────────────────────────────────────────────────

function FolderNode({
  folder, projectName, depth,
}: {
  folder: FolderSummary;
  projectName: string;
  depth: number;
}) {
  const dispatch = useAppDispatch();

  const [expanded, setExpanded]             = useState(false);
  const [contentLoaded, setContentLoaded]   = useState(false);
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
    } catch {
      setContentLoaded(true);
    } finally {
      setContentLoading(false);
    }
  }, [dispatch, folder.folderId]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !contentLoaded) load();
  };

  const commitRename = (val: string) => {
    setRenaming(false);
    if (val !== folder.folderDisplayName)
      dispatch(renameFolder({ projectId: folder.projectId, folderId: folder.folderId, name: val }));
  };

  // When a new pipeline/orch is created inside this folder, add it to local state
  const handleNewPipeline = () =>
    dispatch(openCreatePipeline({ projectId: folder.projectId, folderId: folder.folderId }));

  const handleNewOrchestrator = () =>
    dispatch(openCreateOrchestrator({ projectId: folder.projectId, folderId: folder.folderId }));

  const handleNewSubFolder = () =>
    dispatch(openCreateFolder({ projectId: folder.projectId, parentFolderId: folder.folderId }));

  if (renaming) return (
    <InlineRename
      defaultValue={folder.folderDisplayName}
      onCommit={commitRename}
      onCancel={() => setRenaming(false)}
      indent={4 + depth * 12 + 18}
    />
  );

  return (
    <>
      <TreeItem
        depth={depth}
        icon={expanded
          ? <FolderOpen className="w-3 h-3 text-sky-300" strokeWidth={1.5} />
          : <Folder    className="w-3 h-3 text-sky-400" strokeWidth={1.5} />}
        label={folder.folderDisplayName}
        hasChildren
        isExpanded={expanded}
        isLoading={contentLoading}
        onPrimaryClick={toggle}
        actions={<>
          <Btn title="New pipeline in folder" onClick={handleNewPipeline} icon={Workflow} />
          <Btn title="New orchestrator in folder" onClick={handleNewOrchestrator} icon={GitMerge} />
          <Btn title="New sub-folder" onClick={handleNewSubFolder} icon={FolderPlus} />
          <Btn title="Rename" onClick={() => setRenaming(true)} icon={Pencil} />
          <Btn title="Delete folder" danger onClick={() => {
            if (window.confirm(`Delete folder "${folder.folderDisplayName}" and all its contents?`))
              dispatch(deleteFolder({ projectId: folder.projectId, folderId: folder.folderId }));
          }} icon={Trash2} />
        </>}
      />

      {expanded && contentLoaded && (
        <>
          {/* Pipelines + Orchestrators scoped to this folder */}
          <ContentBlock
            projectId={folder.projectId}
            projectName={projectName}
            depth={depth + 1}
            pipelines={pipelines}
            orchestrators={orchestrators}
            isLoading={false}
            onNewPipeline={handleNewPipeline}
            onNewOrchestrator={handleNewOrchestrator}
          />

          {/* Sub-folders (recursive) */}
          {subFolders.length > 0 && (
            <>
              <SubLabel label="Sub-folders" depth={depth} onAdd={handleNewSubFolder} addTitle="New sub-folder" />
              {subFolders.map(sf => (
                <FolderNode key={sf.folderId} folder={sf} projectName={projectName} depth={depth + 1} />
              ))}
            </>
          )}
        </>
      )}

      {expanded && contentLoading && (
        <div className="flex items-center gap-1 h-[22px] text-[11px] text-slate-600"
          style={{ paddingLeft: 4 + (depth + 1) * 12 + 18 }}>
          <Loader2 className="w-2.5 h-2.5 animate-spin" strokeWidth={1.5} /> Loading…
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT NODE
// Row quick-actions: Rename | New Folder | Delete
// Children: Pipelines (root) | Orchestrators (root) | Folders
// ─────────────────────────────────────────────────────────────────────────────

function ProjectNode({ project }: { project: { projectId: string; projectDisplayName: string } }) {
  const dispatch      = useAppDispatch();
  const expanded      = useAppSelector(s => s.projects.expandedProjectIds.includes(project.projectId));
  const pipelines     = useAppSelector(s => s.projects.pipelinesByProject[project.projectId] ?? null);
  const orchestrators = useAppSelector(s => s.projects.orchestratorsByProject[project.projectId] ?? null);
  const folders       = useAppSelector(s => s.projects.foldersByProject[project.projectId] ?? null);
  const activeTab     = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
  const isActive      = activeTab?.objectId === project.projectId && activeTab?.type === 'project';
  const [renaming, setRenaming] = useState(false);

  const toggle = useCallback(() => {
    dispatch(toggleProjectExpanded(project.projectId));
    if (!expanded) {
      if (pipelines === null)     dispatch(fetchPipelinesForProject(project.projectId));
      if (orchestrators === null) dispatch(fetchOrchestratorsForProject(project.projectId));
      if (folders === null)       dispatch(fetchFoldersForProject(project.projectId));
    }
  }, [dispatch, project.projectId, expanded, pipelines, orchestrators, folders]);

  const commitRename = (val: string) => {
    setRenaming(false);
    if (val !== project.projectDisplayName)
      dispatch(renameProject({ id: project.projectId, name: val }));
  };

  if (renaming) return (
    <InlineRename
      defaultValue={project.projectDisplayName}
      onCommit={commitRename}
      onCancel={() => setRenaming(false)}
      indent={4 + 1 * 12 + 18}
    />
  );

  const isLoadingChildren = (pipelines === null || orchestrators === null) && expanded;

  return (
    <>
      {/* Project row — actions: Rename | New Folder | Delete only */}
      <TreeItem
        depth={1}
        icon={expanded
          ? <FolderOpen className="w-3 h-3 text-amber-400" strokeWidth={1.5} />
          : <Folder     className="w-3 h-3 text-amber-400" strokeWidth={1.5} />}
        label={project.projectDisplayName}
        isActive={isActive}
        hasChildren
        isExpanded={expanded}
        isLoading={isLoadingChildren}
        onPrimaryClick={toggle}
        actions={<>
          <Btn title="Rename project" onClick={() => setRenaming(true)} icon={Pencil} />
          <Btn title="New folder in project"
            onClick={() => dispatch(openCreateFolder({ projectId: project.projectId }))} icon={FolderPlus} />
          <Btn title="Delete project" danger
            onClick={() => {
              if (window.confirm(`Delete project "${project.projectDisplayName}" and all its contents?`))
                dispatch(deleteProject(project.projectId));
            }} icon={Trash2} />
        </>}
      />

      {/* Children */}
      {expanded && (
        <>
          {/* Root-level pipelines + orchestrators (folder_id IS NULL) */}
          <ContentBlock
            projectId={project.projectId}
            projectName={project.projectDisplayName}
            depth={2}
            pipelines={pipelines}
            orchestrators={orchestrators}
            isLoading={isLoadingChildren}
            onNewPipeline={() =>
              dispatch(openCreatePipeline({ projectId: project.projectId, folderId: null }))
            }
            onNewOrchestrator={() =>
              dispatch(openCreateOrchestrator({ projectId: project.projectId, folderId: null }))
            }
          />

          {/* Folders section */}
          {!isLoadingChildren && folders !== null && (
            <>
              <SubLabel
                label="Folders" depth={1}
                onAdd={() => dispatch(openCreateFolder({ projectId: project.projectId }))}
                addTitle="New folder"
              />
              {folders.length === 0 && (
                <EmptyHint depth={2} text="No folders yet" />
              )}
              {folders.map(f => (
                <FolderNode key={f.folderId} folder={f} projectName={project.projectDisplayName} depth={2} />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIONS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function ConnectionsSection() {
  const dispatch  = useAppDispatch();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    if (!expanded) dispatch(fetchTechnologies());
    setExpanded(v => !v);
  };

  return (
    <>
      <Section
        label="Connections" icon={Plug2} iconColor="text-emerald-400"
        isExpanded={expanded} onToggle={toggle}
        onRefresh={() => dispatch(fetchTechnologies())}
        onAdd={() => dispatch(openCreateConnection({}))}
        addTitle="New connection"
      />
      {expanded && (
        <TechnologiesSection nested />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function UsersSection() {
  const dispatch  = useAppDispatch();
  const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
  const [expanded, setExpanded] = useState(false);
  const [users, setUsers]       = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers();
      const data = res.data?.data ?? [];
      setUsers(data.map((u: any) => ({ id: u.userId ?? u.user_id, name: u.displayName ?? u.user_full_name ?? u.email_address })));
    } catch { /* governance may not be set up yet */ }
    finally { setLoading(false); }
  };

  const toggle = () => { const next = !expanded; setExpanded(next); if (next && users.length === 0) load(); };

  return (
    <>
      <Section
        label="Users" icon={Users} iconColor="text-rose-400"
        isExpanded={expanded} onToggle={toggle}
        onRefresh={expanded ? load : undefined}
        onAdd={() => dispatch(openTab({ id: 'governance-users', type: 'governance', objectId: 'users', objectName: 'Users', unsaved: false, isDirty: false }))}
        addTitle="Manage users"
      />
      {expanded && (
        <>
          {loading && <div className="flex items-center gap-1.5 h-6 text-[11px] text-slate-600" style={{ paddingLeft: 8 + 1 * 16 + 20 }}><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>}
          {!loading && users.length === 0 && <div className="h-6 flex items-center text-[11px] text-slate-700 italic" style={{ paddingLeft: 8 + 1 * 16 + 20 }}>No users found</div>}
          {!loading && users.map(u => (
            <TreeItem key={u.id} depth={1} icon={<Users className="w-3 h-3 text-rose-400" />} label={u.name}
              isActive={activeTab?.objectId === u.id && activeTab?.type === 'user'}
              onPrimaryClick={() => dispatch(openTab({ id: `user-${u.id}`, type: 'user', objectId: u.id, objectName: u.name, hierarchyPath: `Users → ${u.name}`, unsaved: false, isDirty: false }))}
            />
          ))}
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES SECTION
// ─────────────────────────────────────────────────────────────────────────────

function RolesSection() {
  const dispatch  = useAppDispatch();
  const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
  const [expanded, setExpanded] = useState(false);
  const [roles, setRoles]       = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getRoles();
      const data = res.data?.data ?? [];
      setRoles(data.map((r: any) => ({ id: r.roleId ?? r.role_id, name: r.roleName ?? r.role_display_name })));
    } catch { /* governance may not be set up yet */ }
    finally { setLoading(false); }
  };

  const toggle = () => { const next = !expanded; setExpanded(next); if (next && roles.length === 0) load(); };

  return (
    <>
      <Section
        label="Roles" icon={Shield} iconColor="text-orange-400"
        isExpanded={expanded} onToggle={toggle}
        onRefresh={expanded ? load : undefined}
        onAdd={() => dispatch(openTab({ id: 'governance-roles', type: 'governance', objectId: 'roles', objectName: 'Roles', unsaved: false, isDirty: false }))}
        addTitle="Manage roles"
      />
      {expanded && (
        <>
          {loading && <div className="flex items-center gap-1.5 h-6 text-[11px] text-slate-600" style={{ paddingLeft: 8 + 1 * 16 + 20 }}><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>}
          {!loading && roles.length === 0 && <div className="h-6 flex items-center text-[11px] text-slate-700 italic" style={{ paddingLeft: 8 + 1 * 16 + 20 }}>No roles found</div>}
          {!loading && roles.map(r => (
            <TreeItem key={r.id} depth={1} icon={<Shield className="w-3 h-3 text-orange-400" />} label={r.name}
              isActive={activeTab?.objectId === r.id && activeTab?.type === 'role'}
              onPrimaryClick={() => dispatch(openTab({ id: `role-${r.id}`, type: 'role', objectId: r.id, objectName: r.name, hierarchyPath: `Roles → ${r.name}`, unsaved: false, isDirty: false }))}
            />
          ))}
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TECHNOLOGIES SECTION — lazy per-tech connections
// ─────────────────────────────────────────────────────────────────────────────

function TechRow({ tech }: { tech: { techCode: string; displayName: string; iconName: string | null } }) {
  const dispatch = useAppDispatch();
  const slot = useAppSelector(s => s.connections.connectorsByTech[tech.techCode]);
  const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
  const [expanded, setExpanded] = useState(false);

  // items are stored in Arrow cache (outside Redux); slot.count triggers re-render
  const items     = slot ? connectorCache.get(tech.techCode) : [];
  const loading   = slot?.isLoading ?? false;
  const cursor    = slot?.nextCursor ?? null;

  // Re-fetch when slot is evicted (e.g. after create/delete) while node is expanded
  useEffect(() => {
    if (expanded && !slot && !loading) {
      dispatch(fetchConnectorsByTech({ techCode: tech.techCode }));
    }
  }, [expanded, slot, loading, dispatch, tech.techCode]);

  const toggle = () => {
    const next = !expanded;
    if (next && items.length === 0) {
      dispatch(fetchConnectorsByTech({ techCode: tech.techCode }));
    }
    if (!next) {
      // Evict buffer on collapse to free memory
      dispatch(evictTechSlot(tech.techCode));
    }
    setExpanded(next);
  };

  const loadMore = () => {
    if (cursor) dispatch(fetchConnectorsByTech({ techCode: tech.techCode, after: cursor }));
  };

  const healthDot = (code: string) =>
    code === 'HEALTHY' ? 'bg-emerald-400' : code === 'DEGRADED' ? 'bg-amber-400' : 'bg-slate-600';

  const openConn = (c: { connectorId: string; connectorDisplayName: string }) =>
    dispatch(openTab({
      id: `connection-${c.connectorId}`, type: 'connection',
      objectId: c.connectorId, objectName: c.connectorDisplayName,
      hierarchyPath: `${tech.displayName} → ${c.connectorDisplayName}`,
      unsaved: false, isDirty: false,
    }));

  return (
    <>
      {/* Technology row */}
      <div
        className="flex items-center group cursor-pointer select-none"
        style={{ paddingLeft: 8 + 1 * 16, height: 22 }}
        onClick={toggle}
      >
        <span className="w-4 h-4 flex items-center justify-center text-slate-600 flex-shrink-0 mr-1">
          {expanded
            ? <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
            : <ChevronRight className="w-3 h-3" strokeWidth={1.5} />}
        </span>
        <span className="flex-1 truncate text-[12px] text-slate-300 group-hover:text-slate-100">
          {tech.displayName}
        </span>
        {items.length > 0 && (
          <span className="text-[10px] text-slate-600 mr-1">{items.length}{cursor ? '+' : ''}</span>
        )}
        <span className="opacity-0 group-hover:opacity-100 flex-shrink-0 mr-1">
          <Btn
            title={`Create ${tech.displayName} connection`}
            onClick={e => { e.stopPropagation(); dispatch(openCreateConnection({ preselectedTechCode: tech.techCode })); }}
            icon={Plus}
          />
        </span>
      </div>

      {/* Connection rows */}
      {expanded && (
        <>
          {loading && (
            <div className="flex items-center gap-1.5 h-6 text-[11px] text-slate-600"
              style={{ paddingLeft: 8 + 3 * 16 }}>
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Loading…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="h-6 flex items-center text-[11px] text-slate-700 italic"
              style={{ paddingLeft: 8 + 3 * 16 }}>
              No connections yet
            </div>
          )}
          {items.map(c => {
            const isConn = activeTab?.objectId === c.connectorId && activeTab?.type === 'connection';
            return (
              <TreeItem
                key={c.connectorId} depth={2}
                icon={
                  <span className="relative">
                    <Network className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
                    <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#0f1117] ${healthDot(c.healthStatusCode)}`} />
                  </span>
                }
                label={c.connectorDisplayName}
                isActive={isConn}
                onPrimaryClick={() => openConn(c)}
                actions={<>
                  <Btn title="Open connection" onClick={() => openConn(c)} icon={ExternalLink} />
                  <Btn title="Delete connection" danger onClick={() => {
                    if (window.confirm(`Delete connection "${c.connectorDisplayName}"?`))
                      dispatch(deleteConnector(c.connectorId));
                  }} icon={Trash2} />
                </>}
              />
            );
          })}
          {cursor && !loading && (
            <button
              onClick={loadMore}
              className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 h-6"
              style={{ paddingLeft: 8 + 3 * 16 }}
            >
              <RefreshCw className="w-2.5 h-2.5" /> Load more
            </button>
          )}
        </>
      )}
    </>
  );
}

function TechnologiesSection({ nested = false }: { nested?: boolean }) {
  const dispatch = useAppDispatch();
  const { technologies, isLoading } = useAppSelector(s => s.connections);
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    if (!expanded && technologies.length === 0) dispatch(fetchTechnologies());
    setExpanded(v => !v);
  };

  const grouped = (technologies || []).reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, typeof technologies>);

  const baseDepth = nested ? 1 : 0;

  return (
    <>
      <Section
        label="Technologies" icon={Layers} iconColor="text-blue-400"
        isExpanded={expanded} onToggle={toggle}
        onRefresh={() => dispatch(fetchTechnologies())}
        addTitle="Static Repository"
      />
      {expanded && (
        <>
          {isLoading && (
            <div className="flex items-center gap-1.5 h-6 text-[11px] text-slate-600"
              style={{ paddingLeft: 8 + (baseDepth + 1) * 16 + 20 }}>
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          )}
          {!isLoading && Object.keys(grouped).map(cat => (
            <React.Fragment key={cat}>
              <SubLabel label={cat.replace('_', ' ')} depth={baseDepth} />
              {grouped[cat].map(t => (
                <TechRow key={t.techCode} tech={t} />
              ))}
            </React.Fragment>
          ))}
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// METADATA SECTION — catalog-only tree: Connection → Schema → Table → Columns
// Shows ONLY datasets that have been imported into catalog.datasets.
// No introspect here — introspect is on the Import tab of the connection workspace.
// ─────────────────────────────────────────────────────────────────────────────

type CatalogDataset = {
  dataset_id: string;
  connector_id: string;
  connector_display_name: string;
  connector_type_code: string;
  schema_name_text: string;
  table_name_text: string;
  dataset_type_code: string;
};

type CatalogColumn = { columnId: string; name: string; dataType: string; nullable: boolean; ordinal: number };

function MetaTableRow({
  dataset,
  connectorDisplayName,
  schemaName,
}: {
  dataset: CatalogDataset;
  connectorDisplayName: string;
  schemaName: string;
}) {
  const dispatch = useAppDispatch();
  const [expanded, setExpanded] = useState(false);
  const [columns, setColumns] = useState<CatalogColumn[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && columns.length === 0) {
      setLoading(true);
      try {
        const res = await api.getProfile(dataset.dataset_id);
        const p = res.data?.data ?? res.data;
        setColumns((p?.columns ?? []) as CatalogColumn[]);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
  };

  const openDetail = () => dispatch(openTab({
    id: `metadata-${dataset.dataset_id}`, type: 'metadata',
    objectId: dataset.dataset_id, objectName: dataset.table_name_text,
    hierarchyPath: `Metadata → ${connectorDisplayName} → ${schemaName} → ${dataset.table_name_text}`,
    unsaved: false, isDirty: false,
  }));

  const isFile = dataset.connector_type_code?.startsWith('FILE_') || dataset.connector_type_code === 'CSV';
  const tableIcon = isFile ? '📄' : null;

  return (
    <>
      {/* Table row */}
      <div
        className="flex items-center group cursor-pointer select-none"
        style={{ paddingLeft: 8 + 4 * 16, height: 22 }}
        onClick={toggle}
      >
        <span className="w-4 h-4 flex items-center justify-center text-slate-600 flex-shrink-0 mr-1">
          {expanded ? <ChevronDown className="w-3 h-3" strokeWidth={1.5} /> : <ChevronRight className="w-3 h-3" strokeWidth={1.5} />}
        </span>
        {tableIcon
          ? <span className="text-[11px] mr-1.5 flex-shrink-0">{tableIcon}</span>
          : <Database className="w-3 h-3 text-violet-400 flex-shrink-0 mr-1.5" strokeWidth={1.5} />}
        <span className="flex-1 truncate text-[12px] text-slate-300 group-hover:text-slate-100">{dataset.table_name_text}</span>
        {loading && <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-500 mr-1 flex-shrink-0" />}
        <span className="flex items-center gap-1 mr-1 flex-shrink-0">
          <button
            title="Preview top rows"
            onClick={e => { e.stopPropagation(); dispatch(openMetadataPreview({ datasetId: dataset.dataset_id, datasetName: dataset.table_name_text })); }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-violet-800/50 text-slate-500 hover:text-violet-300 transition-colors"
          >
            <Eye className="w-3 h-3" strokeWidth={1.5} />
          </button>
          <button
            title="Open table details"
            onClick={e => { e.stopPropagation(); openDetail(); }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700/60 text-slate-500 hover:text-slate-200 transition-colors"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </span>
      </div>

      {/* Column rows */}
      {expanded && !loading && columns.map(col => (
        <div
          key={col.columnId}
          className="flex items-center select-none"
          style={{ paddingLeft: 8 + 5 * 16 + 4, height: 20 }}
        >
          <span className="w-2 h-full border-l border-slate-800 mr-2 flex-shrink-0" />
          <span className="text-[11px] font-mono text-slate-400 flex-1 truncate">{col.name}</span>
          <span className={`text-[9px] px-1 py-0.5 rounded border mr-1 flex-shrink-0 ${
            /^(bigint|int|numeric|double|float)/i.test(col.dataType)
              ? 'text-blue-400 border-blue-800 bg-blue-900/20'
              : /^(varchar|text|string|char)/i.test(col.dataType)
              ? 'text-emerald-400 border-emerald-800 bg-emerald-900/20'
              : /^(date|time|timestamp)/i.test(col.dataType)
              ? 'text-amber-400 border-amber-800 bg-amber-900/20'
              : 'text-slate-500 border-slate-700'
          }`}>{col.dataType}</span>
          {!col.nullable && <span className="text-[8px] text-red-400 mr-1 flex-shrink-0">NN</span>}
        </div>
      ))}
      {expanded && !loading && columns.length === 0 && (
        <div className="h-5 flex items-center text-[10px] text-slate-700 italic" style={{ paddingLeft: 8 + 5 * 16 + 4 }}>
          No columns
        </div>
      )}
    </>
  );
}

function MetadataSection() {
  const dispatch = useAppDispatch();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState<CatalogDataset[]>([]);
  // Per-connection expansion
  const [expandedConns, setExpandedConns] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getMetadataTree();
      const data = res.data?.data ?? res.data;
      setDatasets((Array.isArray(data) ? data : []) as CatalogDataset[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && datasets.length === 0) void load();
  };

  const toggleConn = (connId: string) => {
    setExpandedConns(prev => { const s = new Set(prev); s.has(connId) ? s.delete(connId) : s.add(connId); return s; });
  };

  const toggleSchema = (key: string) => {
    setExpandedSchemas(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  };

  // Group: connector → schema → tables
  const byConn = datasets.reduce((acc, d) => {
    const key = d.connector_id;
    if (!acc[key]) acc[key] = { name: d.connector_display_name, typeCode: d.connector_type_code, tables: [] };
    acc[key].tables.push(d);
    return acc;
  }, {} as Record<string, { name: string; typeCode: string; tables: CatalogDataset[] }>);

  return (
    <>
      <Section
        label="Metadata Catalog" icon={Database} iconColor="text-violet-400"
        isExpanded={expanded} onToggle={toggle}
        onRefresh={load}
        addTitle={undefined}
      />
      {expanded && (
        <>
          {loading && (
            <div className="flex items-center gap-1.5 h-6 text-[11px] text-slate-600" style={{ paddingLeft: 8 + 16 + 20 }}>
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          )}
          {!loading && Object.keys(byConn).length === 0 && (
            <div className="h-6 flex items-center text-[11px] text-slate-700 italic" style={{ paddingLeft: 8 + 16 + 20 }}>
              No imported metadata — use Import tab on a connection
            </div>
          )}
          {!loading && Object.entries(byConn).map(([connId, conn]) => {
            const isConnExpanded = expandedConns.has(connId);
            // Group tables by schema
            const bySchema = conn.tables.reduce((acc, t) => {
              const s = t.schema_name_text || '(root)';
              if (!acc[s]) acc[s] = [];
              acc[s].push(t);
              return acc;
            }, {} as Record<string, CatalogDataset[]>);

            return (
              <React.Fragment key={connId}>
                {/* Connection row */}
                <div
                  className="flex items-center group cursor-pointer select-none"
                  style={{ paddingLeft: 8 + 1 * 16, height: 22 }}
                  onClick={() => toggleConn(connId)}
                >
                  <span className="w-4 h-4 flex items-center justify-center text-slate-600 flex-shrink-0 mr-1">
                    {isConnExpanded ? <ChevronDown className="w-3 h-3" strokeWidth={1.5} /> : <ChevronRight className="w-3 h-3" strokeWidth={1.5} />}
                  </span>
                  <Network className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mr-1.5" strokeWidth={1.5} />
                  <span className="flex-1 truncate text-[12px] text-slate-300 group-hover:text-slate-100">{conn.name}</span>
                  <span className="text-[10px] text-slate-600 mr-1">{conn.tables.length}</span>
                </div>

                {/* Schema rows */}
                {isConnExpanded && Object.entries(bySchema).map(([schema, tables]) => {
                  const schemaKey = `${connId}::${schema}`;
                  const isSchemaExpanded = expandedSchemas.has(schemaKey);
                  // For file connections, skip the schema level (it's just a directory path)
                  const isFile = conn.typeCode?.startsWith('FILE_') || conn.typeCode === 'CSV';
                  if (isFile) {
                    return tables.map(t => (
                      <MetaTableRow
                        key={t.dataset_id}
                        dataset={t}
                        connectorDisplayName={conn.name}
                        schemaName={schema}
                      />
                    ));
                  }
                  return (
                    <React.Fragment key={schemaKey}>
                      {/* Schema row */}
                      <div
                        className="flex items-center group cursor-pointer select-none"
                        style={{ paddingLeft: 8 + 2 * 16, height: 22 }}
                        onClick={() => toggleSchema(schemaKey)}
                      >
                        <span className="w-4 h-4 flex items-center justify-center text-slate-600 flex-shrink-0 mr-1">
                          {isSchemaExpanded ? <ChevronDown className="w-3 h-3" strokeWidth={1.5} /> : <ChevronRight className="w-3 h-3" strokeWidth={1.5} />}
                        </span>
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mr-1.5" strokeWidth={1.5} />
                        <span className="flex-1 truncate text-[12px] text-slate-300 group-hover:text-slate-100">{schema}</span>
                        <span className="text-[10px] text-slate-600 mr-1">{tables.length}</span>
                      </div>
                      {/* Table rows */}
                      {isSchemaExpanded && tables.map(t => (
                        <MetaTableRow
                          key={t.dataset_id}
                          dataset={t}
                          connectorDisplayName={conn.name}
                          schemaName={schema}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}

        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

export function LeftSidebar() {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === s.tabs.activeTabId));
  const { projects, globalPipelines, globalOrchestrators, isLoading, error } = useAppSelector(s => s.projects);
  const globalPipelinesLoaded    = useAppSelector(s => s.projects.globalPipelinesLoaded);
  const globalPipelinesCursor    = useAppSelector(s => s.projects.globalPipelinesCursor);
  const globalPipelinesLoading   = useAppSelector(s => s.projects.globalPipelinesLoading);
  const globalOrchestratorsLoaded  = useAppSelector(s => s.projects.globalOrchestratorsLoaded);
  const globalOrchestratorsCursor  = useAppSelector(s => s.projects.globalOrchestratorsCursor);
  const globalOrchestratorsLoading = useAppSelector(s => s.projects.globalOrchestratorsLoading);

  const createProjectOpen           = useAppSelector(s => s.projects.createProjectOpen);
  const createPipelineOpen          = useAppSelector(s => s.projects.createPipelineOpen);
  const createOrchestratorOpen      = useAppSelector(s => s.projects.createOrchestratorOpen);
  const createFolderOpen            = useAppSelector(s => s.projects.createFolderOpen);
  const createConnectionOpen        = useAppSelector(s => s.connections.createConnectionOpen);

  const [projectsExpanded, setProjectsExpanded]               = useState(true);
  const [globalPipelinesExpanded, setGlobalPipelinesExpanded] = useState(false);
  const [globalOrchsExpanded, setGlobalOrchsExpanded]         = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { dispatch(fetchProjects()); }, [dispatch]);

  // Load global pipelines when section expanded
  useEffect(() => {
    if (globalPipelinesExpanded && !globalPipelinesLoaded) {
      dispatch(fetchGlobalPipelines(undefined));
    }
  }, [globalPipelinesExpanded, globalPipelinesLoaded, dispatch]);

  // Load global orchestrators when section expanded
  useEffect(() => {
    if (globalOrchsExpanded && !globalOrchestratorsLoaded) {
      dispatch(fetchGlobalOrchestrators(undefined));
    }
  }, [globalOrchsExpanded, globalOrchestratorsLoaded, dispatch]);

  const isType  = (t: string) => activeTab?.type === t;
  const openNav = (id: string, type: string, name: string) =>
    dispatch(openTab({ id, type: type as never, objectId: id, objectName: name, unsaved: false, isDirty: false }));

  const filtered = search.trim()
    ? projects.filter(p => p.projectDisplayName.toLowerCase().includes(search.toLowerCase()))
    : projects;

  return (
    <>
      <aside className="flex flex-col h-full bg-[#0f1117] border-r border-slate-800/60 overflow-hidden" style={{ minWidth: 0 }}>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="px-2 pt-2 pb-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 h-7 bg-slate-800/50 border border-slate-700/50 rounded px-2">
            <Search className="w-3 h-3 text-slate-600 flex-shrink-0" strokeWidth={1.5} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter tree…"
              className="flex-1 bg-transparent text-[12px] text-slate-300 placeholder-slate-600 outline-none min-w-0"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-600 hover:text-slate-300 text-[11px]">✕</button>
            )}
          </div>
        </div>

        {/* ── Tree ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 pb-2 min-h-0 space-y-0.5">

          {/* ── PROJECTS ── */}
          <Section
            label="Projects" icon={FolderOpen} iconColor="text-amber-400"
            isExpanded={projectsExpanded}
            onToggle={() => setProjectsExpanded(v => !v)}
            onRefresh={() => dispatch(fetchProjects())}
            onAdd={() => dispatch(openCreateProject())}
            addTitle="New project"
          />

          {projectsExpanded && (
            <div className="space-y-0.5">
              {isLoading && (
                <div className="flex items-center gap-1 h-[22px] text-[11px] text-slate-600 px-7">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" strokeWidth={1.5} /> Loading projects…
                </div>
              )}
              {!isLoading && error && (
                <div className="mx-2 px-2 py-1.5 bg-red-950/40 border border-red-900/30 rounded flex items-start gap-1.5 text-[11px] text-red-400">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {error}
                </div>
              )}
              {!isLoading && !error && projects.length === 0 && (
                <button
                  onClick={() => dispatch(openCreateProject())}
                  className="flex items-center gap-1.5 h-7 text-[11px] text-blue-400 hover:text-blue-300 px-9"
                >
                  <Plus className="w-3 h-3" strokeWidth={1.5} /> Create first project
                </button>
              )}
              {!isLoading && filtered.map(p => (
                <ProjectNode key={p.projectId} project={p} />
              ))}
              {!isLoading && search && filtered.length === 0 && projects.length > 0 && (
                <div className="px-9 py-1 text-[11px] text-slate-600 italic">No match for "{search}"</div>
              )}
            </div>
          )}

          {/* ── GLOBAL PIPELINES ── */}
          <Section
            label="Global Pipelines" icon={Workflow} iconColor="text-sky-400"
            isExpanded={globalPipelinesExpanded}
            onToggle={() => setGlobalPipelinesExpanded(v => !v)}
            onAdd={() => dispatch(openCreatePipeline({ projectId: null, folderId: null }))}
            addTitle="New global pipeline"
          />
          {globalPipelinesExpanded && (
            globalPipelinesLoading && !globalPipelinesLoaded ? (
              <div className="px-9 py-1 text-[11px] text-slate-600 italic">Loading…</div>
            ) : globalPipelines.length === 0 ? (
              <EmptyHint depth={1} text="No global pipelines yet" />
            ) : (
              <div>
                {globalPipelines.map(pl => (
                  <button key={pl.pipelineId}
                    onClick={() => dispatch(openTab({
                      id: `pipeline-${pl.pipelineId}`,
                      type: 'pipeline',
                      objectId: pl.pipelineId,
                      objectName: pl.pipelineDisplayName,
                      unsaved: false,
                      isDirty: false
                    }))}
                    className="w-full flex items-center gap-2 px-9 py-1 text-[12px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                    <Workflow className="w-3 h-3 text-sky-500 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{pl.pipelineDisplayName}</span>
                  </button>
                ))}
                {globalPipelinesCursor && (
                  <button
                    onClick={() => dispatch(fetchGlobalPipelines(globalPipelinesCursor))}
                    disabled={globalPipelinesLoading}
                    className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 h-6 px-9 disabled:opacity-50"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Load more
                  </button>
                )}
              </div>
            )
          )}

          {/* ── GLOBAL ORCHESTRATORS ── */}
          <Section
            label="Global Orchestrators" icon={GitMerge} iconColor="text-purple-400"
            isExpanded={globalOrchsExpanded}
            onToggle={() => setGlobalOrchsExpanded(v => !v)}
            onAdd={() => dispatch(openCreateOrchestrator({ projectId: null, folderId: null }))}
            addTitle="New global orchestrator"
          />
          {globalOrchsExpanded && (
            globalOrchestratorsLoading && !globalOrchestratorsLoaded ? (
              <div className="px-9 py-1 text-[11px] text-slate-600 italic">Loading…</div>
            ) : globalOrchestrators.length === 0 ? (
              <EmptyHint depth={1} text="No global orchestrators yet" />
            ) : (
              <div>
                {globalOrchestrators.map(o => (
                  <button key={o.orchId}
                    onClick={() => dispatch(openTab({
                      id: `orchestrator-${o.orchId}`,
                      type: 'orchestrator',
                      objectId: o.orchId,
                      objectName: o.orchDisplayName,
                      unsaved: false,
                      isDirty: false
                    }))}
                    className="w-full flex items-center gap-2 px-9 py-1 text-[12px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                    <GitMerge className="w-3 h-3 text-purple-500 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{o.orchDisplayName}</span>
                  </button>
                ))}
                {globalOrchestratorsCursor && (
                  <button
                    onClick={() => dispatch(fetchGlobalOrchestrators(globalOrchestratorsCursor))}
                    disabled={globalOrchestratorsLoading}
                    className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 h-6 px-9 disabled:opacity-50"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Load more
                  </button>
                )}
              </div>
            )
          )}

          <Divider />

          {/* ── CONNECTIONS (Technologies nested inside) ── */}
          <ConnectionsSection />

          {/* ── METADATA (Technologies also accessible here) ── */}
          <MetadataSection />

          {/* ── LINEAGE ── */}
          <NavRow icon={GitBranch} iconColor="text-teal-400" label="Lineage"
            isActive={isType('lineage')}
            onClick={() => openNav('lineage', 'lineage', 'Lineage')}
          />

          <Divider />

          {/* ── USERS ── */}
          <UsersSection />

          {/* ── ROLES ── */}
          <RolesSection />

          <Divider />

          {/* ── MONITOR ── */}
          <NavRow icon={Activity} iconColor={isType('monitor') ? 'text-blue-400' : 'text-sky-500'}
            label="Monitor" isActive={isType('monitor')}
            onClick={() => openNav('monitor', 'monitor', 'Monitor')}
          />

          {/* ── DASHBOARD ── */}
          <NavRow icon={LayoutDashboard} iconColor="text-slate-500"
            label="Dashboard" isActive={isType('dashboard')}
            onClick={() => openNav('dashboard', 'dashboard', 'Dashboard')}
          />
        </div>

        {/* ── Bottom: Settings ─────────────────────────────────────────────── */}
        <div className="border-t border-slate-800/60 px-1 py-1 flex-shrink-0">
          <NavRow icon={Settings} iconColor={isType('settings') ? 'text-blue-400' : 'text-slate-500'}
            label="Settings" isActive={isType('settings')}
            onClick={() => openNav('settings', 'settings', 'Settings')}
          />
        </div>
      </aside>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      {createProjectOpen      && <CreateProjectDialog />}
      {createPipelineOpen     && <CreatePipelineDialog />}
      {createOrchestratorOpen && <CreateOrchestratorDialog />}
      {createFolderOpen       && <CreateFolderDialog />}
      {createConnectionOpen   && <CreateConnectionDialog />}
    </>
  );
}
