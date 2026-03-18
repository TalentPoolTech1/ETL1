import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAppSelector } from '@/store/hooks';
export function AppShell({ header, leftSidebar, mainArea, rightSidebar, bottomPanel, }) {
    const { leftRailVisible, rightRailVisible, bottomPanelVisible, focusMode } = useAppSelector(state => state.ui);
    if (focusMode) {
        return (_jsxs("div", { className: "flex flex-col h-screen bg-white", children: [_jsx("div", { className: "h-14 border-b border-neutral-200", children: header }), _jsx("div", { className: "flex-1 overflow-hidden", children: mainArea })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-screen bg-white", children: [_jsx("div", { className: "h-14 border-b border-neutral-200 flex-shrink-0", children: header }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [leftRailVisible && _jsx("div", { className: "w-70 border-r border-neutral-200", children: leftSidebar }), _jsx("div", { className: "flex-1 flex flex-col overflow-hidden", children: mainArea }), rightRailVisible && _jsx("div", { className: "w-90 border-l border-neutral-200", children: rightSidebar })] }), bottomPanelVisible && (_jsx("div", { className: "h-65 border-t border-neutral-200 flex-shrink-0", children: bottomPanel })), _jsx("div", { className: "h-6 border-t border-neutral-200 bg-neutral-50 flex items-center px-2 text-xs text-neutral-500 flex-shrink-0", children: "Ready" })] }));
}
