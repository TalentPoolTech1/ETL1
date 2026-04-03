import React, { useState, useRef, useCallback } from 'react';
import {
  Workflow, GitMerge, FolderOpen, Folder, Plug2, Database,
  Users, Shield, Activity, BarChart2, GitBranch, Settings,
  Play, Pin, X, MoreHorizontal, RotateCcw,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  closeTab, setActiveTab, closeOthers, closeAll,
  pinTab, unpinTab, restoreLastClosed,
} from '@/store/slices/tabsSlice';
import type { Tab, TabType } from '@/types';

// ─── Tab icon by type ──────────────────────────────────────────────────────

function TabIcon({ type, size = 13 }: { type: TabType; size?: number }) {
  const s = { width: size, height: size };
  const cls = 'flex-shrink-0';
  switch (type) {
    case 'pipeline':     return <Workflow   style={s} className={`${cls} text-sky-400`} />;
    case 'orchestrator': return <GitMerge   style={s} className={`${cls} text-purple-400`} />;
    case 'project':      return <FolderOpen style={s} className={`${cls} text-amber-400`} />;
    case 'folder':       return <Folder     style={s} className={`${cls} text-amber-300`} />;
    case 'connection':
    case 'connections':  return <Plug2      style={s} className={`${cls} text-emerald-400`} />;
    case 'metadata':     return <Database   style={s} className={`${cls} text-violet-400`} />;
    case 'user':         return <Users      style={s} className={`${cls} text-rose-400`} />;
    case 'role':         return <Shield     style={s} className={`${cls} text-orange-400`} />;
    case 'monitor':      return <Activity   style={s} className={`${cls} text-sky-500`} />;
    case 'execution':    return <Play       style={s} className={`${cls} text-green-400`} />;
    case 'dashboard':    return <BarChart2  style={s} className={`${cls} text-slate-400`} />;
    case 'lineage':      return <GitBranch  style={s} className={`${cls} text-teal-400`} />;
    case 'governance':   return <Users      style={s} className={`${cls} text-rose-400`} />;
    case 'settings':     return <Settings   style={s} className={`${cls} text-slate-400`} />;
    default:             return <MoreHorizontal style={s} className={`${cls} text-slate-400`} />;
  }
}

// ─── Context menu ─────────────────────────────────────────────────────────

interface ContextMenuProps {
  tab: Tab;
  x: number;
  y: number;
  onClose: () => void;
}

function ContextMenu({ tab, x, y, onClose }: ContextMenuProps) {
  const dispatch     = useAppDispatch();
  const hasLastClosed = useAppSelector(s => !!s.tabs.lastClosedTab);

  const act = useCallback((fn: () => void) => { fn(); onClose(); }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 180),
    top:  Math.min(y, window.innerHeight - 250),
    zIndex: 9999,
  };

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        style={{ ...menuStyle, background: 'var(--bg-4)', border: '1px solid var(--bd-2)', borderRadius: 6 }}
        className="shadow-xl py-1 min-w-[175px]"
      >
        <MenuItem label="Close"        onClick={() => act(() => dispatch(closeTab(tab.id)))}    disabled={!!tab.isPinned} />
        <MenuItem label="Close Others" onClick={() => act(() => dispatch(closeOthers(tab.id)))} />
        <MenuItem label="Close All"    onClick={() => act(() => dispatch(closeAll()))} />
        <div className="mx-2 my-1" style={{ borderTop: '1px solid var(--bd)' }} />
        <MenuItem
          label={tab.isPinned ? 'Unpin Tab' : 'Pin Tab'}
          onClick={() => act(() => dispatch(tab.isPinned ? unpinTab(tab.id) : pinTab(tab.id)))}
          icon={<Pin className="w-3 h-3" />}
        />
        {hasLastClosed && (
          <MenuItem
            label="Restore Last Closed"
            onClick={() => act(() => dispatch(restoreLastClosed()))}
            icon={<RotateCcw className="w-3 h-3" />}
          />
        )}
        {tab.hierarchyPath && (
          <>
            <div className="mx-2 my-1" style={{ borderTop: '1px solid var(--bd)' }} />
            <div
              className="px-3 py-1 truncate max-w-[175px]"
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)' }}
              title={tab.hierarchyPath}
            >
              {tab.hierarchyPath}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function MenuItem({ label, onClick, disabled, icon }: {
  label: string; onClick: () => void; disabled?: boolean; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ fontSize: 'var(--fs-sm)', color: disabled ? 'var(--tx3)' : 'var(--tx2)' }}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors
        ${disabled ? 'cursor-not-allowed' : 'hover:bg-[--bg-5] hover:text-[--tx1] cursor-pointer'}`}
    >
      {icon && <span style={{ color: 'var(--tx3)' }}>{icon}</span>}
      {label}
    </button>
  );
}

// ─── Single tab chip ───────────────────────────────────────────────────────

function TabChip({ tab, isActive }: { tab: Tab; isActive: boolean }) {
  const dispatch = useAppDispatch();
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY });
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tab.isPinned) dispatch(closeTab(tab.id));
  };

  const isDirty = tab.unsaved || tab.isDirty;

  const tooltip = [
    tab.hierarchyPath ?? tab.objectName,
    isDirty ? 'Unsaved changes' : undefined,
    tab.isPinned ? 'Pinned' : undefined,
  ].filter(Boolean).join('\n');

  return (
    <>
      <div
        title={tooltip}
        onClick={() => dispatch(setActiveTab(tab.id))}
        onContextMenu={handleContextMenu}
        className={`group thm-tab-chip ${isActive ? 'thm-tab-chip--active' : ''}`}
      >
        {tab.isPinned && (
          <Pin className="w-2.5 h-2.5 flex-shrink-0 rotate-45" style={{ color: 'var(--tx3)' }} />
        )}
        <TabIcon type={tab.type} size={12} />
        <span className={`truncate leading-none ${isDirty ? 'italic' : ''}`}>
          {isDirty ? `*${tab.objectName}` : tab.objectName}
        </span>
        {!tab.isPinned && (
          <button
            onClick={handleClose}
            title="Close (Ctrl+W)"
            className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 flex-shrink-0 ml-0.5 transition-opacity"
            style={{ color: 'var(--tx2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-6)', e.currentTarget.style.color = 'var(--tx1)')}
            onMouseLeave={e => (e.currentTarget.style.background = '', e.currentTarget.style.color = 'var(--tx2)')}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
      {ctx && (
        <ContextMenu tab={tab} x={ctx.x} y={ctx.y} onClose={() => setCtx(null)} />
      )}
    </>
  );
}

// ─── Main TabBar ───────────────────────────────────────────────────────────

export function TabBar() {
  const dispatch  = useAppDispatch();
  const { allTabs, activeTabId, lastClosedTab } = useAppSelector(s => s.tabs);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY || e.deltaX;
    }
  };

  if (allTabs.length === 0) return null;

  return (
    <div className="thm-tabbar">
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex items-stretch flex-1 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {allTabs.map(tab => (
          <TabChip key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
        ))}
      </div>

      {/* Overflow actions */}
      <div
        className="flex items-center gap-0.5 px-1 flex-shrink-0"
        style={{ borderLeft: '1px solid var(--bd)' }}
      >
        {lastClosedTab && (
          <button
            title={`Restore "${lastClosedTab.objectName}"`}
            onClick={() => dispatch(restoreLastClosed())}
            className="w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--tx2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-5)', e.currentTarget.style.color = 'var(--tx1)')}
            onMouseLeave={e => (e.currentTarget.style.background = '', e.currentTarget.style.color = 'var(--tx2)')}
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
