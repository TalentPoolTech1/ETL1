import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export function LineageVisualizer({ nodes, links, selectedColumn, }) {
    const [expandedColumn, setExpandedColumn] = useState(selectedColumn || null);
    // Find upstream and downstream nodes
    const getUpstream = (nodeId) => {
        const upstream = [];
        const visited = new Set();
        const traverse = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            links
                .filter(link => link.target === id)
                .forEach(link => {
                upstream.push(link.source);
                traverse(link.source);
            });
        };
        traverse(nodeId);
        return upstream;
    };
    const getDownstream = (nodeId) => {
        const downstream = [];
        const visited = new Set();
        const traverse = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            links
                .filter(link => link.source === id)
                .forEach(link => {
                downstream.push(link.target);
                traverse(link.target);
            });
        };
        traverse(nodeId);
        return downstream;
    };
    return (_jsxs("div", { className: "p-4 space-y-4", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Data Lineage" }), _jsx("div", { className: "bg-neutral-50 rounded-lg p-4 h-64 border border-neutral-200 overflow-auto", children: _jsx("div", { className: "space-y-3", children: nodes.map(node => (_jsxs("div", { className: "bg-white rounded-md p-3 border border-neutral-200 hover:border-primary-500", children: [_jsx("p", { className: "text-sm font-medium text-neutral-900", children: node.name }), _jsx("div", { className: "mt-2 space-y-1", children: node.columns.map(col => (_jsxs("div", { className: `
                      text-xs px-2 py-1 rounded cursor-pointer
                      ${expandedColumn === `${node.id}.${col}` ? 'bg-primary-100 text-primary-900' : 'bg-neutral-100 text-neutral-700'}
                    `, onClick: () => setExpandedColumn(expandedColumn === `${node.id}.${col}` ? null : `${node.id}.${col}`), children: ["\uD83D\uDCDD ", col] }, col))) })] }, node.id))) }) }), expandedColumn && (_jsxs("div", { className: "bg-primary-50 rounded-lg p-3 border border-primary-200", children: [_jsxs("p", { className: "text-sm font-medium text-primary-900 mb-2", children: ["Lineage for ", expandedColumn] }), _jsxs("div", { className: "text-xs text-primary-800 space-y-1", children: [_jsxs("p", { children: ["Upstream sources: ", getUpstream(expandedColumn.split('.')[0]).length] }), _jsxs("p", { children: ["Downstream targets: ", getDownstream(expandedColumn.split('.')[0]).length] })] })] }))] }));
}
export function UndoRedoTimeline({ history, currentIndex, onSelect, }) {
    return (_jsxs("div", { className: "p-4 space-y-4", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Change History" }), _jsx("div", { className: "space-y-2", children: history.map((state, idx) => (_jsx("button", { onClick: () => onSelect(idx), className: `
              w-full text-left px-3 py-2 rounded-md text-sm transition-colors
              ${idx === currentIndex ? 'bg-primary-100 text-primary-900 font-medium' : 'hover:bg-neutral-100 text-neutral-700'}
            `, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: state.description }), _jsx("span", { className: "text-xs text-neutral-500", children: state.timestamp.toLocaleTimeString() })] }) }, state.id))) })] }));
}
export function DataQualityDashboard({ metrics }) {
    const getStatusColor = (status) => {
        switch (status) {
            case 'good':
                return 'text-success-700 bg-success-50';
            case 'warning':
                return 'text-warning-700 bg-warning-50';
            case 'critical':
                return 'text-danger-700 bg-danger-50';
            default:
                return 'text-neutral-700 bg-neutral-50';
        }
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'good':
                return '✓';
            case 'warning':
                return '⚠';
            case 'critical':
                return '✕';
            default:
                return '?';
        }
    };
    return (_jsxs("div", { className: "p-4 space-y-4", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Data Quality" }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: metrics.map(metric => (_jsxs("div", { className: `p-3 rounded-lg ${getStatusColor(metric.status)}`, children: [_jsx("p", { className: "text-xs font-medium mb-1", children: metric.name }), _jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("p", { className: "text-lg font-bold", children: [metric.value, "%"] }), _jsx("span", { className: "text-lg", children: getStatusIcon(metric.status) })] }), _jsx("div", { className: "mt-2 w-full bg-neutral-300 h-1.5 rounded-full overflow-hidden", children: _jsx("div", { className: `h-full ${metric.status === 'good' ? 'bg-success-600' : metric.status === 'warning' ? 'bg-warning-600' : 'bg-danger-600'}`, style: { width: `${metric.value}%` } }) }), _jsxs("p", { className: "text-xs text-neutral-600 mt-1", children: ["Target: ", metric.target, "%"] })] }, metric.name))) })] }));
}
