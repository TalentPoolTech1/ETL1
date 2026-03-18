/**
 * OrchestratorWorkspace
 * Active sub-tabs: Designer | Properties | Schedule | Permissions | Runs
 */
import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { markTabUnsaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { OrchestratorEditorSubTab }           from './sub-tabs/OrchestratorEditorSubTab';
import { OrchestratorPropertiesSubTab }       from './sub-tabs/OrchestratorPropertiesSubTab';
import { OrchestratorScheduleSubTab }         from './sub-tabs/OrchestratorScheduleSubTab';
import { OrchestratorPermissionsSubTab }      from './sub-tabs/OrchestratorPermissionsSubTab';
import { OrchestratorExecutionHistorySubTab } from './sub-tabs/OrchestratorExecutionHistorySubTab';
import type { OrchestratorSubTab } from '@/types';

const ORCHESTRATOR_SUB_TABS = [
  { id: 'editor',       label: 'Designer',     shortcut: '1' },
  { id: 'properties',   label: 'Properties',   shortcut: '2' },
  { id: 'schedule',     label: 'Schedule',     shortcut: '3' },
  { id: 'permissions',  label: 'Permissions',  shortcut: '4' },
  { id: 'runs',         label: 'Runs',         shortcut: '5' },
] satisfies { id: OrchestratorSubTab; label: string; shortcut: string }[];

interface OrchestratorWorkspaceProps { tabId: string; }

export function OrchestratorWorkspace({ tabId }: OrchestratorWorkspaceProps) {
  const dispatch     = useAppDispatch();
  const tab          = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const selectedSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'editor') as OrchestratorSubTab;
  const activeSubTab = ORCHESTRATOR_SUB_TABS.some(t => t.id === selectedSubTab) ? selectedSubTab : 'editor';
  const orchId       = tab?.objectId ?? '';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="orchestrator"
        name={tab?.objectName ?? ''}
        hierarchyPath={tab?.hierarchyPath}
        status="draft"
        isDirty={tab?.isDirty}
      />

      <SubTabBar tabId={tabId} tabs={ORCHESTRATOR_SUB_TABS} defaultTab="editor" />

      {/* Designer: always mounted, hidden when not active */}
      <div className={`flex-1 overflow-hidden ${activeSubTab === 'editor' ? 'flex' : 'hidden'}`}>
        <OrchestratorEditorSubTab />
      </div>

      {activeSubTab === 'properties'   && <OrchestratorPropertiesSubTab orchId={orchId} onDirty={() => dispatch(markTabUnsaved(tabId))} />}
      {activeSubTab === 'schedule'     && <OrchestratorScheduleSubTab onDirty={() => dispatch(markTabUnsaved(tabId))} />}
      {activeSubTab === 'permissions'  && <OrchestratorPermissionsSubTab orchId={orchId} />}
      {activeSubTab === 'runs'         && <OrchestratorExecutionHistorySubTab orchId={orchId} />}
    </div>
  );
}
