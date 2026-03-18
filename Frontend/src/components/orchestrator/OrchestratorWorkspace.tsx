/**
 * OrchestratorWorkspace
 * 9 sub-tabs per spec: Designer | Properties | Schedule | Parameters |
 *                      History  | Runs | Dependencies | Permissions | Activity
 */
import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { markTabUnsaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { OrchestratorEditorSubTab }           from './sub-tabs/OrchestratorEditorSubTab';
import { OrchestratorPropertiesSubTab }       from './sub-tabs/OrchestratorPropertiesSubTab';
import { OrchestratorScheduleSubTab }         from './sub-tabs/OrchestratorScheduleSubTab';
import { OrchestratorExecutionHistorySubTab } from './sub-tabs/OrchestratorExecutionHistorySubTab';
import { OrchestratorPermissionsSubTab }      from './sub-tabs/OrchestratorPermissionsSubTab';
import { OrchestratorDependenciesSubTab }     from './sub-tabs/OrchestratorDependenciesSubTab';
import { OrchestratorActivitySubTab }         from './sub-tabs/OrchestratorActivitySubTab';
import type { OrchestratorSubTab } from '@/types';

const ORCHESTRATOR_SUB_TABS = [
  { id: 'editor',       label: 'Designer',     shortcut: '1' },
  { id: 'properties',   label: 'Properties',   shortcut: '2' },
  { id: 'schedule',     label: 'Schedule',     shortcut: '3' },
  { id: 'parameters',   label: 'Parameters',   shortcut: '4' },
  { id: 'history',      label: 'History',      shortcut: '5' },
  { id: 'runs',         label: 'Runs',         shortcut: '6' },
  { id: 'dependencies', label: 'Dependencies', shortcut: '7' },
  { id: 'permissions',  label: 'Permissions',  shortcut: '8' },
  { id: 'activity',     label: 'Activity',     shortcut: '9' },
] satisfies { id: OrchestratorSubTab; label: string; shortcut: string }[];

interface OrchestratorWorkspaceProps { tabId: string; }

export function OrchestratorWorkspace({ tabId }: OrchestratorWorkspaceProps) {
  const dispatch     = useAppDispatch();
  const tab          = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const activeSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'editor') as OrchestratorSubTab;
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
      {activeSubTab === 'parameters'   && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-5">
          <p className="text-sm">No parameters defined. Parameters for orchestrators share the same interface as pipeline parameters.</p>
        </div>
      )}
      {activeSubTab === 'history'      && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} /></div>}
      {activeSubTab === 'runs'         && <OrchestratorExecutionHistorySubTab orchId={orchId} />}
      {activeSubTab === 'dependencies' && <OrchestratorDependenciesSubTab orchId={orchId} />}
      {activeSubTab === 'permissions'  && <OrchestratorPermissionsSubTab />}
      {activeSubTab === 'activity'     && <OrchestratorActivitySubTab orchId={orchId} />}
      {/* v2 additions */}
      {(activeSubTab as string) === 'alerts' && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-5">
          <p className="text-sm">Alert rules for orchestrators share the same configuration interface.</p>
        </div>
      )}
      {(activeSubTab as string) === 'metrics' && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-5">
          <p className="text-sm">Orchestrator metrics will be shown here once runs are available.</p>
        </div>
      )}
    </div>
  );
}
