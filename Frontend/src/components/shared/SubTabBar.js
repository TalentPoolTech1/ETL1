import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSubTab } from '@/store/slices/uiSlice';
export function SubTabBar({ tabId, tabs, defaultTab }) {
    const dispatch = useAppDispatch();
    const activeSubTab = useAppSelector(s => s.ui.subTabMap[tabId] ?? defaultTab);
    const unsaved = useAppSelector(s => {
        const tab = s.tabs.allTabs.find(t => t.id === tabId);
        return tab?.unsaved ?? false;
    });
    // Keyboard shortcuts Ctrl/Cmd+1..7
    useEffect(() => {
        const handler = (e) => {
            if (!(e.ctrlKey || e.metaKey))
                return;
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < tabs.length) {
                e.preventDefault();
                dispatch(setSubTab({ tabId, subTab: tabs[idx].id }));
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [dispatch, tabId, tabs]);
    return (_jsx("div", { role: "tablist", "aria-label": "Pipeline sub-tabs", className: "flex items-center h-10 border-b border-neutral-200 bg-white px-4 gap-1 flex-shrink-0", children: tabs.map(tab => {
            const active = activeSubTab === tab.id;
            return (_jsxs("button", { role: "tab", "aria-selected": active, onClick: () => dispatch(setSubTab({ tabId, subTab: tab.id })), className: [
                    'relative px-3 py-1.5 text-sm rounded-sm transition-colors select-none',
                    active
                        ? 'text-primary-700 font-medium'
                        : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100',
                ].join(' '), children: [tab.label, tab.id === 'editor' && unsaved && (_jsx("span", { className: "ml-1 inline-block w-1.5 h-1.5 rounded-full bg-warning-500 align-middle" })), active && (_jsx("span", { className: "absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t-sm" }))] }, tab.id));
        }) }));
}
