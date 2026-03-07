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

  if (position === 'left') {
    return (
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 bg-neutral-200 hover:bg-primary-400 cursor-col-resize transition-colors ${isDragging ? 'bg-primary-400' : ''}`}
      />
    );
  } else if (position === 'right') {
    return (
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 bg-neutral-200 hover:bg-primary-400 cursor-col-resize transition-colors ${isDragging ? 'bg-primary-400' : ''}`}
      />
    );
  } else {
    return (
      <div
        onMouseDown={handleMouseDown}
        className={`h-1 bg-neutral-200 hover:bg-primary-400 cursor-row-resize transition-colors ${isDragging ? 'bg-primary-400' : ''}`}
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
      if (newWidth >= 200 && newWidth <= 500) {
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
      <div className="flex flex-col h-screen bg-white">
        <div className="h-14 border-b border-neutral-200">{header}</div>
        <div className="flex-1 overflow-hidden">{mainArea}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex-shrink-0">{header}</div>

      {/* Main Content - Resizable Panes */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {leftRailVisible && (
          <>
            <div style={{ width: `${leftRailWidth}px` }} className="flex flex-col border-r border-neutral-200 overflow-hidden">
              {leftSidebar}
            </div>
            <ResizeHandle
              position="left"
              onResize={handleLeftResize}
              minSize={200}
              maxSize={500}
            />
          </>
        )}

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">{mainArea}</div>

        {/* Right Sidebar */}
        {rightRailVisible && (
          <>
            <ResizeHandle
              position="right"
              onResize={handleRightResize}
              minSize={300}
              maxSize={600}
            />
            <div style={{ width: `${rightRailWidth}px` }} className="flex flex-col border-l border-neutral-200 overflow-hidden">
              {rightSidebar}
            </div>
          </>
        )}
      </div>

      {/* Bottom Panel - Resizable */}
      {bottomPanelVisible && (
        <>
          <ResizeHandle
            position="bottom"
            onResize={handleBottomResize}
            minSize={150}
            maxSize={700}
          />
          <div style={{ height: `${bottomPanelHeight}px` }} className="flex flex-col border-t border-neutral-200 overflow-hidden">
            {bottomPanel}
          </div>
        </>
      )}

      {/* Status bar */}
      <div className="h-5 bg-primary-600 flex items-center px-3 gap-4 text-xs text-primary-100 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
          <span>Connected</span>
        </div>
        <span className="text-primary-300">|</span>
        <span>ETL1 Platform v1.0</span>
        <div className="flex-1" />
        <span className="text-primary-300">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </div>
  );
}
