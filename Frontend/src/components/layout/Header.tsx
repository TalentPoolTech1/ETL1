import React from 'react';
import { Bell, HelpCircle, Search, Zap, ChevronDown, GitBranch } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';

export function Header() {
  const activeTabId = useAppSelector(s => s.tabs.activeTabId);
  const activeTab   = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));

  return (
    <header className="h-11 bg-white border-b border-neutral-200 flex items-center px-3 gap-3 flex-shrink-0 z-20">
      {/* Logo mark */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm">
          <Zap className="w-4 h-4 text-white" fill="currentColor" />
        </div>
        <span className="text-sm font-bold text-neutral-900 tracking-tight">ETL1</span>
        <span className="hidden sm:inline-block px-1.5 py-0.5 bg-primary-50 text-primary-600 text-xs font-medium rounded border border-primary-100">
          Platform
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-neutral-200 flex-shrink-0" />

      {/* Breadcrumb / context */}
      {activeTab && (
        <div className="hidden md:flex items-center gap-1 text-xs text-neutral-500 flex-shrink-0">
          <span className="hover:text-neutral-700 cursor-pointer">Home</span>
          <span className="text-neutral-300 mx-0.5">/</span>
          <span className="text-neutral-700 font-medium">{activeTab.objectName}</span>
        </div>
      )}

      {/* Search */}
      <div className="flex-1 max-w-sm min-w-0 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search pipelines, datasets, jobs…"
          className="w-full h-7 pl-8 pr-16 bg-neutral-50 border border-neutral-200 rounded-md text-xs text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 focus:bg-white transition-all"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono bg-white border border-neutral-200 rounded px-1 leading-5 pointer-events-none">
          ⌘K
        </kbd>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Environment badge */}
      <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-md flex-shrink-0">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        <span className="text-xs font-medium text-emerald-700">Development</span>
      </div>

      {/* Branch */}
      <div className="hidden lg:flex items-center gap-1 text-xs text-neutral-400 flex-shrink-0">
        <GitBranch className="w-3 h-3" />
        <span>main</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          title="Notifications"
          className="relative w-7 h-7 flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-white" />
        </button>
        <button
          title="Help & docs"
          className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-neutral-200 mx-1" />

        {/* User avatar */}
        <button className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-md hover:bg-neutral-100 transition-colors">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold leading-none select-none">DE</span>
          </div>
          <ChevronDown className="w-3 h-3 text-neutral-400" />
        </button>
      </div>
    </header>
  );
}
