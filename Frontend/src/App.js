import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Provider } from 'react-redux';
import { store } from '@/store';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ResizableAppShell } from '@/components/layout/ResizableAppShell';
import { Header } from '@/components/layout/Header';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { TabBar } from '@/components/tabs/TabBar';
import { PipelineWorkspace } from '@/components/pipeline/PipelineWorkspace';
import { OrchestratorWorkspace } from '@/components/orchestrator/OrchestratorWorkspace';
import { ProjectWorkspace } from '@/components/project/ProjectWorkspace';
import { FolderWorkspace } from '@/components/folder/FolderWorkspace';
import { ConnectionWorkspace } from '@/components/connection/ConnectionWorkspace';
import { MetadataBrowserWorkspace } from '@/components/metadata/MetadataBrowserWorkspace';
import { UserWorkspace } from '@/components/governance/UserWorkspace';
import { RoleWorkspace } from '@/components/governance/RoleWorkspace';
import { MonitorView } from '@/components/monitor/MonitorView';
import { ExecutionDetailTab } from '@/components/monitor/ExecutionDetailTab';
import { DashboardView } from '@/components/views/DashboardView';
import { SettingsView } from '@/components/views/SettingsView';
import { LineageExplorer } from '@/components/views/LineageExplorer';
import { GovernanceView } from '@/components/views/GovernanceView';
import { PropertiesPanel } from '@/components/properties/PropertiesPanel';
import { DataPreviewPanel } from '@/components/preview/DataPreviewPanel';
import { CommandPalette } from '@/components/common/CommandPalette';
import { LoginPage } from '@/components/auth/LoginPage';
import { useAppSelector } from '@/store/hooks';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import '@/styles/globals.css';
/**
 * Routes to the correct workspace component based on active tab type.
 * ALL objects open inside the tab strip — no page navigation.
 */
function WorkspaceRouter() {
    const activeTabId = useAppSelector(s => s.tabs.activeTabId);
    const activeTab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));
    const activeSubTab = useAppSelector(s => activeTabId ? (s.ui.subTabMap[activeTabId] ?? 'editor') : 'editor');
    const isEditorTab = activeSubTab === 'editor';
    const hasSelectedNode = useAppSelector(s => s.pipeline.selectedNodeIds.length > 0);
    const shell = (main, right, bottom) => (_jsx(ResizableAppShell, { header: _jsx(Header, {}), leftSidebar: _jsx(LeftSidebar, {}), mainArea: _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsx(TabBar, {}), main] }), rightSidebar: right, bottomPanel: bottom }));
    if (!activeTab) {
        return shell(_jsx("div", { className: "flex-1 flex items-center justify-center bg-[#0d0f1a]", children: _jsxs("div", { className: "text-center max-w-sm", children: [_jsx("div", { className: "w-14 h-14 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4", children: _jsx("svg", { className: "w-7 h-7 text-blue-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" }) }) }), _jsx("h2", { className: "text-base font-semibold text-slate-200 mb-1", children: "ETL1 Platform" }), _jsx("p", { className: "text-sm text-slate-500", children: "Select an object from the sidebar to get started." })] }) }));
    }
    switch (activeTab.type) {
        case 'pipeline':
            return shell(_jsx(PipelineWorkspace, { tabId: activeTab.id }), isEditorTab && hasSelectedNode ? _jsx(PropertiesPanel, {}) : undefined, isEditorTab && hasSelectedNode ? _jsx(DataPreviewPanel, {}) : undefined);
        case 'orchestrator':
            return shell(_jsx(OrchestratorWorkspace, { tabId: activeTab.id }));
        case 'project':
            return shell(_jsx(ProjectWorkspace, { tabId: activeTab.id }));
        case 'folder':
            return shell(_jsx(FolderWorkspace, { tabId: activeTab.id }));
        case 'connection':
        case 'connections':
            return shell(_jsx(ConnectionWorkspace, { tabId: activeTab.id }));
        case 'metadata':
            return shell(_jsx(MetadataBrowserWorkspace, { tabId: activeTab.id }));
        case 'user':
            return shell(_jsx(UserWorkspace, { tabId: activeTab.id }));
        case 'role':
            return shell(_jsx(RoleWorkspace, { tabId: activeTab.id }));
        case 'monitor':
            return shell(_jsx(MonitorView, {}));
        case 'execution':
            return shell(_jsx(ExecutionDetailTab, { runId: activeTab.objectId, executionKind: activeTab.executionKind ?? 'pipeline' }));
        case 'dashboard':
            return shell(_jsx(DashboardView, {}));
        case 'settings':
            return shell(_jsx(SettingsView, {}));
        case 'lineage':
            return shell(_jsx(LineageExplorer, {}));
        case 'governance':
            return shell(_jsx(GovernanceView, {}));
        default:
            return shell(_jsxs("div", { className: "flex-1 flex items-center justify-center bg-[#0d0f1a] text-slate-500 text-sm", children: ["No workspace registered for tab type: ", _jsx("span", { className: "ml-1 text-slate-400 font-mono", children: activeTab.type })] }));
    }
}
function AppContent() {
    const { commands, showCommandPalette, setShowCommandPalette, commandSearch, setCommandSearch } = useKeyboardShortcuts();
    const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
    if (!isAuthenticated)
        return _jsx(LoginPage, {});
    return (_jsxs(_Fragment, { children: [_jsx(WorkspaceRouter, {}), _jsx(CommandPalette, { isOpen: showCommandPalette, onClose: () => { setShowCommandPalette(false); setCommandSearch(''); }, commands: commands, searchText: commandSearch, onSearchChange: setCommandSearch })] }));
}
export function App() {
    return (_jsx(Provider, { store: store, children: _jsx(ThemeProvider, { children: _jsx(AppContent, {}) }) }));
}
export default App;
