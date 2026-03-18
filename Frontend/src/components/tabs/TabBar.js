import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback } from 'react';
import { Workflow, GitMerge, FolderOpen, Folder, Plug2, Database, Users, Shield, Activity, BarChart2, GitBranch, Settings, Play, Pin, X, MoreHorizontal, RotateCcw, } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { closeTab, setActiveTab, closeOthers, closeAll, pinTab, unpinTab, restoreLastClosed, } from '@/store/slices/tabsSlice';
// ─── Tab icon by type ──────────────────────────────────────────────────────
function TabIcon({ type, size = 13 }) {
    const cls = `flex-shrink-0`;
    const s = { width: size, height: size };
    switch (type) {
        case 'pipeline': return _jsx(Workflow, { style: s, className: `${cls} text-sky-400` });
        case 'orchestrator': return _jsx(GitMerge, { style: s, className: `${cls} text-purple-400` });
        case 'project': return _jsx(FolderOpen, { style: s, className: `${cls} text-amber-400` });
        case 'folder': return _jsx(Folder, { style: s, className: `${cls} text-amber-300` });
        case 'connection':
        case 'connections': return _jsx(Plug2, { style: s, className: `${cls} text-emerald-400` });
        case 'metadata': return _jsx(Database, { style: s, className: `${cls} text-violet-400` });
        case 'user': return _jsx(Users, { style: s, className: `${cls} text-rose-400` });
        case 'role': return _jsx(Shield, { style: s, className: `${cls} text-orange-400` });
        case 'monitor': return _jsx(Activity, { style: s, className: `${cls} text-sky-500` });
        case 'execution': return _jsx(Play, { style: s, className: `${cls} text-green-400` });
        case 'dashboard': return _jsx(BarChart2, { style: s, className: `${cls} text-slate-400` });
        case 'lineage': return _jsx(GitBranch, { style: s, className: `${cls} text-teal-400` });
        case 'governance': return _jsx(Users, { style: s, className: `${cls} text-rose-400` });
        case 'settings': return _jsx(Settings, { style: s, className: `${cls} text-slate-400` });
        default: return _jsx(MoreHorizontal, { style: s, className: `${cls} text-slate-400` });
    }
}
function ContextMenu({ tab, x, y, onClose }) {
    const dispatch = useAppDispatch();
    const hasLastClosed = useAppSelector(s => !!s.tabs.lastClosedTab);
    const act = useCallback((fn) => {
        fn();
        onClose();
    }, [onClose]);
    const menuStyle = {
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 180),
        top: Math.min(y, window.innerHeight - 250),
        zIndex: 9999,
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-[9998]", onClick: onClose }), _jsxs("div", { style: menuStyle, className: "bg-[#1a1d2e] border border-slate-700 rounded-md shadow-xl py-1 min-w-[175px] text-xs", children: [_jsx(MenuItem, { label: "Close", onClick: () => act(() => dispatch(closeTab(tab.id))), disabled: !!tab.isPinned }), _jsx(MenuItem, { label: "Close Others", onClick: () => act(() => dispatch(closeOthers(tab.id))) }), _jsx(MenuItem, { label: "Close All", onClick: () => act(() => dispatch(closeAll())) }), _jsx("div", { className: "mx-2 border-t border-slate-700 my-1" }), _jsx(MenuItem, { label: tab.isPinned ? 'Unpin Tab' : 'Pin Tab', onClick: () => act(() => dispatch(tab.isPinned ? unpinTab(tab.id) : pinTab(tab.id))), icon: _jsx(Pin, { className: "w-3 h-3" }) }), hasLastClosed && (_jsx(MenuItem, { label: "Restore Last Closed", onClick: () => act(() => dispatch(restoreLastClosed())), icon: _jsx(RotateCcw, { className: "w-3 h-3" }) })), tab.hierarchyPath && (_jsxs(_Fragment, { children: [_jsx("div", { className: "mx-2 border-t border-slate-700 my-1" }), _jsx("div", { className: "px-3 py-1 text-[10px] text-slate-500 truncate max-w-[175px]", title: tab.hierarchyPath, children: tab.hierarchyPath })] }))] })] }));
}
function MenuItem({ label, onClick, disabled, icon }) {
    return (_jsxs("button", { onClick: disabled ? undefined : onClick, disabled: disabled, className: `w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${disabled
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100 cursor-pointer'}`, children: [icon && _jsx("span", { className: "text-slate-500", children: icon }), label] }));
}
// ─── Single tab chip ───────────────────────────────────────────────────────
function TabChip({ tab, isActive }) {
    const dispatch = useAppDispatch();
    const [ctx, setCtx] = useState(null);
    const handleContextMenu = (e) => {
        e.preventDefault();
        setCtx({ x: e.clientX, y: e.clientY });
    };
    const handleClose = (e) => {
        e.stopPropagation();
        if (!tab.isPinned)
            dispatch(closeTab(tab.id));
    };
    // Display name: italic + * when dirty
    const isDirty = tab.unsaved || tab.isDirty;
    const displayName = tab.objectName;
    const tooltip = [
        tab.hierarchyPath ?? tab.objectName,
        tab.type !== 'pipeline' && tab.type !== 'orchestrator' ? undefined : `Type: ${tab.type}`,
        isDirty ? 'Unsaved changes' : undefined,
        tab.isPinned ? 'Pinned' : undefined,
    ].filter(Boolean).join('\n');
    return (_jsxs(_Fragment, { children: [_jsxs("div", { title: tooltip, onClick: () => dispatch(setActiveTab(tab.id)), onContextMenu: handleContextMenu, className: `
          group flex items-center gap-1.5 px-2.5 h-full cursor-pointer select-none
          border-b-2 transition-all flex-shrink-0 max-w-[200px] min-w-[80px]
          ${isActive
                    ? 'border-blue-500 bg-[#0d0f1a] text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}
        `, children: [tab.isPinned && (_jsx(Pin, { className: "w-2.5 h-2.5 text-slate-500 flex-shrink-0 rotate-45" })), _jsx(TabIcon, { type: tab.type, size: 13 }), _jsx("span", { className: `text-[12px] truncate leading-none ${isDirty ? 'italic' : ''} ${isActive ? 'font-medium' : ''}`, children: isDirty ? `*${displayName}` : displayName }), !tab.isPinned && (_jsx("button", { onClick: handleClose, className: "w-4 h-4 flex items-center justify-center rounded text-slate-600 hover:text-slate-200 hover:bg-slate-600 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity ml-0.5", title: "Close (Ctrl+W)", children: _jsx(X, { className: "w-2.5 h-2.5" }) }))] }), ctx && (_jsx(ContextMenu, { tab: tab, x: ctx.x, y: ctx.y, onClose: () => setCtx(null) }))] }));
}
// ─── Main TabBar ───────────────────────────────────────────────────────────
export function TabBar() {
    const dispatch = useAppDispatch();
    const { allTabs, activeTabId, lastClosedTab } = useAppSelector(s => s.tabs);
    const scrollRef = useRef(null);
    // Horizontal scroll on wheel
    const handleWheel = (e) => {
        if (scrollRef.current) {
            e.preventDefault();
            scrollRef.current.scrollLeft += e.deltaY || e.deltaX;
        }
    };
    if (allTabs.length === 0)
        return null;
    return (_jsxs("div", { className: "flex items-stretch h-9 bg-[#0a0c15] border-b border-slate-800 flex-shrink-0", children: [_jsx("div", { ref: scrollRef, onWheel: handleWheel, className: "flex items-stretch flex-1 overflow-x-auto overflow-y-hidden", style: { scrollbarWidth: 'none' }, children: allTabs.map(tab => (_jsx(TabChip, { tab: tab, isActive: tab.id === activeTabId }, tab.id))) }), _jsx("div", { className: "flex items-center gap-0.5 px-1 border-l border-slate-800 flex-shrink-0", children: lastClosedTab && (_jsx("button", { title: `Restore "${lastClosedTab.objectName}"`, onClick: () => dispatch(restoreLastClosed()), className: "w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors", children: _jsx(RotateCcw, { className: "w-3 h-3" }) })) })] }));
}
