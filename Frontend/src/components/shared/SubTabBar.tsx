import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSubTab } from '@/store/slices/uiSlice';

export interface SubTabDef {
  id: string;
  label: string;
  shortcut?: string;
}

interface SubTabBarProps {
  tabId: string;
  tabs: SubTabDef[];
  defaultTab: string;
}

export function SubTabBar({ tabId, tabs, defaultTab }: SubTabBarProps) {
  const dispatch     = useAppDispatch();
  const activeSubTab = useAppSelector(s => s.ui.subTabMap[tabId] ?? defaultTab);
  const unsaved = useAppSelector(s => {
    const tab = s.tabs.allTabs.find(t => t.id === tabId);
    return tab?.unsaved ?? false;
  });

  // Keyboard shortcuts Ctrl/Cmd+1..7
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < tabs.length) {
        e.preventDefault();
        dispatch(setSubTab({ tabId, subTab: tabs[idx]!.id }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, tabId, tabs]);

  return (
    <div
      role="tablist"
      aria-label="Sub-tabs"
      className="thm-subtab-bar"
    >
      {tabs.map(tab => {
        const active = activeSubTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => dispatch(setSubTab({ tabId, subTab: tab.id }))}
            className={`thm-subtab-btn ${active ? 'thm-subtab-btn--active' : ''}`}
          >
            {tab.label}
            {tab.id === 'editor' && unsaved && (
              <span
                className="ml-1 inline-block w-1.5 h-1.5 rounded-full align-middle"
                style={{ background: 'var(--warn)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
