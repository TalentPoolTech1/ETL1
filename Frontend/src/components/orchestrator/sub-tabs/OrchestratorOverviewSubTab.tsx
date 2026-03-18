import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import api from '@/services/api';
import { useAppDispatch } from '@/store/hooks';
import { openTab } from '@/store/slices/tabsSlice';

const RUN_STATUS_COLOR: Record<string, string> = {
  success:   'bg-success-100 text-success-800',
  failed:    'bg-danger-100  text-danger-800',
  running:   'bg-primary-100 text-primary-800',
  pending:   'bg-warning-100 text-warning-800',
  cancelled: 'bg-neutral-100 text-neutral-600',
};

interface RunRow { id: string; start: string; duration: string; status: string; triggeredBy: string; }
interface PipelineRow { pipeline_id: string; pipeline_display_name: string; active_version_id: string | null; }

function formatDuration(ms?: number | null) {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r}s`;
}

export function OrchestratorOverviewSubTab({ orchId }: { orchId: string }) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orchId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [orchRes, pipeRes, runsRes] = await Promise.all([
        api.getOrchestrator(orchId),
        api.getOrchestratorPipelines(orchId),
        api.getOrchestratorRuns({ orchestratorId: orchId, page: 1, pageSize: 20 }),
      ]);

      const orch = (orchRes.data as any)?.data ?? (orchRes.data as any);
      setDraftName(String(orch?.orch_display_name ?? orch?.orchDisplayName ?? ''));
      setDraftDesc(String(orch?.orch_desc_text ?? orch?.orchDescText ?? ''));

      const pipeRows = (pipeRes.data as any)?.data ?? [];
      setPipelines(Array.isArray(pipeRows) ? pipeRows : []);

      const runRows = (runsRes.data as any)?.data ?? (runsRes.data as any)?.runs ?? [];
      const mappedRuns: RunRow[] = (Array.isArray(runRows) ? runRows : []).map((r: any) => ({
        id: String(r.orchRunId ?? r.orch_run_id ?? r.orch_run_id ?? r.id ?? ''),
        start: String(r.startDtm ?? r.start_dtm ?? r.createdDtm ?? r.created_dtm ?? '—'),
        duration: typeof r.runDurationMs === 'number' ? formatDuration(r.runDurationMs) : (r.duration ?? '—'),
        status: String(r.runStatusCode ?? r.run_status_code ?? r.status ?? 'pending').toLowerCase(),
        triggeredBy: String(r.triggerTypeCode ?? r.trigger_type_code ?? r.trigger ?? 'manual').toLowerCase(),
      })).filter(x => x.id);
      setRuns(mappedRuns);
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to load orchestrator overview');
      setPipelines([]);
      setRuns([]);
    } finally {
      setIsLoading(false);
    }
  }, [orchId]);

  useEffect(() => { void load(); }, [load]);

  const successRate = useMemo(() => {
    const completed = runs.filter(r => r.status !== 'pending' && r.status !== 'running');
    if (completed.length === 0) return 0;
    const ok = completed.filter(r => r.status === 'success').length;
    return Math.round((ok / completed.length) * 100);
  }, [runs]);

  const lastRunStart = runs[0]?.start ?? '—';

  const openPipeline = (pipelineId: string, name: string) => {
    dispatch(openTab({
      id: `pipeline-${pipelineId}`,
      type: 'pipeline',
      objectId: pipelineId,
      objectName: name,
      hierarchyPath: `Orchestrator → Pipelines → ${name}`,
    } as any));
  };

  const triggerRun = async () => {
    if (!orchId) return;
    try {
      await api.runOrchestrator(orchId);
      void load();
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to trigger run');
    }
  };

  const saveProfile = async () => {
    if (!orchId) return;
    try {
      await api.saveOrchestrator(orchId, { orchDisplayName: draftName, orchDescText: draftDesc });
      setEditing(false);
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? e?.message ?? 'Failed to save orchestrator');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {error && (
        <div className="p-3 rounded border border-danger-200 bg-danger-50 text-danger-700 text-sm">
          {error}
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <Input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="Orchestrator name"
                className="text-xl font-semibold"
              />
              <textarea
                value={draftDesc}
                onChange={e => setDraftDesc(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveProfile} disabled={isLoading}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={isLoading}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-neutral-900 truncate">{draftName}</h2>
                <button
                  onClick={() => setEditing(true)}
                  className="text-neutral-400 hover:text-neutral-600 text-xs"
                >
                  ✎
                </button>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">{draftDesc || <span className="italic">No description</span>}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" onClick={triggerRun} disabled={isLoading}>▶ Run</Button>
          <Button size="sm" variant="ghost" onClick={load} disabled={isLoading}>Refresh</Button>
          <Button size="sm" variant="ghost" disabled title="Not implemented yet">Clone</Button>
          <Button size="sm" variant="ghost" disabled title="Not implemented yet">Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pipelines',    value: pipelines.length },
          { label: 'Success rate', value: `${successRate}%` },
          { label: 'Last run',     value: lastRunStart },
          { label: 'Schedule',     value: '—' },
        ].map(stat => (
          <div key={stat.label} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
            <div className="text-xs text-neutral-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Pipelines in DAG */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Pipelines in this orchestrator</h3>
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {['Pipeline', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pipelines.map(p => (
                <tr key={p.pipeline_id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-2 text-neutral-800 font-medium">{p.pipeline_display_name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.active_version_id ? 'bg-success-100 text-success-800' : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {p.active_version_id ? 'active' : 'draft'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-xs text-primary-600 hover:underline" onClick={() => openPipeline(p.pipeline_id, p.pipeline_display_name)}>Open ↗</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent runs */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Recent runs</h3>
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {['Run ID', 'Started', 'Duration', 'Status', 'Triggered by'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-neutral-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {runs.map(run => (
                <tr key={run.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-primary-600 cursor-pointer hover:underline">{run.id}</td>
                  <td className="px-4 py-2 text-neutral-600">{run.start}</td>
                  <td className="px-4 py-2 text-neutral-600">{run.duration}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RUN_STATUS_COLOR[run.status] ?? ''}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-500 capitalize">{run.triggeredBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
