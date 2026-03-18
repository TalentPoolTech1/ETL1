import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/components/common/Button';
import api from '@/services/api';
export function LineageSubTab({ pipelineId }) {
    const pipeline = useAppSelector(s => s.pipeline.activePipeline);
    const nodes = useAppSelector(s => s.pipeline.nodes);
    const [selected, setSelected] = useState(null);
    const [apiLineage, setApiLineage] = useState(null);
    useEffect(() => {
        if (!pipelineId)
            return;
        api.getLineage(pipelineId)
            .then(res => {
            const data = res.data.data ?? res.data;
            setApiLineage(data);
        })
            .catch(() => { });
    }, [pipelineId]);
    if (!pipeline) {
        return _jsx("div", { className: "flex-1 flex items-center justify-center text-neutral-400 text-sm", children: "No pipeline loaded." });
    }
    // Build display from API if available, else derive from canvas nodes
    let lnodes = [];
    let ledges = [];
    if (apiLineage) {
        lnodes = apiLineage.nodes ?? [];
        ledges = apiLineage.edges ?? [];
    }
    else {
        lnodes = [{ id: '__pipeline__', label: pipeline.name, kind: 'pipeline', isCurrent: true }];
        Object.values(nodes).forEach(n => {
            if (n.type === 'source') {
                lnodes.push({ id: n.name, label: n.name, kind: 'dataset' });
                ledges.push({ from: n.name, to: '__pipeline__' });
            }
            else if (n.type === 'target') {
                lnodes.push({ id: n.name, label: n.name, kind: 'dataset' });
                ledges.push({ from: '__pipeline__', to: n.name });
            }
        });
    }
    return (_jsxs("div", { className: "flex-1 flex overflow-hidden", children: [_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden bg-neutral-50 border-r border-neutral-200", children: [_jsxs("div", { className: "flex items-center gap-2 px-4 py-2 border-b border-neutral-200 bg-white text-sm", children: [_jsx("span", { className: "font-medium text-neutral-700", children: "Lineage graph" }), _jsx("div", { className: "flex-1" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Impact analysis" }), _jsx(Button, { size: "sm", variant: "ghost", children: "Export" })] }), _jsx("div", { className: "flex-1 flex items-center justify-center p-8 overflow-auto", children: _jsxs("svg", { width: "680", height: "240", viewBox: "0 0 680 240", children: [_jsx("defs", { children: _jsx("marker", { id: "arrow", markerWidth: "8", markerHeight: "8", refX: "6", refY: "3", orient: "auto", children: _jsx("path", { d: "M0,0 L0,6 L8,3 z", fill: "#94a3b8" }) }) }), lnodes.map((n, i) => {
                                    const x = (i / Math.max(lnodes.length - 1, 1)) * 560 + 60;
                                    const y = 120;
                                    const isActive = selected === n.id;
                                    const fill = n.isCurrent ? '#3b82f6' : n.kind === 'orchestrator' ? '#8b5cf6' : '#e2e8f0';
                                    const textFill = (n.isCurrent || n.kind === 'orchestrator') ? '#fff' : '#374151';
                                    return (_jsxs("g", { onClick: () => setSelected(n.id), className: "cursor-pointer", children: [_jsx("rect", { x: x - 60, y: y - 22, width: 120, height: 44, rx: 6, fill: fill, stroke: isActive ? '#1d4ed8' : 'transparent', strokeWidth: 2 }), _jsx("text", { x: x, y: y + 5, textAnchor: "middle", fontSize: 12, fill: textFill, fontWeight: n.isCurrent ? 600 : 400, children: n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label }), _jsx("text", { x: x, y: y + 20, textAnchor: "middle", fontSize: 9, fill: textFill, opacity: 0.75, children: n.kind })] }, n.id));
                                }), ledges.map((e, i) => {
                                    const fromIdx = lnodes.findIndex(n => n.id === e.from);
                                    const toIdx = lnodes.findIndex(n => n.id === e.to);
                                    if (fromIdx < 0 || toIdx < 0)
                                        return null;
                                    const fromX = (fromIdx / Math.max(lnodes.length - 1, 1)) * 560 + 60 + 60;
                                    const toX = (toIdx / Math.max(lnodes.length - 1, 1)) * 560 + 60 - 60;
                                    return _jsx("line", { x1: fromX, y1: 120, x2: toX, y2: 120, stroke: "#94a3b8", strokeWidth: 1.5, markerEnd: "url(#arrow)" }, i);
                                }), lnodes.length === 1 && (_jsx("text", { x: 340, y: 160, textAnchor: "middle", fontSize: 12, fill: "#94a3b8", children: "Add source or target nodes to see lineage." }))] }) })] }), _jsxs("div", { className: "w-72 flex-shrink-0 flex flex-col overflow-hidden bg-white", children: [_jsx("div", { className: "px-4 py-2 border-b border-neutral-200 text-sm font-medium text-neutral-700", children: "References" }), _jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-2", children: lnodes.filter(n => !n.isCurrent).length === 0 ? (_jsx("p", { className: "text-sm text-neutral-400", children: "No upstream or downstream dependencies detected." })) : lnodes.filter(n => !n.isCurrent).map(n => (_jsxs("div", { onClick: () => setSelected(n.id), className: `p-3 border rounded-lg cursor-pointer transition-colors ${selected === n.id ? 'border-primary-300 bg-primary-50' : 'border-neutral-200 hover:bg-neutral-50'}`, children: [_jsx("div", { className: "text-sm font-medium text-neutral-800", children: n.label }), _jsx("div", { className: "text-xs text-neutral-400 capitalize mt-0.5", children: n.kind })] }, n.id))) })] })] }));
}
