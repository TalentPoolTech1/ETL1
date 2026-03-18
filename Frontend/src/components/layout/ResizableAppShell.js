import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setLeftRailWidth, setRightRailWidth, setBottomPanelHeight, } from '@/store/slices/uiSlice';
/**
 * Resizable divider handle for panels
 */
export function ResizeHandle({ position, onResize, minSize, maxSize, }) {
    const [isDragging, setIsDragging] = useState(false);
    const startPosRef = useRef(0);
    const startSizeRef = useRef(0);
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        startPosRef.current = position === 'bottom' ? e.clientY : e.clientX;
    };
    React.useEffect(() => {
        if (!isDragging)
            return;
        const handleMouseMove = (e) => {
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
        return (_jsx("div", { onMouseDown: handleMouseDown, className: `w-px cursor-col-resize transition-colors flex-shrink-0 ${isDragging ? 'bg-blue-500' : 'bg-slate-800 hover:bg-blue-600'}` }));
    }
    else {
        return (_jsx("div", { onMouseDown: handleMouseDown, className: `h-px cursor-row-resize transition-colors flex-shrink-0 ${isDragging ? 'bg-blue-500' : 'bg-slate-800 hover:bg-blue-600'}` }));
    }
}
export function ResizableAppShell({ header, leftSidebar, mainArea, rightSidebar, bottomPanel, }) {
    const dispatch = useAppDispatch();
    const { leftRailVisible, rightRailVisible, bottomPanelVisible, focusMode, leftRailWidth, rightRailWidth, bottomPanelHeight } = useAppSelector(state => state.ui);
    const handleLeftResize = useCallback((delta) => {
        const newWidth = leftRailWidth + delta;
        if (newWidth >= 160 && newWidth <= 520) {
            dispatch(setLeftRailWidth(newWidth));
        }
    }, [leftRailWidth, dispatch]);
    const handleRightResize = useCallback((delta) => {
        const newWidth = rightRailWidth - delta; // right side, so delta is reversed
        if (newWidth >= 300 && newWidth <= 600) {
            dispatch(setRightRailWidth(newWidth));
        }
    }, [rightRailWidth, dispatch]);
    const handleBottomResize = useCallback((delta) => {
        const newHeight = bottomPanelHeight + delta;
        if (newHeight >= 150 && newHeight <= 700) {
            dispatch(setBottomPanelHeight(newHeight));
        }
    }, [bottomPanelHeight, dispatch]);
    if (focusMode) {
        return (_jsxs("div", { className: "flex flex-col h-screen bg-[#0d0f1a]", children: [_jsx("div", { className: "flex-shrink-0", children: header }), _jsx("div", { className: "flex-1 overflow-hidden", children: mainArea })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-screen bg-[#0d0f1a]", children: [_jsx("div", { className: "flex-shrink-0", children: header }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [leftRailVisible && (_jsxs(_Fragment, { children: [_jsx("div", { style: { width: `${leftRailWidth}px` }, className: "flex flex-col overflow-hidden flex-shrink-0", children: leftSidebar }), _jsx(ResizeHandle, { position: "left", onResize: handleLeftResize, minSize: 180, maxSize: 480 })] })), _jsx("div", { className: "flex-1 flex flex-col overflow-hidden", children: mainArea }), rightRailVisible && rightSidebar && (_jsxs(_Fragment, { children: [_jsx(ResizeHandle, { position: "right", onResize: handleRightResize, minSize: 300, maxSize: 600 }), _jsx("div", { style: { width: `${rightRailWidth}px` }, className: "flex flex-col border-l border-slate-800 overflow-hidden", children: rightSidebar })] }))] }), bottomPanelVisible && bottomPanel && (_jsxs(_Fragment, { children: [_jsx(ResizeHandle, { position: "bottom", onResize: handleBottomResize, minSize: 150, maxSize: 700 }), _jsx("div", { style: { height: `${bottomPanelHeight}px` }, className: "flex flex-col border-t border-slate-800 overflow-hidden", children: bottomPanel })] })), _jsxs("div", { className: "h-5 bg-[#070910] border-t border-slate-800/60 flex items-center px-3 gap-3 text-[11px] text-slate-600 flex-shrink-0", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" }), _jsx("span", { className: "text-slate-500", children: "Connected" }), _jsx("span", { className: "text-slate-800", children: "\u00B7" }), _jsx("span", { children: "ETL1 Platform v1.0" }), _jsx("div", { className: "flex-1" }), _jsx("span", { children: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })] })] }));
}
