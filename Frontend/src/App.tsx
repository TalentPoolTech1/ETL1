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
import { MetadataPreviewPanel } from '@/components/preview/MetadataPreviewPanel';
import { CommandPalette } from '@/components/common/CommandPalette';
import { LoginPage } from '@/components/auth/LoginPage';
import { useAppSelector } from '@/store/hooks';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import '@/styles/globals.css';
import React from 'react';

/**
 * Routes to the correct workspace component based on active tab type.
 * ALL objects open inside the tab strip — no page navigation.
 */
function WorkspaceRouter() {
  const activeTabId    = useAppSelector(s => s.tabs.activeTabId);
  const activeTab      = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));
  const metadataPreviewId = useAppSelector(s => s.ui.metadataPreviewDatasetId);

  const metaBottom = metadataPreviewId ? <MetadataPreviewPanel /> : undefined;

  const shell = (main: React.ReactNode, right?: React.ReactNode, bottom?: React.ReactNode) => (
    <ResizableAppShell
      header={<Header />}
      leftSidebar={<LeftSidebar />}
      mainArea={
        <div className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          {main}
        </div>
      }
      rightSidebar={right}
      bottomPanel={bottom}
    />
  );

  if (!activeTab) {
    return shell(
      <div className="flex-1 flex items-center justify-center bg-[#0d0f1a]">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-slate-200 mb-1">ETL1 Platform</h2>
          <p className="text-sm text-slate-500">Select an object from the sidebar to get started.</p>
        </div>
      </div>,
      undefined,
      metaBottom,
    );
  }

  switch (activeTab.type) {
    case 'pipeline':
      return shell(
        <PipelineWorkspace tabId={activeTab.id} />,
        undefined,
        metaBottom,
      );

    case 'orchestrator':
      return shell(<OrchestratorWorkspace tabId={activeTab.id} />, undefined, metaBottom);

    case 'project':
      return shell(<ProjectWorkspace tabId={activeTab.id} />, undefined, metaBottom);

    case 'folder':
      return shell(<FolderWorkspace tabId={activeTab.id} />, undefined, metaBottom);

    case 'connection':
    case 'connections':
      return shell(<ConnectionWorkspace tabId={activeTab.id} />, undefined, metaBottom);

    case 'metadata':
      return shell(<MetadataBrowserWorkspace tabId={activeTab.id} />, undefined, metaBottom);

    case 'user':
      return shell(<UserWorkspace tabId={activeTab.id} />, undefined, metaBottom);

    case 'role':
      return shell(<RoleWorkspace tabId={activeTab.id} />, undefined, metaBottom);

    case 'monitor':
      return shell(<MonitorView />, undefined, metaBottom);

    case 'execution':
      return shell(
        <ExecutionDetailTab
          runId={activeTab.objectId}
          executionKind={activeTab.executionKind ?? 'pipeline'}
        />,
        undefined,
        metaBottom,
      );

    case 'dashboard':
      return shell(<DashboardView />, undefined, metaBottom);

    case 'settings':
      return shell(<SettingsView />, undefined, metaBottom);

    case 'lineage':
      return shell(<LineageExplorer />);

    case 'governance':
      return shell(<GovernanceView />);

    default:
      return shell(
        <div className="flex-1 flex items-center justify-center bg-[#0d0f1a] text-slate-500 text-sm">
          No workspace registered for tab type: <span className="ml-1 text-slate-400 font-mono">{activeTab.type}</span>
        </div>
      );
  }
}

function AppContent() {
  const { commands, showCommandPalette, setShowCommandPalette, commandSearch, setCommandSearch } =
    useKeyboardShortcuts();
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  if (!isAuthenticated) return <LoginPage />;

  return (
    <>
      <WorkspaceRouter />
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => { setShowCommandPalette(false); setCommandSearch(''); }}
        commands={commands}
        searchText={commandSearch}
        onSearchChange={setCommandSearch}
      />
    </>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
