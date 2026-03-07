import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '@/services/api';
import { RunStatus, NodeRunDetail } from '@/types';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<RunStatus, string> = {
  PENDING:              'bg-neutral-100 text-neutral-600',
  QUEUED:               'bg-blue-100 text-blue-700',
  RUNNING:              'bg-blue-200 text-blue-800 animate-pulse',
  SUCCESS:              'bg-green-100 text-green-700',
  FAILED:               'bg-red-100 text-red-700',
  CANCELLED:            'bg-orange-100 text-orange-700',
  SKIPPED:              'bg-neutral-100 text-neutral-500',
  RETRYING:             'bg-yellow-100 text-yellow-700 animate-pulse',
  TIMED_OUT:            'bg-red-200 text-red-900',
  PARTIALLY_COMPLETED:  'bg-amber-100 text-amber-700',
};

function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-neutral-100 text-neutral-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// ─── Node step timeline ───────────────────────────────────────────────────────

interface NodeTimelineProps {
  nodes: NodeRunDetail[];
}

function NodeTimeline({ nodes }: NodeTimelineProps) {
  if (!nodes.length) return <div className="text-sm text-neutral-400 py-4">No node-level data available.</div>;

  const maxDuration = Math.max(...nodes.map(n => n.durationMs ?? 0), 1);

  return (
    <div className="space-y-2">
      {nodes.map(node => {
        const pct = Math.max(2, ((node.durationMs ?? 0) / maxDuration) * 100);
        const barColor = node.runStatus === 'SUCCESS' ? 'bg-green-500'
          : node.runStatus === 'FAILED' ? 'bg-red-500'
          : node.runStatus === 'RUNNING' ? 'bg-blue-400'
          : 'bg-neutral-300';

        return (
          <div key={node.nodeRunId} className="flex items-center gap-3">
            <div className="w-48 text-xs text-neutral-700 truncate font-mono" title={node.nodeDisplayName}>
              {node.nodeDisplayName || node.nodeIdInIrText}
            </div>
            <div className="flex-1 bg-neutral-100 rounded h-5 overflow-hidden relative">
              <div
                className={`h-full ${barColor} rounded transition-all`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-neutral-700">
                {fmtDuration(node.durationMs)}
              </span>
            </div>
            <StatusBadge status={node.runStatus} />
            <div className="w-24 text-right text-xs text-neutral-500">
              {node.rowsOut !== null ? `${node.rowsOut.toLocaleString()} rows` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Log viewer ───────────────────────────────────────────────────────────────

interface LogEntry {
  logDtm: string;
  logLevel: string;
  logMessage: string;
  nodeId?: string;
}

interface LogViewerProps {
  runId: string;
  autoRefresh: boolean;
}

function LogViewer({ runId, autoRefresh }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.getPipelineRunLogs(runId, { limit: 500 });
      setLogs(res.data.data ?? []);
    } catch {
      // log endpoint may not exist; silently degrade
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchLogs, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const levelColor = (level: string) => {
    switch (level) {
      case 'ERROR': case 'FATAL': return 'text-red-600';
      case 'WARN':               return 'text-amber-600';
      case 'INFO':               return 'text-green-700';
      case 'DEBUG': case 'TRACE':return 'text-neutral-400';
      default:                   return 'text-neutral-600';
    }
  };

  if (loading) return <div className="text-xs text-neutral-400 p-4">Loading logs…</div>;
  if (!logs.length) return <div className="text-xs text-neutral-400 p-4">No log entries captured for this run.</div>;

  return (
    <div className="bg-neutral-900 rounded-md overflow-auto max-h-80 font-mono text-xs p-3 space-y-0.5">
      {logs.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-neutral-500 shrink-0">{fmtDatetime(entry.logDtm)}</span>
          <span className={`shrink-0 w-12 ${levelColor(entry.logLevel)}`}>{entry.logLevel}</span>
          {entry.nodeId && <span className="text-neutral-500 shrink-0">[{entry.nodeId.slice(0, 8)}]</span>}
          <span className="text-neutral-200 break-all">{entry.logMessage}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Metrics panel ────────────────────────────────────────────────────────────

interface MetricItemProps { label: string; value: string | number | null; }

function MetricItem({ label, value }: MetricItemProps) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-sm font-semibold text-neutral-900">{value ?? '—'}</span>
    </div>
  );
}

// ─── Main ExecutionDetailTab ──────────────────────────────────────────────────

interface ExecutionDetailTabProps {
  runId: string;
  executionKind: 'pipeline' | 'orchestrator';
}

interface PipelineRunDetail {
  pipelineRunId: string;
  pipelineName: string;
  projectName: string | null;
  versionLabel: string;
  runStatus: RunStatus;
  triggerType: string;
  submittedBy: string | null;
  startDtm: string | null;
  endDtm: string | null;
  durationMs: number | null;
  rowsProcessed: number | null;
  bytesRead: number | null;
  bytesWritten: number | null;
  errorCategory: string | null;
  errorMessage: string | null;
  retryCount: number;
  slaStatus: string;
  generatedCodeRef: string | null;
  sparkJobId: string | null;
  sparkUiUrl: string | null;
  nodes: NodeRunDetail[];
}

type DetailSubTab = 'overview' | 'node-timeline' | 'logs' | 'metrics' | 'code';

export function ExecutionDetailTab({ runId, executionKind }: ExecutionDetailTabProps) {
  const [detail, setDetail] = useState<PipelineRunDetail | null>(null);
  const [nodes, setNodes] = useState<NodeRunDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<DetailSubTab>('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const isRunning = detail?.runStatus === 'RUNNING' || detail?.runStatus === 'RETRYING';

  const fetchDetail = useCallback(async () => {
    try {
      if (executionKind === 'pipeline') {
        const [detailRes, nodeRes] = await Promise.allSettled([
          api.getPipelineRunDetail(runId),
          api.getPipelineRunNodes(runId),
        ]);
        if (detailRes.status === 'fulfilled') setDetail(detailRes.value.data.data);
        if (nodeRes.status === 'fulfilled') setNodes(nodeRes.value.data.data ?? []);
      } else {
        const res = await api.getOrchestratorRunDetail(runId);
        setDetail(res.data.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load execution details';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [runId, executionKind]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (!autoRefresh || !isRunning) return;
    const t = setInterval(fetchDetail, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, isRunning, fetchDetail]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
        Loading execution details…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <div className="text-red-600 font-medium mb-2">Could not load execution</div>
          <div className="text-sm text-red-500">{error ?? 'Unknown error'}</div>
          <button
            onClick={fetchDetail}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const subTabs: { key: DetailSubTab; label: string }[] = [
    { key: 'overview',      label: 'Overview' },
    { key: 'node-timeline', label: 'Node Timeline' },
    { key: 'logs',          label: 'Logs' },
    { key: 'metrics',       label: 'Metrics' },
    { key: 'code',          label: 'Generated Code' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="border-b border-neutral-200 px-4 py-3 flex items-center gap-3 bg-neutral-50">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900">{detail.pipelineName}</span>
            <StatusBadge status={detail.runStatus} />
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {executionKind === 'pipeline' ? 'Pipeline Run' : 'Orchestrator Run'}
            {' · '}Run ID: <span className="font-mono">{runId}</span>
            {detail.projectName && ` · Project: ${detail.projectName}`}
          </div>
        </div>

        <div className="flex-1" />

        {/* Live tracking */}
        {isRunning && (
          <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Live
          </label>
        )}

        {/* Actions */}
        {(detail.runStatus === 'FAILED' || detail.runStatus === 'TIMED_OUT') && (
          <button
            onClick={() => executionKind === 'pipeline' ? api.retryPipelineRun(runId) : api.retryOrchestratorRun(runId)}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded hover:bg-amber-700"
          >
            ↩ Retry
          </button>
        )}
        {(detail.runStatus === 'RUNNING' || detail.runStatus === 'QUEUED') && (
          <button
            onClick={() => executionKind === 'pipeline' ? api.cancelPipelineRun(runId) : api.cancelOrchestratorRun(runId)}
            className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"
          >
            ✕ Cancel
          </button>
        )}

        {detail.sparkUiUrl && (
          <a
            href={detail.sparkUiUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 border border-neutral-300 text-xs rounded hover:bg-neutral-100"
          >
            Spark UI ↗
          </a>
        )}

        <button onClick={fetchDetail} className="px-3 py-1.5 border border-neutral-300 text-xs rounded hover:bg-neutral-100">
          ⟳ Refresh
        </button>
      </div>

      {/* ── Sub-tab bar ────────────────────────────────────────────────────── */}
      <div className="border-b border-neutral-200 px-4 flex gap-0">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              subTab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Sub-tab content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4">

        {subTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6 max-w-3xl">
            <div className="col-span-2 grid grid-cols-4 gap-4 bg-neutral-50 rounded-lg p-4 border border-neutral-200">
              <MetricItem label="Status"        value={detail.runStatus} />
              <MetricItem label="Trigger"       value={detail.triggerType} />
              <MetricItem label="Submitted By"  value={detail.submittedBy} />
              <MetricItem label="Version"       value={detail.versionLabel} />
              <MetricItem label="Started At"    value={fmtDatetime(detail.startDtm)} />
              <MetricItem label="Ended At"      value={fmtDatetime(detail.endDtm)} />
              <MetricItem label="Duration"      value={fmtDuration(detail.durationMs)} />
              <MetricItem label="Retry Count"   value={detail.retryCount} />
              <MetricItem label="SLA Status"    value={detail.slaStatus} />
              <MetricItem label="Error Category" value={detail.errorCategory} />
              <MetricItem label="Rows Processed" value={detail.rowsProcessed?.toLocaleString() ?? null} />
              <MetricItem label="Bytes Read"    value={detail.bytesRead?.toLocaleString() ?? null} />
              <MetricItem label="Bytes Written" value={detail.bytesWritten?.toLocaleString() ?? null} />
              {detail.sparkJobId && <MetricItem label="Spark Job ID" value={detail.sparkJobId} />}
            </div>

            {detail.errorMessage && (
              <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-red-700 mb-1">Error Details</div>
                <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">{detail.errorMessage}</pre>
              </div>
            )}
          </div>
        )}

        {subTab === 'node-timeline' && (
          <div>
            <div className="text-sm font-medium text-neutral-700 mb-4">
              Node Execution Timeline — {nodes.length} node{nodes.length !== 1 ? 's' : ''}
            </div>
            <NodeTimeline nodes={nodes} />
          </div>
        )}

        {subTab === 'logs' && (
          <div>
            <div className="text-sm font-medium text-neutral-700 mb-3">Execution Logs</div>
            <LogViewer runId={runId} autoRefresh={isRunning && autoRefresh} />
          </div>
        )}

        {subTab === 'metrics' && (
          <div className="max-w-xl">
            <div className="text-sm font-medium text-neutral-700 mb-4">Node-Level Metrics</div>
            {nodes.length === 0 ? (
              <div className="text-sm text-neutral-400">No node metrics captured.</div>
            ) : (
              <div className="space-y-3">
                {nodes.map(node => (
                  <div key={node.nodeRunId} className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-neutral-700 font-mono">
                        {node.nodeDisplayName || node.nodeIdInIrText}
                      </span>
                      <StatusBadge status={node.runStatus} />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <MetricItem label="Duration"  value={fmtDuration(node.durationMs)} />
                      <MetricItem label="Rows In"   value={node.rowsIn?.toLocaleString() ?? null} />
                      <MetricItem label="Rows Out"  value={node.rowsOut?.toLocaleString() ?? null} />
                      {node.errorMessage && <MetricItem label="Error" value={node.errorMessage.slice(0, 80)} />}
                    </div>
                    {Object.keys(node.metrics).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-neutral-500 cursor-pointer">Raw metrics</summary>
                        <pre className="mt-1 text-xs text-neutral-600 bg-white rounded p-2 overflow-auto max-h-40">
                          {JSON.stringify(node.metrics, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'code' && (
          <div>
            <div className="text-sm font-medium text-neutral-700 mb-3">Generated Spark Code</div>
            {detail.generatedCodeRef ? (
              <div className="bg-neutral-900 rounded-lg p-4 overflow-auto max-h-[60vh]">
                <pre className="text-xs text-neutral-200 font-mono whitespace-pre-wrap">
                  {detail.generatedCodeRef}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-neutral-400">
                Generated code snapshot not available for this run.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
