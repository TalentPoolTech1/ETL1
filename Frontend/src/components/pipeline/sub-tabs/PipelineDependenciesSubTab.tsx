/**
 * Pipeline > Dependencies sub-tab
 * Wired to the lineage API to display upstream/downstream dependencies.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Workflow, GitMerge, Plug2, Database, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '@/services/api';

interface Dep { id: string; name: string; type: 'pipeline' | 'orchestrator' | 'connection' | 'dataset'; direction: 'upstream' | 'downstream'; }

export function PipelineDependenciesSubTab({ pipelineId }: { pipelineId: string }) {
  const [deps, setDeps] = useState<Dep[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await api.getLineage(pipelineId);
      const data = res.data?.data ?? res.data;
      const nodes = data?.nodes ?? [];
      const edges = data?.edges ?? [];
      // Convert lineage graph into dependency list
      const mapped: Dep[] = [];
      for (const edge of edges) {
        const sourceNode = nodes.find((n: any) => n.id === edge.source);
        const targetNode = nodes.find((n: any) => n.id === edge.target);
        if (sourceNode && sourceNode.id !== pipelineId) {
          mapped.push({
            id: sourceNode.id,
            name: sourceNode.label ?? sourceNode.name ?? sourceNode.id,
            type: sourceNode.type ?? 'pipeline',
            direction: 'upstream',
          });
        }
        if (targetNode && targetNode.id !== pipelineId) {
          mapped.push({
            id: targetNode.id,
            name: targetNode.label ?? targetNode.name ?? targetNode.id,
            type: targetNode.type ?? 'pipeline',
            direction: 'downstream',
          });
        }
      }
      // Deduplicate
      const seen = new Set<string>();
      setDeps(mapped.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; }));
    } catch {
      setDeps([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { load(); }, [load]);

  const iconFor = (type: Dep['type']) => {
    if (type === 'pipeline')     return <Workflow   className="w-4 h-4 text-sky-400" />;
    if (type === 'orchestrator') return <GitMerge   className="w-4 h-4 text-purple-400" />;
    if (type === 'connection')   return <Plug2      className="w-4 h-4 text-emerald-400" />;
    return <Database className="w-4 h-4 text-violet-400" />;
  };

  const upstream   = deps.filter(d => d.direction === 'upstream');
  const downstream = deps.filter(d => d.direction === 'downstream');

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[12px] font-medium text-slate-300">Dependencies</span>
        <button onClick={load} className="ml-auto text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 border border-slate-700 px-2 py-1 rounded transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-slate-500 py-8 text-center">Loading dependencies…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
          {/* Upstream */}
          <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">
              <ArrowRight className="w-3.5 h-3.5 text-blue-400" /> Upstream Dependencies
            </div>
            {upstream.length === 0 ? (
              <p className="text-[12px] text-slate-600">No upstream dependencies.</p>
            ) : upstream.map(d => (
              <div key={d.id} className="flex items-center gap-2 py-2 border-b border-slate-800/50 last:border-0">
                {iconFor(d.type)}
                <span className="text-[12px] text-slate-300">{d.name}</span>
                <span className="text-[11px] text-slate-600 capitalize ml-auto">{d.type}</span>
              </div>
            ))}
          </div>

          {/* Downstream */}
          <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">
              <ArrowLeft className="w-3.5 h-3.5 text-purple-400" /> Downstream Impact
            </div>
            {downstream.length === 0 ? (
              <p className="text-[12px] text-slate-600">No downstream dependents.</p>
            ) : downstream.map(d => (
              <div key={d.id} className="flex items-center gap-2 py-2 border-b border-slate-800/50 last:border-0">
                {iconFor(d.type)}
                <span className="text-[12px] text-slate-300">{d.name}</span>
                <span className="text-[11px] text-slate-600 capitalize ml-auto">{d.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] text-slate-600 mt-4">Dependency data is populated from execution lineage records. Run the pipeline to generate lineage.</p>
    </div>
  );
}
