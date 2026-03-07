import React, { useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/components/common/Button';

interface LineageEdge { from: string; to: string; }
interface LineageNode { id: string; label: string; kind: 'pipeline' | 'dataset' | 'orchestrator'; isCurrent?: boolean; }

// Derives a simple upstream/downstream graph from the active pipeline's nodes
function buildLineage(nodes: Record<string, { name: string; type: string }>, pipelineName: string) {
  const lnodes: LineageNode[] = [{ id: '__pipeline__', label: pipelineName, kind: 'pipeline', isCurrent: true }];
  const ledges: LineageEdge[] = [];

  Object.values(nodes).forEach(n => {
    if (n.type === 'source') {
      lnodes.push({ id: n.name, label: n.name, kind: 'dataset' });
      ledges.push({ from: n.name, to: '__pipeline__' });
    } else if (n.type === 'target') {
      lnodes.push({ id: n.name, label: n.name, kind: 'dataset' });
      ledges.push({ from: '__pipeline__', to: n.name });
    }
  });

  return { lnodes, ledges };
}

export function LineageSubTab() {
  const pipeline = useAppSelector(s => s.pipeline.activePipeline);
  const nodes    = useAppSelector(s => s.pipeline.nodes);
  const [selected, setSelected] = useState<string | null>(null);

  if (!pipeline) {
    return <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">No pipeline loaded.</div>;
  }

  const { lnodes, ledges } = buildLineage(nodes, pipeline.name);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Graph canvas */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50 border-r border-neutral-200">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-200 bg-white text-sm">
          <span className="font-medium text-neutral-700">Lineage graph</span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost">Impact analysis</Button>
          <Button size="sm" variant="ghost">Export</Button>
        </div>

        {/* Simple SVG lineage diagram */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <svg width="680" height="240" viewBox="0 0 680 240">
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Render nodes in a simple horizontal layout */}
            {lnodes.map((n, i) => {
              const x = (i / Math.max(lnodes.length - 1, 1)) * 560 + 60;
              const y = 120;
              const isActive = selected === n.id;
              const fill = n.isCurrent ? '#3b82f6' : n.kind === 'orchestrator' ? '#8b5cf6' : '#e2e8f0';
              const textFill = n.isCurrent || n.kind === 'orchestrator' ? '#fff' : '#374151';

              return (
                <g key={n.id} onClick={() => setSelected(n.id)} className="cursor-pointer">
                  <rect
                    x={x - 60} y={y - 22}
                    width={120} height={44}
                    rx={6}
                    fill={fill}
                    stroke={isActive ? '#1d4ed8' : 'transparent'}
                    strokeWidth={2}
                  />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize={12} fill={textFill} fontWeight={n.isCurrent ? 600 : 400}>
                    {n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label}
                  </text>
                  <text x={x} y={y + 20} textAnchor="middle" fontSize={9} fill={textFill} opacity={0.75}>
                    {n.kind}
                  </text>
                </g>
              );
            })}

            {/* Edges */}
            {ledges.map((e, i) => {
              const fromIdx = lnodes.findIndex(n => n.id === e.from);
              const toIdx   = lnodes.findIndex(n => n.id === e.to);
              if (fromIdx < 0 || toIdx < 0) return null;
              const fromX = (fromIdx / Math.max(lnodes.length - 1, 1)) * 560 + 60 + 60;
              const toX   = (toIdx   / Math.max(lnodes.length - 1, 1)) * 560 + 60 - 60;
              return (
                <line key={i} x1={fromX} y1={120} x2={toX} y2={120}
                  stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrow)" />
              );
            })}

            {lnodes.length === 1 && (
              <text x={340} y={160} textAnchor="middle" fontSize={12} fill="#94a3b8">
                Add source or target nodes to see lineage.
              </text>
            )}
          </svg>
        </div>
      </div>

      {/* Side panel: references */}
      <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden bg-white">
        <div className="px-4 py-2 border-b border-neutral-200 text-sm font-medium text-neutral-700">References</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lnodes.filter(n => !n.isCurrent).length === 0 ? (
            <p className="text-sm text-neutral-400">No upstream or downstream dependencies detected.</p>
          ) : lnodes.filter(n => !n.isCurrent).map(n => (
            <div key={n.id}
              onClick={() => setSelected(n.id)}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${selected === n.id ? 'border-primary-300 bg-primary-50' : 'border-neutral-200 hover:bg-neutral-50'}`}
            >
              <div className="text-sm font-medium text-neutral-800">{n.label}</div>
              <div className="text-xs text-neutral-400 capitalize mt-0.5">{n.kind}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
