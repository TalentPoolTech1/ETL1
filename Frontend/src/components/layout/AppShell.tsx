import React, { ReactNode } from 'react';
import { useAppSelector } from '@/store/hooks';

interface AppShellProps {
  header: ReactNode;
  leftSidebar: ReactNode;
  mainArea: ReactNode;
  rightSidebar: ReactNode;
  bottomPanel: ReactNode;
}

export function AppShell({
  header,
  leftSidebar,
  mainArea,
  rightSidebar,
  bottomPanel,
}: AppShellProps) {
  const { leftRailVisible, rightRailVisible, bottomPanelVisible, focusMode } = useAppSelector(
    state => state.ui
  );

  if (focusMode) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <div className="h-14 border-b border-neutral-200">{header}</div>
        <div className="flex-1 overflow-hidden">{mainArea}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="h-14 border-b border-neutral-200 flex-shrink-0">{header}</div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {leftRailVisible && <div className="w-70 border-r border-neutral-200">{leftSidebar}</div>}

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">{mainArea}</div>

        {/* Right Sidebar */}
        {rightRailVisible && <div className="w-90 border-l border-neutral-200">{rightSidebar}</div>}
      </div>

      {/* Bottom Panel */}
      {bottomPanelVisible && (
        <div className="h-65 border-t border-neutral-200 flex-shrink-0">{bottomPanel}</div>
      )}

      {/* Footer */}
      <div className="h-6 border-t border-neutral-200 bg-neutral-50 flex items-center px-2 text-xs text-neutral-500 flex-shrink-0">
        Ready
      </div>
    </div>
  );
}
