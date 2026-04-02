/**
 * Pipeline > Lineage sub-tab — dark theme
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';
import { RefreshCw, Download } from 'lucide-react';
import api from '@/services/api';

interface Props { pipelineId: string; }

export function LineageSubTab({ pipelineId }: Props) {
  const pipeline = useAppSelector(s => s.pipeline.activePipeline);
  const nodes    = useAppSelector(s => s.pipeline.nodes);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [apiLineage, setApiLineage] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [loading,    setLoading]    = useState(false);

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await api.getLineage(pipelineId);
      setApiLineage(res.data?.data ?? res.data ?? null);
    } catch {
      setApiLineage(null);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { load(); }, [load]);

  if (!pipeline) {
    return <div className="flex-1 flex items-center justify-center text-slate-500 text-[13px] bg-[#0d0f1a]">No pipeline loaded.</div>;
  }

  let lnodes: { id: string; label: string; kind: string; isCurrent?: boolean }[] = [];
  let ledges: { source: string; target: string }[] = [];

  if (apiLineage) {
    lnodes = apiLineage.nodes ?? [];
    ledges = apiLineage.edges ?? [];
  } else {
    lnodes = [{ id: '__pipeline__', label: pipeline.name, kind: 'pipeline', isCurrent: true }];
    Object.values(nodes).forEach(n => {
      if (n.type === 'source') {
        lnodes.push({ id: n.id, label: n.name, kind: 'dataset' });
        ledges.push({ source: n.id, target: '__pipeline__' });
      } else if (n.type === 'target') {
        lnodes.push({ id: n.id, label: n.name, kind: 'dataset' });
        ledges.push({ source: '__pipeline__', target: n.id });
      }
    });
  }

  const nodeCount  = lnodes.length;
  const SVG_W      = Math.max(680, nodeCount * 160);
  const SVG_H      = 240;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0d0f1a]">
      {/* Graph panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-800">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-[#0a0c15] flex-shrink-0">
          <span className="text-[12px] font-semibold text-slate-300">Lineage graph</span>
          <button onClick={load}
            className="ml-2 h-7 px-2.5 rounded border border-slate-700 bg-[#1e2035] text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <div className="flex-1" />
          <button className="h-7 px-2.5 rounded border border-slate-700 bg-[#1e2035] text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1 transition-colors">
            <Download className="w-3 h-3" /> Export
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
          {loading ? (
            <div className="text-[13px] text-slate-500">Loading lineage…</div>
          ) : (
            <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ minWidth: SVG_W }}>
              <defs>
                <marker id="lineage-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
                </marker>
              </defs>
              {lnodes.map((n, i) => {
                const x        = nodeCount > 1 ? (i / (nodeCount - 1)) * (SVG_W - 160) + 80 : SVG_W / 2;
                const y        = SVG_H / 2;
                const isActive = selected === n.id;
                const fill     = n.isCurrent ? '#1d4ed8' : n.kind === 'orchestrator' ? '#7c3aed' : '#1e2035';
                const textFill = (n.isCurrent || n.kind === 'orchestrator') ? '#e2e8f0' : '#94a3b8';
                const border   = isActive ? '#60a5fa' : n.isCurrent ? '#3b82f6' : '#334155';
                return (
                  <g key={n.id} onClick={() => setSelected(n.id === selected ? null : n.id)} className="cursor-pointer">
                    <rect x={x - 60} y={y - 24} width={120} height={48} rx={6}
                      fill={fill} stroke={border} strokeWidth={isActive ? 2 : 1} />
                    <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fill={textFill} fontWeight={n.isCurrent ? 600 : 400}>
                      {n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label}
                    </text>
                    <text x={x} y={y + 18} textAnchor="middle" fontSize={9} fill={textFill} opacity={0.6}>{n.kind}</text>
                  </g>
                );
              })}
              {ledges.map((e, i) => {
                const fromIdx = lnodes.findIndex(n => n.id === e.source);
                const toIdx   = lnodes.findIndex(n => n.id === e.target);
                if (fromIdx < 0 || toIdx < 0) return null;
                const fromX = nodeCount > 1 ? (fromIdx / (nodeCount - 1)) * (SVG_W - 160) + 80 + 60 : SVG_W / 2 + 60;
                const toX   = nodeCount > 1 ? (toIdx   / (nodeCount - 1)) * (SVG_W - 160) + 80 - 60 : SVG_W / 2 - 60;
                return (
                  <line key={i} x1={fromX} y1={SVG_H / 2} x2={toX} y2={SVG_H / 2}
                    stroke="#475569" strokeWidth={1.5} markerEnd="url(#lineage-arrow)" />
                );
              })}
              {lnodes.length === 1 && (
                <text x={SVG_W / 2} y={SVG_H / 2 + 50} textAnchor="middle" fontSize={12} fill="#475569">
                  Add source or target nodes to see lineage.
                </text>
              )}
            </svg>
          )}
        </div>
      </div>

      {/* References panel */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden bg-[#0d0f1a]">
        <div className="px-4 py-2.5 border-b border-slate-800 text-[12px] font-semibold text-slate-300 bg-[#0a0c15]">
          References
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {lnodes.filter(n => !n.isCurrent).length === 0 ? (
            <p className="text-[12px] text-slate-600 py-4">No upstream or downstream dependencies.</p>
          ) : lnodes.filter(n => !n.isCurrent).map(n => (
            <div key={n.id} onClick={() => setSelected(n.id === selected ? null : n.id)}
              className={`p-2.5 border rounded-md cursor-pointer transition-colors ${
                selected === n.id
                  ? 'border-blue-600 bg-blue-900/30'
                  : 'border-slate-800 hover:bg-[#1e2035] hover:border-slate-700'
              }`}>
              <div className="text-[12px] font-medium text-slate-200">{n.label}</div>
              <div className="text-[10px] text-slate-500 capitalize mt-0.5">{n.kind}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
