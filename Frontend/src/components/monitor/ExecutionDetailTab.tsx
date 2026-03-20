/**
 * ExecutionDetailTab — full v2 spec compliant
 * Sub-tabs: Summary | Steps | Logs | Code | Metrics
 * Dark theme, log search + download, real-time auto-refresh
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  RefreshCw, Download, Search, Copy, CheckCircle2,
  XCircle, Clock, AlertTriangle, Activity, BarChart3,
  Code2, FileText, Play, RotateCcw, ExternalLink,
} from 'lucide-react';
import api from '@/services/api';
import type { RunStatus, NodeRunDetail } from '@/types';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RunStatus, { label: string; dot: string; text: string; bg: string }> = {
  PENDING:             { label: 'Pending',    dot: 'bg-slate-500',                      text: 'text-slate-300',   bg: 'bg-slate-800/60 border-slate-700' },
  QUEUED:              { label: 'Queued',     dot: 'bg-blue-400',                       text: 'text-blue-300',    bg: 'bg-blue-900/30 border-blue-800' },
  RUNNING:             { label: 'Running',    dot: 'bg-blue-400 animate-pulse',         text: 'text-blue-300',    bg: 'bg-blue-900/30 border-blue-800' },
  SUCCESS:             { label: 'Success',    dot: 'bg-emerald-400',                    text: 'text-emerald-300', bg: 'bg-emerald-900/30 border-emerald-800' },
  FAILED:              { label: 'Failed',     dot: 'bg-red-400',                        text: 'text-red-300',     bg: 'bg-red-900/30 border-red-800' },
  CANCELLED:           { label: 'Cancelled',  dot: 'bg-orange-400',                     text: 'text-orange-300',  bg: 'bg-orange-900/30 border-orange-800' },
  SKIPPED:             { label: 'Skipped',    dot: 'bg-slate-500',                      text: 'text-slate-400',   bg: 'bg-slate-800/40 border-slate-700' },
  RETRYING:            { label: 'Retrying',   dot: 'bg-amber-400 animate-pulse',        text: 'text-amber-300',   bg: 'bg-amber-900/30 border-amber-800' },
  TIMED_OUT:           { label: 'Timed Out',  dot: 'bg-red-500',                        text: 'text-red-300',     bg: 'bg-red-900/40 border-red-800' },
  PARTIALLY_COMPLETED: { label: 'Partial',    dot: 'bg-amber-400',                      text: 'text-amber-300',   bg: 'bg-amber-900/30 border-amber-800' },
};

function StatusBadge({ status }: { status: RunStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[12px] font-medium ${cfg.text} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDur(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function fmtBytes(b: number | null): string {
  if (b === null) return '—';
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className="text-[12px] font-medium text-slate-200">{value ?? '—'}</span>
    </div>
  );
}

// ─── Node timeline ────────────────────────────────────────────────────────────

function NodeTimeline({ nodes }: { nodes: NodeRunDetail[] }) {
  if (!nodes.length) return <div className="text-sm text-slate-500 py-4">No node-level data available.</div>;
  const maxDur = Math.max(...nodes.map(n => n.durationMs ?? 0), 1);
  const barCls = (s: RunStatus) =>
    s === 'SUCCESS' ? 'bg-emerald-600' : s === 'FAILED' ? 'bg-red-600' : s === 'RUNNING' ? 'bg-blue-500' : 'bg-slate-600';

  return (
    <div className="space-y-1.5">
      {nodes.map(node => {
        const pct = Math.max(2, ((node.durationMs ?? 0) / maxDur) * 100);
        return (
          <div key={node.nodeRunId} className="flex items-center gap-3">
            <div className="w-48 text-[11px] text-slate-400 truncate font-mono" title={node.nodeDisplayName}>
              {node.nodeDisplayName || node.nodeIdInIrText}
            </div>
            <div className="flex-1 bg-slate-800 rounded h-5 overflow-hidden relative">
              <div className={`h-full ${barCls(node.runStatus)} rounded transition-all`} style={{ width: `${pct}%` }} />
              <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-slate-200">
                {fmtDur(node.durationMs)}
              </span>
            </div>
            <StatusBadge status={node.runStatus} />
            <div className="w-20 text-right text-[11px] text-slate-500">
              {node.rowsOut !== null ? `${node.rowsOut.toLocaleString()} rows` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Log viewer ───────────────────────────────────────────────────────────────

interface LogEntry { logDtm: string; logLevel: string; logMessage: string; nodeId?: string; }

function LogViewer({ runId, autoRefresh }: { runId: string; autoRefresh: boolean }) {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [levelFilter, setLevel]   = useState('');
  const [copied, setCopied]       = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.getPipelineRunLogs(runId, { limit: 1000 });
      setLogs(res.data.data ?? []);
    } catch { /* silently degrade */ }
    finally { setLoading(false); }
  }, [runId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchLogs, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    if (!search && !levelFilter) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, search, levelFilter]);

  const filtered = logs.filter(l => {
    const matchLevel  = !levelFilter || l.logLevel === levelFilter;
    const matchSearch = !search || l.logMessage.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  const levelCls = (level: string) => {
    switch (level) {
      case 'ERROR': case 'FATAL': return 'text-red-400';
      case 'WARN':                return 'text-amber-400';
      case 'INFO':                return 'text-emerald-400';
      case 'DEBUG': case 'TRACE': return 'text-slate-500';
      default:                    return 'text-slate-400';
    }
  };

  const downloadLogs = () => {
    const text = filtered.map(l => `${l.logDtm} [${l.logLevel}] ${l.nodeId ? `[${l.nodeId}] ` : ''}${l.logMessage}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `run_${runId}_logs.txt`; a.click();
  };

  const copyLogs = async () => {
    await navigator.clipboard.writeText(
      filtered.map(l => `${l.logDtm} [${l.logLevel}] ${l.logMessage}`).join('\n')
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const uniqueLevels = [...new Set(logs.map(l => l.logLevel))].sort();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Log toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs…"
            className="w-full h-7 pl-7 pr-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-600" />
        </div>
        <select value={levelFilter} onChange={e => setLevel(e.target.value)}
          className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-300 outline-none focus:border-blue-600">
          <option value="">All levels</option>
          {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <span className="text-[11px] text-slate-600">{filtered.length} lines</span>
        <div className="flex-1" />
        <button onClick={fetchLogs}
          className="flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
        <button onClick={copyLogs}
          className="flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
          {copied ? <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
        <button onClick={downloadLogs}
          className="flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
          <Download className="w-3 h-3" /> Download
        </button>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-auto bg-[#070910] border border-slate-800 rounded-lg p-3 font-mono text-[12px] min-h-0">
        {loading && <div className="text-slate-600">Loading logs…</div>}
        {!loading && filtered.length === 0 && <div className="text-slate-600">No log entries found.</div>}
        {filtered.map((entry, i) => (
          <div key={i} className="flex gap-2 leading-5 hover:bg-slate-900/40 px-1 rounded">
            <span className="text-slate-600 shrink-0 select-none">{new Date(entry.logDtm).toLocaleTimeString()}</span>
            <span className={`shrink-0 w-11 font-medium ${levelCls(entry.logLevel)}`}>{entry.logLevel}</span>
            {entry.nodeId && <span className="text-slate-600 shrink-0">[{entry.nodeId.slice(0, 8)}]</span>}
            <span className="text-slate-300 break-all">{entry.logMessage}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Main ExecutionDetailTab ──────────────────────────────────────────────────

type DetailSubTab = 'summary' | 'steps' | 'logs' | 'code' | 'metrics';

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

export function ExecutionDetailTab({ runId, executionKind }: {
  runId: string; executionKind: 'pipeline' | 'orchestrator';
}) {
  const [detail, setDetail]     = useState<PipelineRunDetail | null>(null);
  const [nodes, setNodes]       = useState<NodeRunDetail[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [subTab, setSubTab]     = useState<DetailSubTab>('summary');
  const [autoRefresh, setAuto]  = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const isRunning = detail?.runStatus === 'RUNNING' || detail?.runStatus === 'RETRYING';

  const fetchDetail = useCallback(async () => {
    try {
      if (executionKind === 'pipeline') {
        const [detRes, nodeRes] = await Promise.allSettled([
          api.getPipelineRunDetail(runId),
          api.getPipelineRunNodes(runId),
        ]);
        if (detRes.status === 'fulfilled') setDetail(detRes.value.data.data ?? detRes.value.data);
        if (nodeRes.status === 'fulfilled') setNodes(nodeRes.value.data.data ?? []);
      } else {
        const res = await api.getOrchestratorRunDetail(runId);
        const data = res.data?.data ?? res.data;
        setDetail({
          pipelineRunId: data.orchRunId ?? runId,
          pipelineName: data.orchestratorName ?? 'Orchestrator',
          projectName: data.projectName ?? null,
          versionLabel: '',
          runStatus: data.runStatus ?? 'PENDING',
          triggerType: data.triggerType ?? 'MANUAL',
          submittedBy: data.submittedBy ?? null,
          startDtm: data.startDtm ?? null,
          endDtm: data.endDtm ?? null,
          durationMs: data.durationMs ?? null,
          rowsProcessed: null,
          bytesRead: null,
          bytesWritten: null,
          errorCategory: null,
          errorMessage: data.errorMessage ?? null,
          retryCount: data.retryCount ?? 0,
          slaStatus: 'N_A',
          generatedCodeRef: null,
          sparkJobId: null,
          sparkUiUrl: null,
          nodes: [],
        });
        setNodes((Array.isArray(data.pipelineRuns) ? data.pipelineRuns : []).map((run: any) => ({
          nodeRunId: run.pipelineRunId ?? run.pipelineId ?? `${runId}-pipeline`,
          nodeIdInIrText: run.dagNodeId ?? run.pipelineId ?? '',
          nodeDisplayName: run.pipelineName ?? 'Pipeline',
          runStatus: run.runStatus ?? 'PENDING',
          startDtm: run.startDtm ?? null,
          endDtm: run.endDtm ?? null,
          durationMs: run.durationMs ?? null,
          rowsIn: null,
          rowsOut: null,
          errorMessage: run.errorMessage ?? null,
          metrics: { executionOrder: run.executionOrder ?? null },
        })));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load execution details');
    } finally { setLoading(false); }
  }, [runId, executionKind]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  useEffect(() => {
    if (!autoRefresh || !isRunning) return;
    const t = setInterval(fetchDetail, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, isRunning, fetchDetail]);

  const SUB_TABS: { key: DetailSubTab; label: string; Icon: React.ElementType }[] = [
    { key: 'summary', label: 'Summary',  Icon: FileText  },
    { key: 'steps',   label: 'Steps',    Icon: Activity  },
    { key: 'logs',    label: 'Logs',     Icon: FileText  },
    { key: 'code',    label: 'Code',     Icon: Code2     },
    { key: 'metrics', label: 'Metrics',  Icon: BarChart3 },
  ];

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#0d0f1a] text-slate-400 text-sm">
      Loading execution details…
    </div>
  );

  if (error || !detail) return (
    <div className="flex-1 flex items-center justify-center bg-[#0d0f1a]">
      <div className="bg-red-950/50 border border-red-800 rounded-lg p-6 max-w-sm text-center">
        <div className="text-red-400 font-medium mb-1">Could not load execution</div>
        <div className="text-sm text-red-500/80">{error ?? 'Unknown error'}</div>
        <button onClick={fetchDetail}
          className="mt-4 px-4 py-1.5 bg-red-700 text-white text-sm rounded hover:bg-red-600 transition-colors">
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0f1a]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[16px] font-semibold text-slate-100">{detail.pipelineName}</h1>
              <StatusBadge status={detail.runStatus} />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {executionKind === 'pipeline' ? 'Pipeline' : 'Orchestrator'} Run ·{' '}
              <span className="font-mono">{runId}</span>
              {detail.projectName && ` · ${detail.projectName}`}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isRunning && (
              <label className="flex items-center gap-1.5 text-[12px] text-slate-400 cursor-pointer">
                <input type="checkbox" checked={autoRefresh} onChange={e => setAuto(e.target.checked)} className="accent-blue-500" />
                Live
              </label>
            )}
            {(detail.runStatus === 'FAILED' || detail.runStatus === 'TIMED_OUT') && (
              <button onClick={() => (executionKind === 'pipeline' ? api.retryPipelineRun : api.retryOrchestratorRun)(runId)}
                className="flex items-center gap-1.5 h-7 px-3 bg-amber-700 hover:bg-amber-600 text-white rounded text-[12px] font-medium transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Retry
              </button>
            )}
            {(detail.runStatus === 'RUNNING' || detail.runStatus === 'QUEUED') && (
              <button onClick={() => (executionKind === 'pipeline' ? api.cancelPipelineRun : api.cancelOrchestratorRun)(runId)}
                className="flex items-center gap-1.5 h-7 px-3 bg-red-700 hover:bg-red-600 text-white rounded text-[12px] font-medium transition-colors">
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
            {detail.sparkUiUrl && (
              <a href={detail.sparkUiUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Spark UI
              </a>
            )}
            <button onClick={fetchDetail}
              className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-tab bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-slate-800 px-5 flex-shrink-0">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
              subTab === t.key
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-5 min-h-0">

        {subTab === 'summary' && (
          <div className="max-w-2xl space-y-4">
            <div className="grid grid-cols-2 gap-x-12">
              <div>
                <Metric label="Status"         value={detail.runStatus} />
                <Metric label="Trigger"        value={detail.triggerType} />
                <Metric label="Submitted By"   value={detail.submittedBy} />
                <Metric label="Version"        value={detail.versionLabel} />
                <Metric label="Started"        value={fmtDt(detail.startDtm)} />
                <Metric label="Ended"          value={fmtDt(detail.endDtm)} />
                <Metric label="Duration"       value={fmtDur(detail.durationMs)} />
              </div>
              <div>
                <Metric label="Retries"        value={detail.retryCount} />
                <Metric label="SLA Status"     value={detail.slaStatus} />
                <Metric label="Error Category" value={detail.errorCategory} />
                <Metric label="Rows Processed" value={detail.rowsProcessed?.toLocaleString() ?? null} />
                <Metric label="Data Read"      value={fmtBytes(detail.bytesRead)} />
                <Metric label="Data Written"   value={fmtBytes(detail.bytesWritten)} />
                {detail.sparkJobId && <Metric label="Spark Job ID" value={detail.sparkJobId} />}
              </div>
            </div>
            {detail.errorMessage && (
              <div className="bg-red-950/40 border border-red-800 rounded-lg p-4">
                <div className="text-[11px] font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Error Details
                </div>
                <pre className="text-[12px] text-red-300/80 whitespace-pre-wrap font-mono">{detail.errorMessage}</pre>
              </div>
            )}
          </div>
        )}

        {subTab === 'steps' && (
          <div className="max-w-3xl">
            <div className="text-[12px] text-slate-500 mb-4">
              {nodes.length} step{nodes.length !== 1 ? 's' : ''} · click a bar to expand metrics
            </div>
            <NodeTimeline nodes={nodes} />
          </div>
        )}

        {subTab === 'logs' && (
          <div className="h-full flex flex-col" style={{ minHeight: '400px' }}>
            <LogViewer runId={runId} autoRefresh={isRunning && autoRefresh} />
          </div>
        )}

        {subTab === 'code' && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-medium text-slate-300">Generated Spark Code</div>
              {detail.generatedCodeRef && (
                <div className="flex items-center gap-2">
                  <button onClick={async () => {
                    await navigator.clipboard.writeText(detail.generatedCodeRef!);
                    setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000);
                  }} className="flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
                    {codeCopied ? <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                  <button onClick={() => {
                    const blob = new Blob([detail.generatedCodeRef!], { type: 'text/plain' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                    a.download = `run_${runId}_code.py`; a.click();
                  }} className="flex items-center gap-1 h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
              )}
            </div>
            {detail.generatedCodeRef ? (
              <div className="bg-[#070910] border border-slate-800 rounded-lg overflow-auto max-h-[70vh]">
                <pre className="p-4 text-[12px] text-slate-300 font-mono whitespace-pre">{detail.generatedCodeRef}</pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                <Code2 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Generated code snapshot not available for this run.</p>
              </div>
            )}
          </div>
        )}

        {subTab === 'metrics' && (
          <div className="max-w-3xl space-y-4">
            <div className="text-[12px] font-medium text-slate-300 mb-4">Node-Level Metrics</div>
            {nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No node metrics captured for this run.</p>
              </div>
            ) : nodes.map(node => (
              <div key={node.nodeRunId} className="border-b border-slate-800 pb-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-[12px] font-medium text-slate-200 font-mono">{node.nodeDisplayName || node.nodeIdInIrText}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-[12px] text-slate-500">{fmtDur(node.durationMs)}</span>
                    <span className="text-[12px] text-slate-500">↓{node.rowsIn?.toLocaleString() ?? '—'} ↑{node.rowsOut?.toLocaleString() ?? '—'}</span>
                    <StatusBadge status={node.runStatus} />
                  </div>
                </div>
                {node.errorMessage && (
                  <div className="text-[11px] text-red-400 pl-2 border-l border-red-800">{node.errorMessage.slice(0, 120)}</div>
                )}
                {Object.keys(node.metrics).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-300">Raw metrics</summary>
                    <pre className="mt-1 text-[11px] text-slate-500 bg-[#070910] rounded p-2 overflow-auto max-h-32 border border-slate-800">
                      {JSON.stringify(node.metrics, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
