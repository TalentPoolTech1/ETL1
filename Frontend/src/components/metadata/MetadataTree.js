import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Database, Table2, Columns, Plug2, Search, Loader2, } from 'lucide-react';
function TreeNode({ node, depth, expanded, onToggle, onSelect, onDrag, }) {
    const isOpen = expanded[node.id];
    const hasChildren = (node.children?.length ?? 0) > 0;
    const icon = () => {
        const cls = 'w-3.5 h-3.5 flex-shrink-0';
        switch (node.type) {
            case 'connector': return _jsx(Plug2, { className: `${cls} text-sky-400` });
            case 'schema': return _jsx(Database, { className: `${cls} text-slate-500` });
            case 'table': return _jsx(Table2, { className: `${cls} text-emerald-400` });
            case 'column': return _jsx(Columns, { className: `${cls} text-slate-600` });
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-1.5 py-[5px] rounded hover:bg-slate-800 cursor-pointer group select-none", style: { paddingLeft: `${depth * 14 + 8}px`, paddingRight: '8px' }, onClick: () => { if (hasChildren)
                    onToggle(node.id); if (node.type === 'table')
                    onSelect?.(node); }, draggable: node.type === 'table', onDragStart: e => node.type === 'table' && onDrag?.(node, e), children: [_jsx("span", { className: "w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center text-slate-600", children: hasChildren
                            ? (isOpen ? _jsx(ChevronDown, { className: "w-3 h-3" }) : _jsx(ChevronRight, { className: "w-3 h-3" }))
                            : null }), icon(), _jsx("span", { className: "flex-1 text-xs text-slate-300 truncate group-hover:text-slate-100", children: node.label }), node.rowCount != null && (_jsx("span", { className: "text-[10px] text-slate-600 tabular-nums opacity-0 group-hover:opacity-100", children: node.rowCount >= 1000 ? `${(node.rowCount / 1000).toFixed(0)}k` : node.rowCount }))] }), isOpen && hasChildren && node.children.map(child => (_jsx(TreeNode, { node: child, depth: depth + 1, expanded: expanded, onToggle: onToggle, onSelect: onSelect, onDrag: onDrag }, child.id)))] }));
}
export function MetadataTree({ nodes = [], loading = false, error, onTableSelect, onTableDrag }) {
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState({});
    const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    const filtered = useMemo(() => {
        if (!search.trim())
            return nodes;
        const q = search.toLowerCase();
        const filterNode = (n) => {
            const match = n.label.toLowerCase().includes(q);
            const filteredChildren = n.children?.map(filterNode).filter(Boolean);
            if (match || filteredChildren?.length)
                return { ...n, children: filteredChildren?.length ? filteredChildren : n.children };
            return null;
        };
        return nodes.map(filterNode).filter(Boolean);
    }, [nodes, search]);
    return (_jsxs("div", { className: "flex flex-col h-full bg-slate-900 overflow-hidden", children: [_jsx("div", { className: "px-2 py-2 border-b border-slate-800 flex-shrink-0", children: _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" }), _jsx("input", { type: "search", value: search, onChange: e => setSearch(e.target.value), placeholder: "Search tables, columns\u2026", className: "w-full h-7 pl-6 pr-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary-500 transition-colors" })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto py-1", children: [loading && (_jsxs("div", { className: "flex flex-col items-center justify-center h-full gap-2 text-slate-600", children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin" }), _jsx("span", { className: "text-xs", children: "Loading catalog\u2026" })] })), !loading && error && (_jsx("div", { className: "px-3 py-4 text-xs text-red-400 text-center", children: error })), !loading && !error && filtered.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center h-full gap-2 text-slate-600 px-4 text-center", children: [_jsx(Database, { className: "w-6 h-6" }), _jsx("p", { className: "text-xs leading-relaxed", children: search ? `No results for "${search}"` : 'No connectors configured.\nAdd a connection to browse tables.' })] })), !loading && !error && filtered.map(node => (_jsx(TreeNode, { node: node, depth: 0, expanded: expanded, onToggle: toggle, onSelect: onTableSelect, onDrag: onTableDrag }, node.id)))] })] }));
}
