import { Provider } from 'react-redux';
import { store } from '@/store';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ResizableAppShell } from '@/components/layout/ResizableAppShell';
import { Header } from '@/components/layout/Header';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { TabBar } from '@/components/tabs/TabBar';
import { PipelineWorkspace } from '@/components/pipeline/PipelineWorkspace';
import { OrchestratorWorkspace } from '@/components/orchestrator/OrchestratorWorkspace';
import { MonitorView } from '@/components/monitor/MonitorView';
import { ExecutionDetailTab } from '@/components/monitor/ExecutionDetailTab';
import { PropertiesPanel } from '@/components/properties/PropertiesPanel';
import { DataPreviewPanel } from '@/components/preview/DataPreviewPanel';
import { CommandPalette } from '@/components/common/CommandPalette';
import { useAppSelector } from '@/store/hooks';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import '@/styles/globals.css';

/**
 * Selects the appropriate workspace based on the active tab type.
 *
 * - pipeline tabs      → PipelineWorkspace (7 sub-tabs)
 * - orchestrator tabs  → OrchestratorWorkspace (6 sub-tabs)
 * - other tab types    → legacy MetadataTree + PipelineCanvas layout
 *
 * PropertiesPanel and DataPreviewPanel are shown only for pipeline tabs
 * when the editor sub-tab is active, as they are canvas-specific.
 */
function WorkspaceRouter() {
  const activeTabId    = useAppSelector(s => s.tabs.activeTabId);
  const activeTab      = useAppSelector(s => s.tabs.allTabs.find(t => t.id === activeTabId));
  const activeSubTab   = useAppSelector(s => activeTabId ? (s.ui.subTabMap[activeTabId] ?? 'editor') : 'editor');
  const isEditorSubTab = activeSubTab === 'editor';

  if (activeTab?.type === 'pipeline') {
    return (
      <ResizableAppShell
        header={<Header />}
        leftSidebar={<LeftSidebar />}
        mainArea={
          <div className="flex-1 flex flex-col overflow-hidden">
            <TabBar />
            <PipelineWorkspace tabId={activeTab.id} />
          </div>
        }
        rightSidebar={isEditorSubTab ? <PropertiesPanel /> : undefined}
        bottomPanel={isEditorSubTab ? <DataPreviewPanel /> : undefined}
      />
    );
  }

  if (activeTab?.type === 'orchestrator') {
    return (
      <ResizableAppShell
        header={<Header />}
        leftSidebar={<LeftSidebar />}
        mainArea={
          <div className="flex-1 flex flex-col overflow-hidden">
            <TabBar />
            <OrchestratorWorkspace tabId={activeTab.id} />
          </div>
        }
      />
    );
  }

  if (activeTab?.type === 'monitor') {
    return (
      <ResizableAppShell
        header={<Header />}
        leftSidebar={<LeftSidebar />}
        mainArea={
          <div className="flex-1 flex flex-col overflow-hidden">
            <TabBar />
            <MonitorView />
          </div>
        }
      />
    );
  }

  if (activeTab?.type === 'execution') {
    return (
      <ResizableAppShell
        header={<Header />}
        leftSidebar={<LeftSidebar />}
        mainArea={
          <div className="flex-1 flex flex-col overflow-hidden">
            <TabBar />
            <ExecutionDetailTab
              runId={activeTab.objectId}
              executionKind={activeTab.executionKind ?? 'pipeline'}
            />
          </div>
        }
      />
    );
  }

  // Fallback: no active tab — show welcome screen
  return (
    <ResizableAppShell
      header={<Header />}
      leftSidebar={<LeftSidebar />}
      mainArea={
        <div className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          <div className="flex-1 flex items-center justify-center bg-neutral-50">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-neutral-900 mb-1">ETL1 Platform</h2>
              <p className="text-sm text-neutral-500">Select a project from the sidebar or open a pipeline to get started.</p>
            </div>
          </div>
        </div>
      }
    />
  );
}

function AppContent() {
  const { commands, showCommandPalette, setShowCommandPalette, commandSearch, setCommandSearch } =
    useKeyboardShortcuts();

  return (
    <>
      <WorkspaceRouter />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => {
          setShowCommandPalette(false);
          setCommandSearch('');
        }}
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
