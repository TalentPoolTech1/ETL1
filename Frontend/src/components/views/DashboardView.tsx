import React, { useEffect, useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { fetchKpis } from '@/store/slices/monitorSlice';
import api from '@/services/api';
import {
  Activity, CheckCircle2, AlertCircle, Database, Clock,
  TrendingUp, TrendingDown, Zap, RefreshCw, AlertTriangle,
  BarChart2, ArrowRight, Circle, ChevronRight, Shield,
  Timer, Layers, GitBranch, Play, XCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentRun {
  pipelineRunId: string;
  pipelineName: string;
  projectName: string;
  runStatus: string;
  startDtm: string;
  endDtm: string | null;
  durationMs: number | null;
  triggerType: string;
  submittedBy: string | null;
  errorMessage: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtAgo(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  SUCCESS:  { label: 'Success',  dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  RUNNING:  { label: 'Running',  dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400', bg: 'bg-blue-400/10' },
  FAILED:   { label: 'Failed',   dot: 'bg-red-400',     text: 'text-red-400',     bg: 'bg-red-400/10' },
  PENDING:  { label: 'Pending',  dot: 'bg-slate-400',   text: 'text-slate-400',   bg: 'bg-slate-400/10' },
  CANCELLED:{ label: 'Cancelled',dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-400/10' },
  KILLED:   { label: 'Killed',   dot: 'bg-orange-400',  text: 'text-orange-400',  bg: 'bg-orange-400/10' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-400/10' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Sparkline (inline SVG bar chart) ─────────────────────────────────────────

function MiniBar({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const w = 4;
  const gap = 2;
  const h = 28;
  const totalW = values.length * (w + gap) - gap;
  return (
    <svg width={totalW} height={h} className="opacity-80">
      {values.map((v, i) => {
        const barH = Math.max(2, Math.round((v / max) * h));
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - barH}
            width={w}
            height={barH}
            rx={1}
            className={color}
          />
        );
      })}
    </svg>
  );
}

// ─── Status donut (pure SVG) ───────────────────────────────────────────────────

function StatusDonut({ success, failed, running, pending }: { success: number; failed: number; running: number; pending: number }) {
  const total = success + failed + running + pending || 1;
  const segments = [
    { value: success,  color: '#34d399' },
    { value: running,  color: '#60a5fa' },
    { value: failed,   color: '#f87171' },
    { value: pending,  color: '#94a3b8' },
  ];
  const r = 36;
  const cx = 44;
  const cy = 44;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={88} height={88} viewBox="0 0 88 88">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={12} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={12}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#f1f5f9" fontSize={14} fontWeight={700}>{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" fontSize={9}>runs</text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardView() {
  const dispatch = useAppDispatch();
  const { kpis, loading } = useAppSelector(s => s.monitor);

  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [activeRuns, setActiveRuns] = useState<RecentRun[]>([]);
  const [recentFailed, setRecentFailed] = useState<RecentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadAll = useCallback(async () => {
    dispatch(fetchKpis());
    setRunsLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const week  = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const [recentRes, failedRes, activeRes] = await Promise.allSettled([
        api.getPipelineRuns({ date_from: week, date_to: today, limit: 10, offset: 0 }),
        api.getPipelineRuns({ status: 'FAILED', date_from: week, date_to: today, limit: 5, offset: 0 }),
        api.getPipelineRuns({ status: 'RUNNING', limit: 10, offset: 0 }),
      ]);
      if (recentRes.status === 'fulfilled') setRecentRuns(recentRes.value.data?.data?.runs ?? []);
      if (failedRes.status === 'fulfilled') setRecentFailed(failedRes.value.data?.data?.runs ?? []);
      if (activeRes.status === 'fulfilled') setActiveRuns(activeRes.value.data?.data?.runs ?? []);
    } finally {
      setRunsLoading(false);
      setLastRefresh(new Date());
    }
  }, [dispatch]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(loadAll, 30000);
    return () => clearInterval(t);
  }, [loadAll]);

  // Derive status distribution from recent runs
  const statusCounts = recentRuns.reduce((acc, r) => {
    acc[r.runStatus] = (acc[r.runStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const successTrend = recentRuns
    .slice()
    .reverse()
    .map(r => (r.runStatus === 'SUCCESS' ? 1 : 0));

  const durationTrend = recentRuns
    .slice()
    .reverse()
    .map(r => r.durationMs ?? 0);

  const avgDurSec = kpis?.avgDurationMsToday ? (kpis.avgDurationMsToday / 1000).toFixed(1) : '—';

  return (
    <div className="h-full overflow-y-auto bg-[#0d0f1a] text-slate-200">
      <div className="max-w-[1600px] mx-auto p-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Platform Overview</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Last refreshed {lastRefresh.toLocaleTimeString()} · auto-refresh 30s
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading || runsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || runsLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <KpiCard icon={Activity}    label="Total Runs"      value={kpis?.totalToday ?? 0}        sub="today"            color="blue"    trend={successTrend} />
          <KpiCard icon={Play}        label="Running Now"     value={kpis?.runningNow ?? 0}         sub="in progress"      color="blue"    pulse={!!kpis?.runningNow} />
          <KpiCard icon={CheckCircle2} label="Success Rate"   value={kpis?.successRateToday != null ? `${kpis.successRateToday.toFixed(1)}%` : '—'} sub="last 24h" color={kpis?.successRateToday != null && kpis.successRateToday < 90 ? 'red' : 'emerald'} />
          <KpiCard icon={XCircle}     label="Failed"          value={kpis?.failedToday ?? 0}        sub="today"            color={kpis?.failedToday ? 'red' : 'slate'} />
          <KpiCard icon={AlertTriangle} label="SLA Breaches"  value={kpis?.slaBreachesToday ?? 0}   sub="today"            color={kpis?.slaBreachesToday ? 'amber' : 'slate'} />
          <KpiCard icon={Database}    label="Data Volume"     value={kpis?.dataVolumeGbToday != null ? `${kpis.dataVolumeGbToday.toFixed(2)} GB` : '—'} sub="processed today" color="violet" />
          <KpiCard icon={Timer}       label="Avg Duration"    value={avgDurSec !== '—' ? `${avgDurSec}s` : '—'} sub="successful runs"   color="slate" trend={durationTrend} />
          <KpiCard icon={Layers}      label="Active Pipelines" value={kpis?.activePipelines ?? 0}   sub="with active version" color="slate" />
        </div>

        {/* ── Mid row: Status donut + Active Runs + Recent Failures ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Status Distribution */}
          <div className="lg:col-span-3 bg-[#131829] border border-slate-800 rounded-xl p-5">
            <SectionHeader icon={BarChart2} title="Run Distribution" sub="Last 7 days" />
            <div className="flex items-center gap-5 mt-4">
              <StatusDonut
                success={statusCounts.SUCCESS ?? 0}
                running={statusCounts.RUNNING ?? 0}
                failed={statusCounts.FAILED ?? 0}
                pending={(statusCounts.PENDING ?? 0) + (statusCounts.CANCELLED ?? 0)}
              />
              <div className="space-y-2 flex-1">
                {[
                  { key: 'SUCCESS',  label: 'Success',  color: 'bg-emerald-400' },
                  { key: 'RUNNING',  label: 'Running',  color: 'bg-blue-400' },
                  { key: 'FAILED',   label: 'Failed',   color: 'bg-red-400' },
                  { key: 'PENDING',  label: 'Pending',  color: 'bg-slate-500' },
                ].map(({ key, label, color }) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-sm ${color}`} />
                      <span className="text-slate-400">{label}</span>
                    </div>
                    <span className="text-slate-200 font-medium tabular-nums">{statusCounts[key] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Runs */}
          <div className="lg:col-span-4 bg-[#131829] border border-slate-800 rounded-xl p-5">
            <SectionHeader icon={Zap} title="Active Runs" sub={`${activeRuns.length} running`} dot="bg-blue-400 animate-pulse" />
            <div className="mt-3 space-y-2">
              {activeRuns.length === 0 ? (
                <EmptyState icon={Circle} text="No pipelines running" />
              ) : activeRuns.slice(0, 5).map(r => (
                <div key={r.pipelineRunId} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{r.pipelineName}</p>
                    <p className="text-[12px] text-slate-300 truncate">{r.projectName} · started {fmtAgo(r.startDtm)}</p>
                  </div>
                  <span className="text-[12px] text-blue-400 font-mono tabular-nums shrink-0">
                    {fmtTime(r.startDtm)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Failures */}
          <div className="lg:col-span-5 bg-[#131829] border border-slate-800 rounded-xl p-5">
            <SectionHeader icon={AlertCircle} title="Recent Failures" sub="Last 7 days" dot="bg-red-400" />
            <div className="mt-3 space-y-2">
              {recentFailed.length === 0 ? (
                <EmptyState icon={CheckCircle2} text="No failures — all clear" success />
              ) : recentFailed.slice(0, 5).map(r => (
                <div key={r.pipelineRunId} className="py-2 border-b border-slate-800/60 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{r.pipelineName}</p>
                      <p className="text-[12px] text-red-400/80 truncate mt-0.5">{r.errorMessage ?? 'Unknown error'}</p>
                    </div>
                    <span className="text-[12px] text-slate-300 shrink-0 tabular-nums">{fmtAgo(r.startDtm)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Activity Table ── */}
        <div className="bg-[#131829] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-slate-300" />
              <span className="text-sm font-medium text-slate-200">Recent Pipeline Runs</span>
              <span className="text-xs text-slate-300">— last 7 days</span>
            </div>
            <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800/60">
                  {['Status','Pipeline','Project','Trigger','Started','Duration','Submitted By'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[12px] font-medium text-slate-300 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runsLoading && recentRuns.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-300 text-xs">Loading...</td></tr>
                ) : recentRuns.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-300 text-xs">No runs in the last 7 days</td></tr>
                ) : recentRuns.map((r, i) => (
                  <tr key={r.pipelineRunId} className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-800/10'}`}>
                    <td className="px-4 py-2.5 whitespace-nowrap"><StatusBadge status={r.runStatus} /></td>
                    <td className="px-4 py-2.5 font-medium text-slate-200 truncate max-w-[180px] whitespace-nowrap">{r.pipelineName}</td>
                    <td className="px-4 py-2.5 text-slate-400 truncate max-w-[140px] whitespace-nowrap">{r.projectName ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 capitalize whitespace-nowrap">{r.triggerType?.toLowerCase() ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 tabular-nums whitespace-nowrap">{fmtAgo(r.startDtm)}</td>
                    <td className="px-4 py-2.5 text-slate-400 tabular-nums whitespace-nowrap font-mono">{fmtDuration(r.durationMs)}</td>
                    <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px] whitespace-nowrap">{r.submittedBy ?? 'system'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bottom row: SLA + Platform Health ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* SLA & Compliance */}
          <div className="bg-[#131829] border border-slate-800 rounded-xl p-5">
            <SectionHeader icon={Shield} title="SLA & Compliance" sub="Today" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ComplianceStat
                label="SLA Compliance"
                value={kpis?.slaBreachesToday === 0 ? 100 : Math.max(0, 100 - (kpis?.slaBreachesToday ?? 0) * 10)}
                unit="%"
                good={!kpis?.slaBreachesToday}
              />
              <ComplianceStat
                label="Success Rate"
                value={kpis?.successRateToday ?? 0}
                unit="%"
                good={(kpis?.successRateToday ?? 0) >= 95}
              />
              <ComplianceStat
                label="SLA Breaches"
                value={kpis?.slaBreachesToday ?? 0}
                unit=""
                good={!kpis?.slaBreachesToday}
                invert
              />
              <ComplianceStat
                label="Failed Runs"
                value={kpis?.failedToday ?? 0}
                unit=""
                good={!kpis?.failedToday}
                invert
              />
            </div>
          </div>

          {/* Throughput Summary */}
          <div className="bg-[#131829] border border-slate-800 rounded-xl p-5">
            <SectionHeader icon={TrendingUp} title="Throughput" sub="Today" />
            <div className="mt-4 space-y-3">
              <ThroughputRow label="Data Processed" value={`${kpis?.dataVolumeGbToday?.toFixed(3) ?? '0.000'} GB`} icon={Database} />
              <ThroughputRow label="Total Runs" value={kpis?.totalToday ?? 0} icon={Activity} />
              <ThroughputRow label="Avg Run Duration" value={avgDurSec !== '—' ? `${avgDurSec}s` : '—'} icon={Clock} />
              <ThroughputRow label="Concurrent Peak" value={kpis?.runningNow ?? 0} icon={Zap} />
            </div>
            {durationTrend.length > 2 && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <p className="text-[12px] text-slate-300 mb-2">Duration trend (recent runs)</p>
                <MiniBar values={durationTrend.slice(-12)} color="fill-violet-500" />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, trend, pulse }: any) {
  const colorMap: Record<string, string> = {
    blue:    'text-blue-400',
    emerald: 'text-emerald-400',
    red:     'text-red-400',
    amber:   'text-amber-400',
    violet:  'text-violet-400',
    slate:   'text-slate-300',
  };
  const iconMap: Record<string, string> = {
    blue:    'text-blue-500/60',
    emerald: 'text-emerald-500/60',
    red:     'text-red-500/60',
    amber:   'text-amber-500/60',
    violet:  'text-violet-500/60',
    slate:   'text-slate-300/60',
  };
  return (
    <div className="bg-[#131829] border border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[96px] hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <Icon className={`w-4 h-4 ${iconMap[color] ?? iconMap.slate}`} />
        {pulse && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
        {trend && trend.length > 2 && (
          <MiniBar values={trend.slice(-8)} color={color === 'emerald' ? 'fill-emerald-500' : color === 'red' ? 'fill-red-500' : 'fill-slate-600'} />
        )}
      </div>
      <div>
        <div className={`text-xl font-bold tabular-nums ${colorMap[color] ?? colorMap.slate}`}>{value}</div>
        <div className="text-[12px] text-slate-300 mt-0.5 leading-tight">{label}</div>
        <div className="text-[12px] text-slate-400 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, sub, dot }: any) {
  return (
    <div className="flex items-center gap-2">
      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      {!dot && <Icon className="w-4 h-4 text-slate-300" />}
      <span className="text-sm font-medium text-slate-200">{title}</span>
      {sub && <span className="text-xs text-slate-300">{sub}</span>}
    </div>
  );
}

function EmptyState({ icon: Icon, text, success }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <Icon className={`w-6 h-6 ${success ? 'text-emerald-500/50' : 'text-slate-400'}`} />
      <p className={`text-xs ${success ? 'text-emerald-500/70' : 'text-slate-300'}`}>{text}</p>
    </div>
  );
}

function ComplianceStat({ label, value, unit, good, invert }: any) {
  const isGood = invert ? value === 0 : good;
  return (
    <div className="bg-slate-800/40 rounded-lg p-3">
      <p className="text-[12px] text-slate-300 mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
        {typeof value === 'number' ? value.toFixed(unit === '%' ? 1 : 0) : value}{unit}
      </p>
    </div>
  );
}

function ThroughputRow({ label, value, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <span className="text-xs font-medium text-slate-200 tabular-nums font-mono">{value}</span>
    </div>
  );
}
