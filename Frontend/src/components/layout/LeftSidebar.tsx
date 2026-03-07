import React from 'react';
import {
  Activity,
  Plug2,
  Database,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Workflow,
  LayoutDashboard,
  GitBranch,
  Users,
  Boxes,
  FolderOpen,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface NavButtonProps {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  badge?: number | string;
}

function NavButton({ icon: Icon, label, isActive, onClick, badge }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-xs font-medium transition-colors group ${
        isActive
          ? 'bg-primary-500/[0.15] text-primary-300'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      <Icon
        className={`w-[15px] h-[15px] flex-shrink-0 transition-colors ${
          isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'
        }`}
      />
      <span className="truncate flex-1 text-left">{label}</span>
      {badge != null && (
        <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full leading-none tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

interface SectionLabelProps {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addTitle?: string;
}

function SectionLabel({ label, expanded, onToggle, onAdd, addTitle }: SectionLabelProps) {
  return (
    <div className="flex items-center justify-between px-2.5 pt-4 pb-1 group/section">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-2.5 h-2.5" />
          : <ChevronRight className="w-2.5 h-2.5" />
        }
        {label}
      </button>
      {onAdd && (
        <button
          title={addTitle ?? `New ${label}`}
          onClick={onAdd}
          className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-200 hover:bg-slate-700 transition-colors opacity-0 group-hover/section:opacity-100"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LeftSidebar() {
  const dispatch    = useAppDispatch();
  const activeTabId = useAppSelector(s => s.tabs.activeTabId);
  const activeTab   = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));

  const [expandedProjects, setExpandedProjects] = React.useState(true);

  const isTabType = (type: string) => activeTab?.type === type;

  const openMonitor = () =>
    dispatch(openTab({
      id: 'monitor', type: 'monitor', objectId: 'monitor',
      objectName: 'Monitor', unsaved: false, isDirty: false,
    }));

  return (
    <aside className="flex flex-col h-full bg-slate-900 overflow-hidden" style={{ minWidth: 0 }}>

      {/* ── Logo strip ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 flex-shrink-0">
        <div className="w-5 h-5 bg-primary-600 rounded flex items-center justify-center flex-shrink-0">
          <Boxes className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-slate-300 tracking-wide">ETL1 Platform</span>
      </div>

      {/* ── Projects section ── */}
      <SectionLabel
        label="Projects"
        expanded={expandedProjects}
        onToggle={() => setExpandedProjects(v => !v)}
        onAdd={() => { /* TODO: dispatch openCreateProjectDialog */ }}
        addTitle="New Project"
      />

      {expandedProjects && (
        <div className="px-2.5 pb-2">
          {/* Empty state — no static data; projects will load from API */}
          <div className="flex flex-col items-center gap-2 py-4 rounded-md border border-dashed border-slate-700">
            <FolderOpen className="w-5 h-5 text-slate-600" />
            <p className="text-[11px] text-slate-600 text-center leading-tight">No projects yet</p>
            <button
              onClick={() => { /* TODO: dispatch openCreateProjectDialog */ }}
              className="flex items-center gap-1 text-[11px] text-primary-400 hover:text-primary-300 font-medium transition-colors"
            >
              <Plus className="w-3 h-3" />
              Create project
            </button>
          </div>
        </div>
      )}

      {/* ── Divider ── */}
      <div className="mx-3 mt-2 border-t border-slate-800" />

      {/* ── Platform nav ── */}
      <SectionLabel label="Platform" expanded={true} onToggle={() => {}} />

      <nav className="flex-1 px-1.5 pb-2 space-y-0.5 overflow-y-auto">
        <NavButton icon={LayoutDashboard} label="Dashboard"       isActive={false}                   onClick={() => {}} />
        <NavButton icon={Workflow}        label="Pipelines"        isActive={isTabType('pipeline')}   onClick={() => {}} />
        <NavButton icon={Activity}        label="Monitor"          isActive={isTabType('monitor')}    onClick={openMonitor} />
        <NavButton icon={Plug2}           label="Connections"      isActive={isTabType('connections')} onClick={() => {}} />
        <NavButton icon={Database}        label="Metadata Catalog" isActive={isTabType('metadata')}   onClick={() => {}} />
        <NavButton icon={GitBranch}       label="Lineage"          isActive={false}                   onClick={() => {}} />
        <NavButton icon={Users}           label="Governance"       isActive={false}                   onClick={() => {}} />
      </nav>

      {/* ── Settings ── */}
      <div className="border-t border-slate-800 p-1.5">
        <NavButton icon={Settings} label="Settings" isActive={false} onClick={() => {}} />
      </div>
    </aside>
  );
}
