/**
 * ObjectHeader — reusable tab content header with hierarchy breadcrumb,
 * status badge, and action buttons. All styles from CSS variables.
 */
import React from 'react';
import {
  Workflow, GitMerge, FolderOpen, Folder, Plug2, Database,
  Users, Shield, Activity, Play, GitBranch, Settings,
  ChevronRight, Lock, Edit3, AlertCircle, CheckCircle2,
  Clock, PauseCircle, XCircle, Archive, FileWarning,
} from 'lucide-react';
import type { TabType, ObjectStatus } from '@/types';

// ─── Object icon ──────────────────────────────────────────────────────────

export function ObjectTypeIcon({ type, size = 18 }: { type: TabType; size?: number }) {
  const s = { width: size, height: size };
  switch (type) {
    case 'pipeline':     return <Workflow   style={s} className="text-sky-400" />;
    case 'orchestrator': return <GitMerge   style={s} className="text-purple-400" />;
    case 'project':      return <FolderOpen style={s} className="text-amber-400" />;
    case 'folder':       return <Folder     style={s} className="text-amber-300" />;
    case 'connection':
    case 'connections':  return <Plug2      style={s} className="text-emerald-400" />;
    case 'metadata':     return <Database   style={s} className="text-violet-400" />;
    case 'user':         return <Users      style={s} className="text-rose-400" />;
    case 'role':         return <Shield     style={s} className="text-orange-400" />;
    case 'monitor':      return <Activity   style={s} className="text-sky-500" />;
    case 'execution':    return <Play       style={s} className="text-green-400" />;
    case 'lineage':      return <GitBranch  style={s} className="text-teal-400" />;
    case 'governance':   return <Users      style={s} className="text-rose-400" />;
    case 'settings':     return <Settings   style={s} className="text-slate-400" />;
    default:             return <Database   style={s} className="text-slate-400" />;
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ObjectStatus, { label: string; style: React.CSSProperties; Icon: React.ElementType }> = {
  draft:     { label: 'Draft',     Icon: Edit3,       style: { background: 'rgba(71,85,105,0.3)',  color: 'var(--tx2)',  borderColor: 'var(--bd-2)' } },
  published: { label: 'Published', Icon: CheckCircle2,style: { background: 'rgba(52,211,153,0.1)', color: '#34d399',    borderColor: 'rgba(52,211,153,0.35)' } },
  running:   { label: 'Running',   Icon: Activity,    style: { background: 'rgba(59,130,246,0.1)', color: 'var(--ac-lt)',borderColor: 'rgba(59,130,246,0.35)' } },
  failed:    { label: 'Failed',    Icon: XCircle,     style: { background: 'rgba(248,113,113,0.1)',color: 'var(--err)', borderColor: 'rgba(248,113,113,0.35)' } },
  success:   { label: 'Success',   Icon: CheckCircle2,style: { background: 'rgba(52,211,153,0.1)', color: '#34d399',    borderColor: 'rgba(52,211,153,0.35)' } },
  warning:   { label: 'Warning',   Icon: FileWarning, style: { background: 'rgba(251,191,36,0.1)', color: 'var(--warn)',borderColor: 'rgba(251,191,36,0.35)' } },
  disabled:  { label: 'Disabled',  Icon: PauseCircle, style: { background: 'rgba(71,85,105,0.2)',  color: 'var(--tx2)', borderColor: 'var(--bd)' } },
  locked:    { label: 'Locked',    Icon: Lock,        style: { background: 'rgba(71,85,105,0.2)',  color: 'var(--tx3)', borderColor: 'var(--bd)' } },
  archived:  { label: 'Archived',  Icon: Archive,     style: { background: 'rgba(71,85,105,0.2)',  color: 'var(--tx2)', borderColor: 'var(--bd)' } },
};

export function StatusBadge({ status }: { status: ObjectStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        fontSize: 'var(--fs-micro)',
        fontWeight: 'var(--fw-semi)',
        padding: '2px 8px',
        borderRadius: 3,
        border: '1px solid',
        ...cfg.style,
      }}
    >
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

// ─── Hierarchy breadcrumb ─────────────────────────────────────────────────

function normalizeLabel(value: string): string {
  return value.trim().replace(/^\*/, '').toLowerCase();
}

function HierarchyBreadcrumb({ path, currentName }: { path: string; currentName?: string }) {
  const parts = path.split('→').map(p => p.trim()).filter(Boolean);
  const effectiveParts = currentName && parts.length > 0 && normalizeLabel(parts[parts.length - 1] ?? '') === normalizeLabel(currentName)
    ? parts.slice(0, -1)
    : parts;

  if (effectiveParts.length === 0) return null;

  return (
    <div className="thm-obj-breadcrumb">
      {effectiveParts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <ChevronRight className="w-2.5 h-2.5 crumb-sep flex-shrink-0" style={{ color: 'var(--tx3)' }} />
          )}
          <span
            className={i < effectiveParts.length - 1 ? 'crumb-link' : 'crumb-current'}
            title={part}
          >
            {part}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main ObjectHeader ────────────────────────────────────────────────────

interface ObjectHeaderProps {
  type: TabType;
  name: string;
  hierarchyPath?: string;
  status?: ObjectStatus;
  isDirty?: boolean;
  hideTitle?: boolean;
  isReadOnly?: boolean;
  isLocked?: boolean;
  actions?: React.ReactNode;
}

export function ObjectHeader({
  type, name, hierarchyPath, status, isDirty, hideTitle, isReadOnly, isLocked, actions,
}: ObjectHeaderProps) {
  return (
    <div className="thm-obj-header">
      <div className="flex items-start gap-3">

        {/* Object type icon */}
        <div className="mt-0.5 flex-shrink-0">
          <ObjectTypeIcon type={type} size={18} />
        </div>

        {/* Name + breadcrumb */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!hideTitle && (
              <h1 className={`thm-obj-title ${isDirty ? 'italic' : ''}`}>
                {isDirty ? `*${name}` : name}
              </h1>
            )}

            {status && <StatusBadge status={status} />}

            {isLocked && (
              <span
                className="inline-flex items-center gap-1"
                style={{
                  fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-semi)',
                  padding: '2px 8px', borderRadius: 3, border: '1px solid',
                  background: 'rgba(71,85,105,0.2)', color: 'var(--tx3)', borderColor: 'var(--bd)',
                }}
              >
                <Lock className="w-2.5 h-2.5" /> Locked
              </span>
            )}

            {isReadOnly && (
              <span
                className="inline-flex items-center gap-1"
                style={{
                  fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-semi)',
                  padding: '2px 8px', borderRadius: 3, border: '1px solid',
                  background: 'rgba(71,85,105,0.15)', color: 'var(--tx2)', borderColor: 'var(--bd)',
                }}
              >
                <AlertCircle className="w-2.5 h-2.5" /> Read-only
              </span>
            )}

            {isDirty && (
              <span
                className="inline-flex items-center gap-1"
                style={{
                  fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-semi)',
                  padding: '2px 8px', borderRadius: 3, border: '1px solid',
                  background: 'rgba(251,191,36,0.10)', color: 'var(--warn)', borderColor: 'rgba(251,191,36,0.30)',
                }}
              >
                <Clock className="w-2.5 h-2.5" /> Unsaved
              </span>
            )}
          </div>

          {hierarchyPath && (
            <HierarchyBreadcrumb path={hierarchyPath} currentName={name} />
          )}
        </div>

        {/* Actions slot */}
        {actions && (
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
