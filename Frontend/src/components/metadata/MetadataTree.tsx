import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Database,
  Table2,
  Columns,
  Plug2,
  Search,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetaTreeNode {
  id: string;
  label: string;
  type: 'connector' | 'schema' | 'table' | 'column';
  rowCount?: number;
  children?: MetaTreeNode[];
}

interface MetadataTreeProps {
  nodes?: MetaTreeNode[];
  loading?: boolean;
  error?: string;
  onTableSelect?: (node: MetaTreeNode) => void;
  onTableDrag?: (node: MetaTreeNode, e: React.DragEvent) => void;
}

function TreeNode({
  node, depth, expanded, onToggle, onSelect, onDrag,
}: {
  node: MetaTreeNode; depth: number; expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect?: (node: MetaTreeNode) => void;
  onDrag?: (node: MetaTreeNode, e: React.DragEvent) => void;
}) {
  const isOpen = expanded[node.id];
  const hasChildren = (node.children?.length ?? 0) > 0;

  const icon = () => {
    const cls = 'w-3.5 h-3.5 flex-shrink-0';
    switch (node.type) {
      case 'connector': return <Plug2 className={`${cls} text-sky-400`} />;
      case 'schema':    return <Database className={`${cls} text-slate-300`} />;
      case 'table':     return <Table2 className={`${cls} text-emerald-400`} />;
      case 'column':    return <Columns className={`${cls} text-slate-400`} />;
    }
  };

  return (
    <>
      <div
        className="flex items-center gap-1.5 py-[5px] rounded hover:bg-slate-800 cursor-pointer group select-none"
        style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: '8px' }}
        onClick={() => { if (hasChildren) onToggle(node.id); if (node.type === 'table') onSelect?.(node); }}
        draggable={node.type === 'table'}
        onDragStart={e => node.type === 'table' && onDrag?.(node, e)}
      >
        <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center text-slate-400">
          {hasChildren
            ? (isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)
            : null}
        </span>
        {icon()}
        <span className="flex-1 text-xs text-slate-300 truncate group-hover:text-slate-100">{node.label}</span>
        {node.rowCount != null && (
          <span className="text-[12px] text-slate-400 tabular-nums opacity-0 group-hover:opacity-100">
            {node.rowCount >= 1000 ? `${(node.rowCount / 1000).toFixed(0)}k` : node.rowCount}
          </span>
        )}
      </div>
      {isOpen && hasChildren && node.children!.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onSelect={onSelect} onDrag={onDrag} />
      ))}
    </>
  );
}

export function MetadataTree({ nodes = [], loading = false, error, onTableSelect, onTableDrag }: MetadataTreeProps) {
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = useMemo(() => {
    if (!search.trim()) return nodes;
    const q = search.toLowerCase();
    const filterNode = (n: MetaTreeNode): MetaTreeNode | null => {
      const match = n.label.toLowerCase().includes(q);
      const filteredChildren = n.children?.map(filterNode).filter(Boolean) as MetaTreeNode[];
      if (match || filteredChildren?.length) return { ...n, children: filteredChildren?.length ? filteredChildren : n.children };
      return null;
    };
    return nodes.map(filterNode).filter(Boolean) as MetaTreeNode[];
  }, [nodes, search]);

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      <div className="px-2 py-2 border-b border-slate-800 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 pointer-events-none" />
          <input
            type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tables, columns…"
            className="w-full h-7 pl-6 pr-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Loading catalog…</span>
          </div>
        )}
        {!loading && error && (
          <div className="px-3 py-4 text-xs text-red-400 text-center">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 px-4 text-center">
            <Database className="w-6 h-6" />
            <p className="text-xs leading-relaxed">
              {search ? `No results for "${search}"` : 'No connectors configured.\nAdd a connection to browse tables.'}
            </p>
          </div>
        )}
        {!loading && !error && filtered.map(node => (
          <TreeNode key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} onSelect={onTableSelect} onDrag={onTableDrag} />
        ))}
      </div>
    </div>
  );
}
