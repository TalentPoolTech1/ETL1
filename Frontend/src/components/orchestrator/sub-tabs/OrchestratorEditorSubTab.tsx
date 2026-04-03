/**
 * Orchestrator DAG Editor
 * - Left panel: pipeline / orchestrator library (drag to canvas or parallel-group drop zones)
 * - Canvas: serial sequence by default; Parallel Group nodes contain parallel runnable steps
 * - Each top-level step exposes ON SUCCESS / ON FAILURE edge targets
 * - Double-click a Parallel Group to open an editor and drag objects into it from the left sidebar
 * - Drag from library onto canvas to add; drag within canvas to reorder
 * - Save persists dagDefinitionJson to the backend
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Trash2, Save, RefreshCw, GitMerge, Workflow,
  X, GripVertical, AlertCircle, CheckCircle2, Layers,
} from 'lucide-react';
import api from '@/services/api';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { fetchOrchestratorsForProject, fetchPipelinesForProject } from '@/store/slices/projectsSlice';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineRef {
  pipelineId: string;
  pipelineName: string;
  projectId?: string | null;
}

interface OrchestratorRef {
  orchestratorId: string;
  orchestratorName: string;
  projectId?: string | null;
}

type StepKind = 'pipeline' | 'orchestrator' | 'parallel_group';

interface DagStep {
  stepId: string;           // uuid within DAG
  kind: StepKind;
  pipelineId?: string;      // when kind=pipeline
  pipelineName?: string;
  orchestratorId?: string;  // when kind=orchestrator
  orchestratorName?: string;
  label?: string;           // display label override
  onSuccess?: string;       // stepId to run on success (serial chain; null=end)
  onFailure?: string;       // stepId to run on failure (null=stop)
  parallelSteps?: DagStep[]; // when kind=parallel_group
  retryCount?: number;
  timeoutMinutes?: number;
  x?: number;
  y?: number;
}

interface DagDefinition {
  steps: DagStep[];         // top-level steps (serial by default)
  entryStepId?: string;
}

type RouteBranch = 'success' | 'failure';
type RouteMode = { sourceStepId: string; branch: RouteBranch } | null;
type PortKind = 'target' | 'success' | 'failure';
type RouteLine = { key: string; branch: RouteBranch; x1: number; y1: number; x2: number; y2: number };

const EMPTY_DAG: DagDefinition = { steps: [] };
const STEP_CARD_WIDTH = 300;
const STEP_CARD_HEIGHT = 74;
const ROUTE_PORT_OFFSET = 12;

const STEP_META: Record<StepKind, { headerColor: string; bodyColor: string; borderColor: string; typeLabel: string }> = {
  pipeline: {
    headerColor: '#1e40af',
    bodyColor: '#1a233d',
    borderColor: '#60a5fa',
    typeLabel: 'PIPELINE',
  },
  orchestrator: {
    headerColor: '#0f766e',
    bodyColor: '#122a2a',
    borderColor: '#2dd4bf',
    typeLabel: 'ORCHESTRATOR',
  },
  parallel_group: {
    headerColor: '#6d28d9',
    bodyColor: '#26133f',
    borderColor: '#a855f7',
    typeLabel: 'PARALLEL GROUP',
  },
};

function safeDag(dag: DagDefinition): DagDefinition {
  return { ...dag, steps: Array.isArray(dag.steps) ? dag.steps : [] };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createStepFromDropData(data: DataTransfer, currentOrchId?: string): DagStep | null {
  const pipelineId = data.getData('pipelineId').trim();
  const pipelineName = data.getData('pipelineName').trim();
  if (pipelineId) {
    return {
      stepId: uid(),
      kind: 'pipeline',
      pipelineId,
      pipelineName,
    };
  }

  const orchestratorId = data.getData('orchestratorId').trim();
  const orchestratorName = data.getData('orchestratorName').trim();
  if (orchestratorId && orchestratorId !== currentOrchId) {
    return {
      stepId: uid(),
      kind: 'orchestrator',
      orchestratorId,
      orchestratorName,
    };
  }

  return null;
}

function describeStepTarget(step: DagStep): string {
  if (step.kind === 'parallel_group') return step.label || 'Parallel Group';
  if (step.kind === 'orchestrator') return step.orchestratorName || step.orchestratorId || 'Orchestrator';
  return step.pipelineName || step.pipelineId || 'Pipeline';
}

function describeRouteTarget(steps: DagStep[], value: string | undefined, branch: RouteBranch): string {
  if (!value) {
    return branch === 'success' ? 'Next step' : 'Stop orchestration';
  }
  if (value === '__end__') return 'End orchestration';
  if (value === '__continue__') return 'Continue to next step';
  const target = steps.find(step => step.stepId === value);
  return target ? describeStepTarget(target) : 'Mapped target';
}

function describeRouteDropHint(branch: RouteBranch): string {
  return branch === 'success' ? 'Drop Success Here' : 'Drop Failure Here';
}

function parseRouteDragPayload(data: DataTransfer): RouteMode {
  const sourceStepId = data.getData('routeSourceStepId').trim();
  const routeBranch = data.getData('routeBranch').trim();
  if (!sourceStepId) return null;
  if (routeBranch !== 'success' && routeBranch !== 'failure') return null;
  return { sourceStepId, branch: routeBranch };
}

function parseReorderDragPayload(data: DataTransfer): string | null {
  const stepId = data.getData('reorderStepId').trim();
  return stepId || null;
}

function getDefaultStepPosition(index: number): { x: number; y: number } {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 72 + column * 360,
    y: 48 + row * 140,
  };
}

function getStepPosition(step: DagStep, index: number): { x: number; y: number } {
  const fallback = getDefaultStepPosition(index);
  return {
    x: step.x ?? fallback.x,
    y: step.y ?? fallback.y,
  };
}

function getPortCenter(step: DagStep, index: number, port: PortKind): { x: number; y: number } {
  const position = getStepPosition(step, index);
  const centerY = position.y + STEP_CARD_HEIGHT / 2;

  if (port === 'target') {
    return { x: position.x, y: centerY };
  }

  if (port === 'success') {
    return { x: position.x + STEP_CARD_WIDTH, y: centerY - ROUTE_PORT_OFFSET };
  }

  return { x: position.x + STEP_CARD_WIDTH, y: centerY + ROUTE_PORT_OFFSET };
}

function addMemberToParallelGroup(group: DagStep, next: DagStep): DagStep {
  const current = group.parallelSteps ?? [];
  const exists = next.kind === 'pipeline'
    ? current.some(step => step.kind === 'pipeline' && step.pipelineId === next.pipelineId)
    : current.some(step => step.kind === 'orchestrator' && step.orchestratorId === next.orchestratorId);

  if (exists) return group;

  return {
    ...group,
    parallelSteps: [...current, next],
  };
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step, isMoving, isSelected,
  onDelete, onSelect,
  onDrop, onRouteDragStart, onRouteDragEnd, routeMode,
  registerPortRef, onStepMoveStart,
}: {
  step: DagStep;
  isMoving: boolean;
  isSelected: boolean;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  onRouteDragStart: (e: React.DragEvent, stepId: string, branch: RouteBranch) => void;
  onRouteDragEnd: () => void;
  routeMode: RouteMode;
  registerPortRef: (stepId: string, port: PortKind, el: HTMLDivElement | null) => void;
  onStepMoveStart: (e: React.MouseEvent, stepId: string) => void;
}) {
  const isGroup = step.kind === 'parallel_group';
  const meta = STEP_META[step.kind];
  const isDraggingSuccess = routeMode?.sourceStepId === step.stepId && routeMode.branch === 'success';
  const isDraggingFailure = routeMode?.sourceStepId === step.stepId && routeMode.branch === 'failure';
  const isRouteTarget = Boolean(routeMode && routeMode.sourceStepId !== step.stepId);

  return (
    <div
      onClick={() => onSelect(step.stepId)}
      onDoubleClick={() => onSelect(step.stepId)}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-nodrag="true"]')) return;
        onStepMoveStart(e, step.stepId);
      }}
      className={`relative rounded-lg border transition-all ${
        isMoving ? 'opacity-70 cursor-grabbing' : ''
      } ${
        isSelected
          ? 'ring-2 ring-blue-500/70 ring-offset-1 ring-offset-[#0d0f1a]'
          : ''
      } ${
        isRouteTarget && !isSelected ? 'ring-2 ring-blue-500/70 ring-offset-1 ring-offset-[#0d0f1a]' : ''
      }`}
      style={{
        borderColor: isSelected ? meta.borderColor : `${meta.borderColor}99`,
        backgroundColor: meta.bodyColor,
      }}
    >
      <div
        className={`absolute -left-2 top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-sm ${
          isRouteTarget ? 'ring-2 ring-blue-400/70' : ''
        }`}
        title="Drop a success or failure route here"
        data-nodrag="true"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(e, step.stepId); }}
        ref={(el) => registerPortRef(step.stepId, 'target', el)}
        style={{ borderColor: meta.borderColor, backgroundColor: '#0b0f1c' }}
      >
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.borderColor }} />
      </div>

      <div className="absolute -right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
        <div
          draggable
          onDragStart={e => onRouteDragStart(e, step.stepId, 'success')}
          onDragEnd={onRouteDragEnd}
          className={`flex h-4 w-4 cursor-grab items-center justify-center rounded-full border-2 shadow-sm ${
            isDraggingSuccess
              ? 'border-emerald-300 bg-emerald-500'
              : 'border-emerald-500/80 bg-[#0e2b1f]'
          }`}
          title={routeMode?.sourceStepId === step.stepId ? 'Dragging success route' : 'Success route'}
          data-nodrag="true"
          ref={(el) => registerPortRef(step.stepId, 'success', el)}
        />
        <div
          draggable
          onDragStart={e => onRouteDragStart(e, step.stepId, 'failure')}
          onDragEnd={onRouteDragEnd}
          className={`flex h-4 w-4 cursor-grab items-center justify-center rounded-full border-2 shadow-sm ${
            isDraggingFailure
              ? 'border-red-300 bg-red-500'
              : 'border-red-500/80 bg-[#2f1218]'
          }`}
          title={routeMode?.sourceStepId === step.stepId ? 'Dragging failure route' : 'Failure route'}
          data-nodrag="true"
          ref={(el) => registerPortRef(step.stepId, 'failure', el)}
        />
      </div>

      <div
        className="flex h-[22px] items-center gap-2 rounded-t-[7px] border-b px-3"
        style={{
          backgroundColor: meta.headerColor,
          borderBottomColor: `${meta.borderColor}55`,
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/90">
          {meta.typeLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-3">
        <div
          data-nodrag="true"
          onMouseDown={(e) => onStepMoveStart(e, step.stepId)}
          className="flex h-5 w-5 cursor-grab items-center justify-center text-slate-500 hover:text-white"
          title="Drag to move"
        >
          <GripVertical className="w-4 h-4 flex-shrink-0" />
        </div>

        {isGroup ? (
          <Layers className="w-4 h-4 text-purple-400 flex-shrink-0" />
        ) : step.kind === 'orchestrator' ? (
          <GitMerge className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        ) : (
          <Workflow className="w-4 h-4 text-sky-400 flex-shrink-0" />
        )}

        <span className="flex-1 text-[13px] font-semibold text-white truncate">
          {isGroup
            ? (step.label || 'Parallel Group')
            : step.kind === 'orchestrator'
              ? (step.orchestratorName || step.orchestratorId || 'Orchestrator')
              : (step.pipelineName || step.pipelineId || 'Pipeline')}
        </span>

        {isGroup && (
          <span className="rounded px-1.5 py-0.5 text-[11px] text-purple-200" style={{ backgroundColor: '#4c1d95' }}>
            {step.parallelSteps?.length ?? 0} parallel
          </span>
        )}

        <button
          data-nodrag="true"
          onClick={(e) => { e.stopPropagation(); onDelete(step.stepId); }}
          className="text-slate-400 hover:text-red-400 transition-colors"
          title="Remove step"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function StepInspector({
  step,
  steps,
  currentOrchId,
  onClose,
  onUpdate,
  onRemoveParallelMember,
  onAddParallelMember,
}: {
  step: DagStep | null;
  steps: DagStep[];
  currentOrchId: string;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<DagStep>) => void;
  onRemoveParallelMember: (groupId: string, memberStepId: string) => void;
  onAddParallelMember: (groupId: string, next: DagStep) => void;
}) {
  if (!step) {
    return (
      <aside className="w-[360px] border-l border-slate-800 bg-[#0a0c15] flex-shrink-0">
        <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-slate-500">
          Click a pipeline, orchestrator, or group to edit its settings here.
        </div>
      </aside>
    );
  }

  const isGroup = step.kind === 'parallel_group';
  const successLabel = describeRouteTarget(steps, step.onSuccess, 'success');
  const failureLabel = describeRouteTarget(steps, step.onFailure, 'failure');

  const handleParallelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const next = createStepFromDropData(e.dataTransfer, currentOrchId);
    if (!next) return;
    onAddParallelMember(step.stepId, next);
  };

  return (
    <aside className="w-[360px] border-l border-slate-800 bg-[#0a0c15] flex-shrink-0 overflow-hidden">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Step Configuration</div>
            <div className="mt-2 truncate text-[15px] font-semibold text-white">
              {describeStepTarget(step)}
            </div>
            <div className="mt-1 text-[12px] text-slate-400">
              {isGroup ? 'Parallel group' : step.kind === 'orchestrator' ? 'Child orchestrator' : 'Pipeline'}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
          {isGroup && (
            <section>
              <label className="field-label">Group Name</label>
              <input
                type="text"
                value={step.label ?? ''}
                onChange={e => onUpdate(step.stepId, { label: e.target.value })}
                placeholder="Parallel Group"
                className="field-input"
              />
            </section>
          )}

          <section className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Retry Count</label>
              <input
                type="number"
                min={0}
                max={10}
                value={step.retryCount ?? 0}
                onChange={e => onUpdate(step.stepId, { retryCount: Number(e.target.value) })}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Timeout (min)</label>
              <input
                type="number"
                min={1}
                value={step.timeoutMinutes ?? 60}
                onChange={e => onUpdate(step.stepId, { timeoutMinutes: Number(e.target.value) })}
                className="field-input"
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-[#0d1323] px-3 py-3">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              On Success
            </div>
            <div className="mt-2 text-[12px] text-slate-400">{successLabel}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdate(step.stepId, { onSuccess: undefined })}
                className="panel-btn"
              >
                Next Step
              </button>
              <button
                type="button"
                onClick={() => onUpdate(step.stepId, { onSuccess: '__end__' })}
                className="panel-btn"
              >
                End
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-[#0d1323] px-3 py-3">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              On Failure
            </div>
            <div className="mt-2 text-[12px] text-slate-400">{failureLabel}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdate(step.stepId, { onFailure: undefined })}
                className="panel-btn"
              >
                Stop
              </button>
              <button
                type="button"
                onClick={() => onUpdate(step.stepId, { onFailure: '__continue__' })}
                className="panel-btn"
              >
                Continue
              </button>
            </div>
          </section>

          {isGroup && (
            <section className="rounded-lg border border-purple-800/40 bg-purple-950/10 overflow-hidden">
              <div className="border-b border-purple-800/30 px-3 py-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-purple-200">Parallel Members</div>
                <div className="mt-1 text-[12px] text-purple-200/70">
                  Drag pipelines or orchestrators from the left tree and drop them here.
                </div>
              </div>
              <div
                className="m-3 rounded-lg border border-dashed border-purple-700/50 bg-[#0d1323] p-3"
                onDragOver={e => e.preventDefault()}
                onDrop={handleParallelDrop}
              >
                {(step.parallelSteps ?? []).length === 0 ? (
                  <div className="py-10 text-center text-[12px] text-slate-400">
                    Drop items here to add them to this parallel group.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(step.parallelSteps ?? []).map(member => (
                      <div key={member.stepId} className="flex items-center gap-2 rounded border border-purple-800/30 bg-purple-900/20 px-3 py-2">
                        {member.kind === 'orchestrator'
                          ? <GitMerge className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
                          : <Workflow className="h-3.5 w-3.5 flex-shrink-0 text-sky-400" />}
                        <span className="flex-1 truncate text-[12px] text-white">
                          {member.kind === 'orchestrator'
                            ? (member.orchestratorName || member.orchestratorId)
                            : (member.pipelineName || member.pipelineId)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveParallelMember(step.stepId, member.stepId)}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

interface Props { orchId: string; onDirty?: () => void; }

export function OrchestratorEditorSubTab({ orchId, onDirty }: Props) {
  const [dag, setDag]               = useState<DagDefinition>(EMPTY_DAG);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState<string | null>(null);
  const [movingStepId, setMovingStepId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [routeMode, setRouteMode]   = useState<RouteMode>(null);
  const [isDirty, setIsDirty]       = useState(false);
  const [orchProjectId, setOrchProjectId] = useState<string | null>(null);
  const graphRef                    = useRef<HTMLDivElement | null>(null);
  const portRefs                    = useRef<Record<string, Partial<Record<PortKind, HTMLDivElement | null>>>>({});
  const moveStateRef                = useRef<{ offsetX: number; offsetY: number; moved: boolean }>({ offsetX: 0, offsetY: 0, moved: false });
  const dispatch = useAppDispatch();

  // Pull pipelines from Redux store (already loaded by sidebar)
  const pipelinesByProject = useAppSelector(s => s.projects.pipelinesByProject);
  const pipelinesByFolder  = useAppSelector(s => s.projects.pipelinesByFolder);
  const globalPipelines    = useAppSelector(s => s.projects.globalPipelines);
  const orchestratorsByProject = useAppSelector(s => s.projects.orchestratorsByProject);
  const orchestratorsByFolder = useAppSelector(s => s.projects.orchestratorsByFolder);
  const globalOrchestrators = useAppSelector(s => s.projects.globalOrchestrators);

  // All pipelines visible in this orchestrator's project (project + all folders + global)
  const pipelines: PipelineRef[] = React.useMemo(() => {
    const all: PipelineRef[] = [];
    const seen = new Set<string>();
    const add = (r: { pipelineId: string; pipelineDisplayName: string; projectId?: string | null }) => {
      if (!r.pipelineId || seen.has(r.pipelineId)) return;
      seen.add(r.pipelineId);
      all.push({ pipelineId: r.pipelineId, pipelineName: r.pipelineDisplayName, projectId: r.projectId ?? null });
    };

    if (orchProjectId) {
      // Project root pipelines
      (pipelinesByProject[orchProjectId] ?? []).forEach(add);
      // All folder-scoped pipelines in the same project
      Object.values(pipelinesByFolder).flat()
        .filter(p => p.projectId === orchProjectId)
        .forEach(add);
    } else {
      // Global orchestrator — show everything from all projects + globals
      Object.values(pipelinesByProject).flat().forEach(add);
      Object.values(pipelinesByFolder).flat().forEach(add);
    }
    // Always include global (project-less) pipelines
    globalPipelines.forEach(add);
    return all;
  }, [orchProjectId, pipelinesByProject, pipelinesByFolder, globalPipelines]);

  const orchestrators: OrchestratorRef[] = React.useMemo(() => {
    const all: OrchestratorRef[] = [];
    const seen = new Set<string>();
    const add = (r: { orchId: string; orchDisplayName: string; projectId?: string | null }) => {
      if (!r.orchId || r.orchId === orchId || seen.has(r.orchId)) return;
      seen.add(r.orchId);
      all.push({ orchestratorId: r.orchId, orchestratorName: r.orchDisplayName, projectId: r.projectId ?? null });
    };

    if (orchProjectId) {
      (orchestratorsByProject[orchProjectId] ?? []).forEach(add);
      Object.values(orchestratorsByFolder).flat()
        .filter(o => o.projectId === orchProjectId)
        .forEach(add);
    } else {
      Object.values(orchestratorsByProject).flat().forEach(add);
      Object.values(orchestratorsByFolder).flat().forEach(add);
    }

    globalOrchestrators.forEach(add);
    return all;
  }, [orchId, orchProjectId, orchestratorsByProject, orchestratorsByFolder, globalOrchestrators]);

  // Load orchestrator DAG only (pipelines come from Redux)
  useEffect(() => {
    if (!orchId) return;
    setLoading(true);
    api.getOrchestrator(orchId)
      .then(res => {
        const orch = res.data?.data ?? res.data ?? {};
        const dagJson = orch.dagDefinitionJson ?? orch.dag_definition_json;
        if (dagJson) {
          try {
            const parsed = typeof dagJson === 'string' ? JSON.parse(dagJson) : dagJson;
            setDag({ steps: Array.isArray(parsed?.steps) ? parsed.steps : [] });
          }
          catch { setDag(EMPTY_DAG); }
        }
        const pid = orch.projectId ?? orch.project_id ?? null;
        setOrchProjectId(pid);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orchId]);

  // Ensure the project's pipelines are loaded in the Redux store
  useEffect(() => {
    if (orchProjectId && !pipelinesByProject[orchProjectId]) {
      dispatch(fetchPipelinesForProject(orchProjectId));
    }
    if (orchProjectId && !orchestratorsByProject[orchProjectId]) {
      dispatch(fetchOrchestratorsForProject(orchProjectId));
    }
  }, [orchProjectId, pipelinesByProject, orchestratorsByProject, dispatch]);

  const markDirty = () => { setIsDirty(true); onDirty?.(); };

  const updateDag = useCallback((updater: (prev: DagDefinition) => DagDefinition) => {
    setDag(updater);
    markDirty();
  }, []);

  // Add pipeline step from library
  const addPipelineStep = (p: PipelineRef) => {
    updateDag(prev => ({
      ...prev,
      steps: [...prev.steps, {
        stepId: uid(), kind: 'pipeline',
        pipelineId: p.pipelineId, pipelineName: p.pipelineName,
        ...getDefaultStepPosition(prev.steps.length),
      }],
    }));
  };

  const addPipelineStepAt = (p: PipelineRef, position: { x: number; y: number }) => {
    updateDag(prev => ({
      ...prev,
      steps: [...prev.steps, {
        stepId: uid(), kind: 'pipeline',
        pipelineId: p.pipelineId, pipelineName: p.pipelineName,
        x: position.x,
        y: position.y,
      }],
    }));
  };

  const addOrchestratorStep = (o: OrchestratorRef) => {
    updateDag(prev => ({
      ...prev,
      steps: [...prev.steps, {
        stepId: uid(), kind: 'orchestrator',
        orchestratorId: o.orchestratorId, orchestratorName: o.orchestratorName,
        ...getDefaultStepPosition(prev.steps.length),
      }],
    }));
  };

  const addOrchestratorStepAt = (o: OrchestratorRef, position: { x: number; y: number }) => {
    updateDag(prev => ({
      ...prev,
      steps: [...prev.steps, {
        stepId: uid(), kind: 'orchestrator',
        orchestratorId: o.orchestratorId, orchestratorName: o.orchestratorName,
        x: position.x,
        y: position.y,
      }],
    }));
  };

  // Add parallel group
  const addParallelGroup = () => {
    const newStep: DagStep = {
      stepId: uid(),
      kind: 'parallel_group',
      label: 'Parallel Group',
      parallelSteps: [],
      ...getDefaultStepPosition(safeSteps.length),
    };
    updateDag(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    setSelectedStepId(newStep.stepId);
  };

  // Delete step
  const deleteStep = (stepId: string) => {
    updateDag(prev => ({ ...prev, steps: prev.steps.filter(s => s.stepId !== stepId) }));
    setSelectedStepId(current => (current === stepId ? null : current));
  };

  // Update step
  const updateStep = (stepId: string, patch: Partial<DagStep>) => {
    updateDag(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.stepId === stepId ? { ...s, ...patch } : s),
    }));
  };

  const registerPortRef = useCallback((stepId: string, port: PortKind, el: HTMLDivElement | null) => {
    if (!portRefs.current[stepId]) {
      portRefs.current[stepId] = {};
    }
    portRefs.current[stepId][port] = el;
  }, []);

  const startRouting = (stepId: string, branch: RouteBranch) => {
    setRouteMode({ sourceStepId: stepId, branch });
  };

  const handleRouteDragStart = (e: React.DragEvent, stepId: string, branch: RouteBranch) => {
    e.stopPropagation();
    e.dataTransfer.setData('routeSourceStepId', stepId);
    e.dataTransfer.setData('routeBranch', branch);
    e.dataTransfer.effectAllowed = 'link';
    startRouting(stepId, branch);
  };

  const handleRouteDragEnd = () => {
    setRouteMode(null);
  };

  const applyRouteTarget = (mapping: RouteMode, targetStepId: string) => {
    if (!mapping || mapping.sourceStepId === targetStepId) return;
    updateStep(
      mapping.sourceStepId,
      mapping.branch === 'success'
        ? { onSuccess: targetStepId }
        : { onFailure: targetStepId },
    );
    setRouteMode(null);
  };

  const handleStepMoveStart = (e: React.MouseEvent, stepId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const graphRect = graphRef.current?.getBoundingClientRect();
    const stepIndex = safeSteps.findIndex(step => step.stepId === stepId);
    if (!graphRect || stepIndex < 0) return;
    const position = getStepPosition(safeSteps[stepIndex], stepIndex);
    moveStateRef.current = {
      offsetX: e.clientX - graphRect.left - position.x,
      offsetY: e.clientY - graphRect.top - position.y,
      moved: false,
    };
    setSelectedStepId(stepId);
    setMovingStepId(stepId);
  };

  useEffect(() => {
    if (!movingStepId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const graphRect = graphRef.current?.getBoundingClientRect();
      if (!graphRect) return;

      const nextX = Math.max(32, e.clientX - graphRect.left - moveStateRef.current.offsetX);
      const nextY = Math.max(32, e.clientY - graphRect.top - moveStateRef.current.offsetY);
      moveStateRef.current.moved = true;

      setDag(prev => ({
        ...prev,
        steps: prev.steps.map(step => (
          step.stepId === movingStepId
            ? { ...step, x: nextX, y: nextY }
            : step
        )),
      }));
    };

    const handleMouseUp = () => {
      if (moveStateRef.current.moved) {
        setIsDirty(true);
        onDirty?.();
      }
      setMovingStepId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [movingStepId, onDirty]);

  const handleDrop      = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const routePayload = parseRouteDragPayload(e.dataTransfer);
    if (routePayload || routeMode) {
      applyRouteTarget(routePayload ?? routeMode, targetId);
      return;
    }
    const targetStep = safeSteps.find(step => step.stepId === targetId);
    const nextGroupMember = targetStep?.kind === 'parallel_group'
      ? createStepFromDropData(e.dataTransfer, orchId)
      : null;

    if (targetStep?.kind === 'parallel_group' && nextGroupMember) {
      updateDag(prev => ({
        ...prev,
        steps: prev.steps.map(step => (
          step.stepId === targetId
            ? addMemberToParallelGroup(step, nextGroupMember)
            : step
        )),
      }));
      return;
    }
  };

  // Drop from library panel onto canvas
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const routePayload = parseRouteDragPayload(e.dataTransfer);
    const reorderStepId = parseReorderDragPayload(e.dataTransfer);
    if (routePayload || reorderStepId) return;
    const graphRect = graphRef.current?.getBoundingClientRect();
    const position = graphRect
      ? {
          x: Math.max(40, e.clientX - graphRect.left - STEP_CARD_WIDTH / 2),
          y: Math.max(32, e.clientY - graphRect.top - STEP_CARD_HEIGHT / 2),
        }
      : getDefaultStepPosition(safeSteps.length);
    const pid = e.dataTransfer.getData('pipelineId');
    const pname = e.dataTransfer.getData('pipelineName');
    const oid = e.dataTransfer.getData('orchestratorId');
    const oname = e.dataTransfer.getData('orchestratorName');
    if (pid) {
      addPipelineStepAt({ pipelineId: pid, pipelineName: pname }, position);
      return;
    }
    if (oid && oid !== orchId) {
      addOrchestratorStepAt({ orchestratorId: oid, orchestratorName: oname }, position);
    }
  };

  // Save
  const save = async () => {
    setSaving(true); setSaveErr(null);
    try {
      await api.saveOrchestratorDag(orchId, dag);
      setIsDirty(false);
    } catch (err: any) {
      setSaveErr(err?.response?.data?.userMessage ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const safeSteps = Array.isArray(dag.steps) ? dag.steps : [];
  const selectedStep = safeSteps.find(s => s.stepId === selectedStepId) ?? null;
  const routeLines = React.useMemo(() => {
    const lines: RouteLine[] = [];

    for (const [index, step] of safeSteps.entries()) {
      const addLine = (branch: RouteBranch, targetStepId: string | undefined) => {
        if (!targetStepId || targetStepId === '__end__' || targetStepId === '__continue__') return;
        const targetIndex = safeSteps.findIndex(item => item.stepId === targetStepId);
        if (targetIndex < 0) return;

        const source = getPortCenter(step, index, branch);
        const target = getPortCenter(safeSteps[targetIndex], targetIndex, 'target');

        lines.push({
          key: `${step.stepId}:${branch}:${targetStepId}`,
          branch,
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
        });
      };

      addLine('success', step.onSuccess);
      addLine('failure', step.onFailure);
    }

    return lines;
  }, [safeSteps]);
  const graphWidth = Math.max(
    1400,
    ...safeSteps.map((step, index) => getStepPosition(step, index).x + STEP_CARD_WIDTH + 160),
  );
  const graphHeight = Math.max(
    820,
    ...safeSteps.map((step, index) => getStepPosition(step, index).y + STEP_CARD_HEIGHT + 180),
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] bg-[#0d0f1a]">
      Loading orchestrator…
    </div>
  );

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-[#0d0f1a]">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-[#0a0c15] flex-shrink-0">
        <button
          onClick={addParallelGroup}
          className="flex items-center gap-1.5 h-7 px-3 rounded border border-purple-700/50 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40 text-[12px] font-medium transition-all"
        >
          <GitMerge className="w-3.5 h-3.5" /> Add Parallel Group
        </button>
        <span className="text-[12px] text-slate-400">— drag pipelines or orchestrators from the left sidebar onto the canvas or into a parallel group</span>
        {routeMode && (
          <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 px-3 py-1.5 text-[12px] text-blue-200">
            Dragging {routeMode.branch === 'success' ? 'Success' : 'Failure'} from{' '}
            <span className="font-semibold">
              {describeStepTarget(safeSteps.find(step => step.stepId === routeMode.sourceStepId) ?? { stepId: '', kind: 'pipeline', pipelineName: 'step' })}
            </span>
            . Drop it on the destination step or parallel group.
          </div>
        )}
        <div className="flex-1" />
        {saveErr && <span className="text-[12px] text-red-400">{saveErr}</span>}
        {routeMode && (
          <button onClick={() => setRouteMode(null)} className="panel-btn">Cancel Mapping</button>
        )}
        {isDirty && (
          <button onClick={save} disabled={saving}
            className="panel-btn panel-btn-primary flex items-center gap-1.5">
            {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save DAG</>}
          </button>
        )}
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Steps */}
        <div className="flex-1 overflow-auto p-5">
          <div
            ref={graphRef}
            className={`relative ${movingStepId ? 'select-none' : ''}`}
            style={{
              width: `${graphWidth}px`,
              minHeight: `${graphHeight}px`,
              backgroundImage: `
                linear-gradient(rgba(71, 85, 105, 0.18) 1px, transparent 1px),
                linear-gradient(90deg, rgba(71, 85, 105, 0.18) 1px, transparent 1px)
              `,
              backgroundSize: '32px 32px',
              backgroundPosition: '0 0',
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            {safeSteps.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 select-none">
                <GitMerge className="w-12 h-12 opacity-20" />
                <p className="text-[13px]">Drag pipelines from the left sidebar onto this canvas to build your DAG.</p>
                <p className="text-[12px] text-slate-400">Use the left grip to move nodes anywhere on the canvas.</p>
              </div>
            )}

            {routeLines.length > 0 && (
              <svg className="pointer-events-none absolute inset-0 z-0 overflow-visible" width="100%" height="100%">
                {routeLines.map(line => {
                  const dx = Math.max(44, Math.abs(line.x2 - line.x1) * 0.45);
                  const path = `M ${line.x1} ${line.y1} C ${line.x1 + dx} ${line.y1}, ${line.x2 - dx} ${line.y2}, ${line.x2} ${line.y2}`;
                  const stroke = line.branch === 'success' ? '#34d399' : '#f87171';
                  return (
                    <path
                      key={line.key}
                      d={path}
                      stroke={stroke}
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
            )}
            {safeSteps.map((step, idx) => {
              const position = getStepPosition(step, idx);
              return (
              <React.Fragment key={step.stepId}>
                <div
                  className="absolute z-10 transition-all"
                  style={{ left: `${position.x}px`, top: `${position.y}px`, width: `${STEP_CARD_WIDTH}px` }}
                  onDrop={(e) => handleDrop(e, step.stepId)}
                >
                  <StepCard
                    step={step}
                    isMoving={movingStepId === step.stepId}
                    isSelected={selectedStepId === step.stepId}
                    onDelete={deleteStep}
                    onSelect={setSelectedStepId}
                    onDrop={handleDrop}
                    onRouteDragStart={handleRouteDragStart}
                    onRouteDragEnd={handleRouteDragEnd}
                    routeMode={routeMode}
                    registerPortRef={registerPortRef}
                    onStepMoveStart={handleStepMoveStart}
                  />
                </div>
              </React.Fragment>
            );
            })}
          </div>
        </div>

        <StepInspector
          step={selectedStep}
          steps={safeSteps}
          currentOrchId={orchId}
          onClose={() => setSelectedStepId(null)}
          onUpdate={updateStep}
          onRemoveParallelMember={(groupId, memberStepId) => {
            const group = safeSteps.find(item => item.stepId === groupId);
            if (!group || group.kind !== 'parallel_group') return;
            updateStep(groupId, {
              parallelSteps: (group.parallelSteps ?? []).filter(member => member.stepId !== memberStepId),
            });
          }}
          onAddParallelMember={(groupId, next) => {
            updateDag(prev => ({
              ...prev,
              steps: prev.steps.map(item => (
                item.stepId === groupId
                  ? addMemberToParallelGroup(item, next)
                  : item
              )),
            }));
          }}
        />
      </div>
    </div>
  );
}
