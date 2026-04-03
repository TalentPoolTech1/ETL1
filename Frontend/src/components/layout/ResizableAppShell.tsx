import React, { useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setLeftRailWidth,
  setRightRailWidth,
  setBottomPanelHeight,
} from '@/store/slices/uiSlice';

interface ResizableHandle {
  position: 'left' | 'right' | 'bottom';
  onResize: (delta: number) => void;
  minSize: number;
  maxSize: number;
}

/**
 * Resizable divider handle for panels
 */
export function ResizeHandle({
  position,
  onResize,
  minSize,
  maxSize,
}: ResizableHandle) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = position === 'bottom' ? e.clientY : e.clientX;
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = position === 'bottom' ? e.clientY : e.clientX;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos; // track incrementally so delta stays small
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, onResize]);

  if (position === 'left' || position === 'right') {
    return (
      <div
        onMouseDown={handleMouseDown}
        className="w-px cursor-col-resize transition-colors flex-shrink-0"
        style={{ background: isDragging ? 'var(--ac)' : 'var(--bd)' }}
      />
    );
  } else {
    return (
      <div
        onMouseDown={handleMouseDown}
        className="h-px cursor-row-resize transition-colors flex-shrink-0"
        style={{ background: isDragging ? 'var(--ac)' : 'var(--bd)' }}
      />
    );
  }
}

/**
 * AppShell with resizable panels
 */
interface ResizableAppShellProps {
  header: React.ReactNode;
  leftSidebar: React.ReactNode;
  mainArea: React.ReactNode;
  /** Optional — omit to hide when a non-editor sub-tab is active. */
  rightSidebar?: React.ReactNode;
  /** Optional — omit to hide when a non-editor sub-tab is active. */
  bottomPanel?: React.ReactNode;
}

export function ResizableAppShell({
  header,
  leftSidebar,
  mainArea,
  rightSidebar,
  bottomPanel,
}: ResizableAppShellProps) {
  const dispatch = useAppDispatch();
  const { leftRailVisible, rightRailVisible, bottomPanelVisible, focusMode, leftRailWidth, rightRailWidth, bottomPanelHeight } = useAppSelector(
    state => state.ui
  );

  const handleLeftResize = useCallback(
    (delta: number) => {
      const newWidth = leftRailWidth + delta;
      if (newWidth >= 160 && newWidth <= 520) {
        dispatch(setLeftRailWidth(newWidth));
      }
    },
    [leftRailWidth, dispatch]
  );

  const handleRightResize = useCallback(
    (delta: number) => {
      const newWidth = rightRailWidth - delta; // right side, so delta is reversed
      if (newWidth >= 300 && newWidth <= 600) {
        dispatch(setRightRailWidth(newWidth));
      }
    },
    [rightRailWidth, dispatch]
  );

  const handleBottomResize = useCallback(
    (delta: number) => {
      const newHeight = bottomPanelHeight + delta;
      if (newHeight >= 150 && newHeight <= 700) {
        dispatch(setBottomPanelHeight(newHeight));
      }
    },
    [bottomPanelHeight, dispatch]
  );

  if (focusMode) {
    return (
      <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
        <div className="flex-shrink-0">{header}</div>
        <div className="flex-1 overflow-hidden">{mainArea}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex-shrink-0">{header}</div>

      {/* Main Content - Resizable Panes */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {leftRailVisible && (
          <>
            <div style={{ width: `${leftRailWidth}px` }} className="flex flex-col overflow-hidden flex-shrink-0">
              {leftSidebar}
            </div>
            <ResizeHandle
              position="left"
              onResize={handleLeftResize}
              minSize={180}
              maxSize={480}
            />
          </>
        )}

        {/* Center Workspace Column */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Main Area */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">{mainArea}</div>

            {/* Right Sidebar */}
            {rightRailVisible && rightSidebar && (
              <>
                <ResizeHandle
                  position="right"
                  onResize={handleRightResize}
                  minSize={300}
                  maxSize={600}
                />
                <div style={{ width: `${rightRailWidth}px`, borderLeft: '1px solid var(--bd)' }} className="flex flex-col overflow-hidden flex-shrink-0">
                  {rightSidebar}
                </div>
              </>
            )}
          </div>

          {/* Bottom Panel - only under the workspace column, never under the left rail */}
          {bottomPanelVisible && bottomPanel && (
            <>
              <ResizeHandle
                position="bottom"
                onResize={handleBottomResize}
                minSize={150}
                maxSize={700}
              />
              <div style={{ height: `${bottomPanelHeight}px`, borderTop: '1px solid var(--bd)' }} className="flex flex-col overflow-hidden flex-shrink-0">
                {bottomPanel}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="h-5 flex items-center px-3 gap-3 flex-shrink-0"
        style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--bd)', fontSize: 'var(--fs-sm)', color: 'var(--tx3)' }}>
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
        <span style={{ color: 'var(--tx2)' }}>Connected</span>
        <span style={{ color: 'var(--bd-2)' }}>·</span>
        <span>ETL1 Platform v1.0</span>
        <div className="flex-1" />
        <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </div>
  );
}
