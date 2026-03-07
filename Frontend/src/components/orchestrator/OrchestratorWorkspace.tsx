/**
 * OrchestratorWorkspace
 *
 * Renders the 6-tab orchestrator workspace. The Editor sub-tab contains the
 * orchestrator DAG designer (placeholder) and is kept mounted (but hidden)
 * when other sub-tabs are active so state is not lost on sub-tab switch.
 */

import React from 'react';
import { useAppSelector } from '@/store/hooks';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { OrchestratorEditorSubTab }         from './sub-tabs/OrchestratorEditorSubTab';
import { OrchestratorOverviewSubTab }       from './sub-tabs/OrchestratorOverviewSubTab';
import { OrchestratorExecutionHistorySubTab } from './sub-tabs/OrchestratorExecutionHistorySubTab';
import { OrchestratorPermissionsSubTab }    from './sub-tabs/OrchestratorPermissionsSubTab';
import { OrchestratorAuditLogsSubTab }      from './sub-tabs/OrchestratorAuditLogsSubTab';
import { OrchestratorExecutionSubTab }      from './sub-tabs/OrchestratorExecutionSubTab';
import type { OrchestratorSubTab } from '@/types';

const ORCHESTRATOR_SUB_TABS = [
  { id: 'editor',            label: 'Editor',            shortcut: '1' },
  { id: 'overview',          label: 'Overview',          shortcut: '2' },
  { id: 'execution-history', label: 'Execution History', shortcut: '3' },
  { id: 'permissions',       label: 'Permissions',       shortcut: '4' },
  { id: 'audit-logs',        label: 'Audit Logs',        shortcut: '5' },
  { id: 'execution',         label: 'Execution',         shortcut: '6' },
] satisfies { id: OrchestratorSubTab; label: string; shortcut: string }[];

interface OrchestratorWorkspaceProps {
  tabId: string;
}

export function OrchestratorWorkspace({ tabId }: OrchestratorWorkspaceProps) {
  const activeSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'editor') as OrchestratorSubTab;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SubTabBar tabId={tabId} tabs={ORCHESTRATOR_SUB_TABS} defaultTab="editor" />

      {/* Editor: always mounted, hidden when not active */}
      <div className={`flex-1 overflow-hidden ${activeSubTab === 'editor' ? 'flex' : 'hidden'}`}>
        <OrchestratorEditorSubTab />
      </div>

      {/* Other sub-tabs: mounted on demand */}
      {activeSubTab === 'overview'          && <OrchestratorOverviewSubTab />}
      {activeSubTab === 'execution-history' && <OrchestratorExecutionHistorySubTab />}
      {activeSubTab === 'permissions'       && <OrchestratorPermissionsSubTab />}
      {activeSubTab === 'audit-logs'        && <OrchestratorAuditLogsSubTab />}
      {activeSubTab === 'execution'         && <OrchestratorExecutionSubTab />}
    </div>
  );
}
