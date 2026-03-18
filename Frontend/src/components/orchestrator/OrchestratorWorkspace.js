import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { markTabUnsaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { OrchestratorEditorSubTab } from './sub-tabs/OrchestratorEditorSubTab';
import { OrchestratorPropertiesSubTab } from './sub-tabs/OrchestratorPropertiesSubTab';
import { OrchestratorScheduleSubTab } from './sub-tabs/OrchestratorScheduleSubTab';
import { OrchestratorExecutionHistorySubTab } from './sub-tabs/OrchestratorExecutionHistorySubTab';
import { OrchestratorPermissionsSubTab } from './sub-tabs/OrchestratorPermissionsSubTab';
import { OrchestratorDependenciesSubTab } from './sub-tabs/OrchestratorDependenciesSubTab';
import { OrchestratorActivitySubTab } from './sub-tabs/OrchestratorActivitySubTab';
const ORCHESTRATOR_SUB_TABS = [
    { id: 'editor', label: 'Designer', shortcut: '1' },
    { id: 'properties', label: 'Properties', shortcut: '2' },
    { id: 'schedule', label: 'Schedule', shortcut: '3' },
    { id: 'parameters', label: 'Parameters', shortcut: '4' },
    { id: 'history', label: 'History', shortcut: '5' },
    { id: 'runs', label: 'Runs', shortcut: '6' },
    { id: 'dependencies', label: 'Dependencies', shortcut: '7' },
    { id: 'permissions', label: 'Permissions', shortcut: '8' },
    { id: 'activity', label: 'Activity', shortcut: '9' },
];
export function OrchestratorWorkspace({ tabId }) {
    const dispatch = useAppDispatch();
    const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
    const activeSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'editor');
    const orchId = tab?.objectId ?? '';
    return (_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden bg-[#0d0f1a]", children: [_jsx(ObjectHeader, { type: "orchestrator", name: tab?.objectName ?? '', hierarchyPath: tab?.hierarchyPath, status: "draft", isDirty: tab?.isDirty }), _jsx(SubTabBar, { tabId: tabId, tabs: ORCHESTRATOR_SUB_TABS, defaultTab: "editor" }), _jsx("div", { className: `flex-1 overflow-hidden ${activeSubTab === 'editor' ? 'flex' : 'hidden'}`, children: _jsx(OrchestratorEditorSubTab, {}) }), activeSubTab === 'properties' && _jsx(OrchestratorPropertiesSubTab, { orchId: orchId, onDirty: () => dispatch(markTabUnsaved(tabId)) }), activeSubTab === 'schedule' && _jsx(OrchestratorScheduleSubTab, { onDirty: () => dispatch(markTabUnsaved(tabId)) }), activeSubTab === 'parameters' && (_jsx("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 p-5", children: _jsx("p", { className: "text-sm", children: "No parameters defined. Parameters for orchestrators share the same interface as pipeline parameters." }) })), activeSubTab === 'history' && _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(ObjectHistoryGrid, { rows: [] }) }), activeSubTab === 'runs' && _jsx(OrchestratorExecutionHistorySubTab, { orchId: orchId }), activeSubTab === 'dependencies' && _jsx(OrchestratorDependenciesSubTab, { orchId: orchId }), activeSubTab === 'permissions' && _jsx(OrchestratorPermissionsSubTab, {}), activeSubTab === 'activity' && _jsx(OrchestratorActivitySubTab, { orchId: orchId }), activeSubTab === 'alerts' && (_jsx("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 p-5", children: _jsx("p", { className: "text-sm", children: "Alert rules for orchestrators share the same configuration interface." }) })), activeSubTab === 'metrics' && (_jsx("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-600 p-5", children: _jsx("p", { className: "text-sm", children: "Orchestrator metrics will be shown here once runs are available." }) }))] }));
}
