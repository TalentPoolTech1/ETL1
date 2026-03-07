/**
 * PipelineWorkspace
 *
 * Renders the 7-tab pipeline workspace. The Editor sub-tab contains the canvas
 * and is kept mounted (but hidden) when other sub-tabs are active so that
 * unsaved changes, zoom, and selection state are not lost.
 */

import React from 'react';
import { useAppSelector } from '@/store/hooks';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { PipelineCanvas } from '@/components/canvas/PipelineCanvas';
import { OverviewSubTab }          from './sub-tabs/OverviewSubTab';
import { ExecutionHistorySubTab }  from './sub-tabs/ExecutionHistorySubTab';
import { LineageSubTab }           from './sub-tabs/LineageSubTab';
import { PermissionsSubTab }       from './sub-tabs/PermissionsSubTab';
import { AuditLogsSubTab }         from './sub-tabs/AuditLogsSubTab';
import { ExecutionSubTab }         from './sub-tabs/ExecutionSubTab';
import type { PipelineSubTab } from '@/types';

const PIPELINE_SUB_TABS = [
  { id: 'editor',            label: 'Editor',            shortcut: '1' },
  { id: 'overview',          label: 'Overview',          shortcut: '2' },
  { id: 'execution-history', label: 'Execution History', shortcut: '3' },
  { id: 'lineage',           label: 'Lineage',           shortcut: '4' },
  { id: 'permissions',       label: 'Permissions',       shortcut: '5' },
  { id: 'audit-logs',        label: 'Audit Logs',        shortcut: '6' },
  { id: 'execution',         label: 'Execution',         shortcut: '7' },
] satisfies { id: PipelineSubTab; label: string; shortcut: string }[];

interface PipelineWorkspaceProps {
  tabId: string;
}

export function PipelineWorkspace({ tabId }: PipelineWorkspaceProps) {
  const activeSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'editor') as PipelineSubTab;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SubTabBar tabId={tabId} tabs={PIPELINE_SUB_TABS} defaultTab="editor" />

      {/* Editor: always mounted, hidden when not active to preserve canvas state */}
      <div className={`flex-1 overflow-hidden ${activeSubTab === 'editor' ? 'flex' : 'hidden'}`}>
        <PipelineCanvas />
      </div>

      {/* Other sub-tabs: mounted on demand */}
      {activeSubTab === 'overview'          && <OverviewSubTab />}
      {activeSubTab === 'execution-history' && <ExecutionHistorySubTab />}
      {activeSubTab === 'lineage'           && <LineageSubTab />}
      {activeSubTab === 'permissions'       && <PermissionsSubTab />}
      {activeSubTab === 'audit-logs'        && <AuditLogsSubTab />}
      {activeSubTab === 'execution'         && <ExecutionSubTab />}
    </div>
  );
}
