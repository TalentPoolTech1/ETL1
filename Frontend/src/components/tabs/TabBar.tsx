import React from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { closeTab, setActiveTab } from '@/store/slices/tabsSlice';
import { Button } from '@/components/common/Button';

export function TabBar() {
  const dispatch = useAppDispatch();
  const { allTabs, activeTabId } = useAppSelector(state => state.tabs);

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(closeTab(tabId));
  };

  const handleSelectTab = (tabId: string) => {
    dispatch(setActiveTab(tabId));
  };

  return (
    <div className="h-12 bg-white border-b border-neutral-200 flex items-center gap-1 px-2 overflow-x-auto">
      {allTabs.map(tab => (
        <div
          key={tab.id}
          onClick={() => handleSelectTab(tab.id)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-t-md cursor-pointer transition-all
            min-w-min max-w-xs whitespace-nowrap
            ${
              activeTabId === tab.id
                ? 'bg-white border-b-2 border-primary-600 text-primary-600 font-medium'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }
          `}
        >
          <span className="text-sm">{tab.objectName}</span>
          {tab.unsaved && <span className="text-xs text-warning-600">●</span>}
          <button
            onClick={e => handleCloseTab(tab.id, e)}
            className="text-neutral-400 hover:text-neutral-600 ml-1"
            title="Close tab (Ctrl+W)"
          >
            ✕
          </button>
        </div>
      ))}

      {/* New Tab Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          /* Open new tab dialog */
        }}
        className="ml-auto"
        title="New tab"
      >
        +
      </Button>
    </div>
  );
}
