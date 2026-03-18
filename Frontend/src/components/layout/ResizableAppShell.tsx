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
        className={`w-px cursor-col-resize transition-colors flex-shrink-0 ${
          isDragging ? 'bg-blue-500' : 'bg-slate-800 hover:bg-blue-600'
        }`}
      />
    );
  } else {
    return (
      <div
        onMouseDown={handleMouseDown}
        className={`h-px cursor-row-resize transition-colors flex-shrink-0 ${
          isDragging ? 'bg-blue-500' : 'bg-slate-800 hover:bg-blue-600'
        }`}
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
      <div className="flex flex-col h-screen bg-[#0d0f1a]">
        <div className="flex-shrink-0">{header}</div>
        <div className="flex-1 overflow-hidden">{mainArea}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0d0f1a]">
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

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">{mainArea}</div>

        {/* Right Sidebar */}
        {rightRailVisible && rightSidebar && (
          <>
            <ResizeHandle
              position="right"
              onResize={handleRightResize}
              minSize={300}
              maxSize={600}
            />
            <div style={{ width: `${rightRailWidth}px` }} className="flex flex-col border-l border-slate-800 overflow-hidden">
              {rightSidebar}
            </div>
          </>
        )}
      </div>

      {/* Bottom Panel - Resizable */}
      {bottomPanelVisible && bottomPanel && (
        <>
          <ResizeHandle
            position="bottom"
            onResize={handleBottomResize}
            minSize={150}
            maxSize={700}
          />
          <div style={{ height: `${bottomPanelHeight}px` }} className="flex flex-col border-t border-slate-800 overflow-hidden">
            {bottomPanel}
          </div>
        </>
      )}

      {/* Status bar */}
      <div className="h-5 bg-[#070910] border-t border-slate-800/60 flex items-center px-3 gap-3 text-[11px] text-slate-600 flex-shrink-0">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
        <span className="text-slate-500">Connected</span>
        <span className="text-slate-800">·</span>
        <span>ETL1 Platform v1.0</span>
        <div className="flex-1" />
        <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </div>
  );
}
